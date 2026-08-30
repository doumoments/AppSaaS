-- ==============================================================================
-- 002_rpc_endpoints.sql: Zero-Cost, Ultra-Secure PostgreSQL RPC Stored Procedures
-- Native Database Endpoints for Device Activation and License Verification
-- ==============================================================================

-- 1. ACTIVATE DEVICE LICENSE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.activate_device_license(
    p_machine_fingerprint TEXT,
    p_device_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_license RECORD;
    v_active_count INT;
    v_existing_id UUID;
    v_plan TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_issued_at BIGINT;
    v_expires_at BIGINT;
BEGIN
    -- 1. Authenticate JWT Caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No autorizado: Sesión de usuario inválida o ausente'
        );
    END IF;

    -- 2. Validate Input
    IF p_machine_fingerprint IS NULL OR length(trim(p_machine_fingerprint)) = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Huella de hardware (machine_fingerprint) requerida'
        );
    END IF;

    -- 3. Fetch Active License for User
    SELECT * INTO v_license
    FROM public.licenses
    WHERE user_id = v_user_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_license.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No se encontró una licencia activa para este usuario'
        );
    END IF;

    -- 4. Check Existing Activation on this Device
    SELECT id INTO v_existing_id
    FROM public.device_activations
    WHERE license_id = v_license.id AND machine_fingerprint = p_machine_fingerprint;

    -- 5. Count Total Active Devices
    SELECT COUNT(*) INTO v_active_count
    FROM public.device_activations
    WHERE license_id = v_license.id;

    IF v_existing_id IS NULL AND v_active_count >= v_license.max_devices THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Límite de dispositivos alcanzado (%s de %s). Desactiva otro equipo antes de continuar.', v_active_count, v_license.max_devices)
        );
    END IF;

    -- 6. Upsert Device Activation Record
    IF v_existing_id IS NOT NULL THEN
        UPDATE public.device_activations
        SET last_seen_at = v_now,
            device_name = COALESCE(p_device_name, device_name)
        WHERE id = v_existing_id;
    ELSE
        INSERT INTO public.device_activations (
            license_id,
            user_id,
            machine_fingerprint,
            device_name,
            activated_at,
            last_seen_at
        ) VALUES (
            v_license.id,
            v_user_id,
            p_machine_fingerprint,
            COALESCE(p_device_name, 'Dispositivo Registrado'),
            v_now,
            v_now
        );
    END IF;

    -- 7. Query User Subscription Plan
    SELECT COALESCE(plan, 'commercial_pro') INTO v_plan
    FROM public.subscriptions
    WHERE user_id = v_user_id AND status = 'active'
    LIMIT 1;

    IF v_plan IS NULL THEN
        v_plan := 'commercial_pro';
    END IF;

    v_issued_at := EXTRACT(EPOCH FROM v_now)::BIGINT;
    v_expires_at := v_issued_at + (86400 * 30); -- 30 days valid token

    -- 8. Return Verified Structured Result
    RETURN jsonb_build_object(
        'success', true,
        'license_id', v_license.id,
        'user_id', v_user_id,
        'machine_fingerprint', p_machine_fingerprint,
        'plan', v_plan,
        'status', 'active',
        'issued_at', v_issued_at,
        'expires_at', v_expires_at,
        'grace_days', 14,
        'max_devices', v_license.max_devices,
        'active_devices', CASE WHEN v_existing_id IS NULL THEN v_active_count + 1 ELSE v_active_count END
    );
END;
$$;

-- 2. VERIFY DEVICE LICENSE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.verify_device_license(
    p_license_id UUID,
    p_machine_fingerprint TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_activation RECORD;
    v_license RECORD;
    v_plan TEXT;
    v_now TIMESTAMPTZ := NOW();
    v_issued_at BIGINT;
    v_expires_at BIGINT;
BEGIN
    -- 1. Fetch License
    SELECT * INTO v_license
    FROM public.licenses
    WHERE id = p_license_id AND status = 'active';

    IF v_license.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Licencia no encontrada o inactiva');
    END IF;

    -- 2. Fetch Device Activation
    SELECT * INTO v_activation
    FROM public.device_activations
    WHERE license_id = p_license_id AND machine_fingerprint = p_machine_fingerprint;

    IF v_activation.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Dispositivo no registrado');
    END IF;

    -- 3. Update Last Seen
    UPDATE public.device_activations
    SET last_seen_at = v_now
    WHERE id = v_activation.id;

    -- 4. Check Plan
    SELECT COALESCE(plan, 'commercial_pro') INTO v_plan
    FROM public.subscriptions
    WHERE user_id = v_license.user_id AND status = 'active'
    LIMIT 1;

    v_issued_at := EXTRACT(EPOCH FROM v_now)::BIGINT;
    v_expires_at := v_issued_at + (86400 * 30);

    RETURN jsonb_build_object(
        'valid', true,
        'license_id', v_license.id,
        'user_id', v_license.user_id,
        'machine_fingerprint', p_machine_fingerprint,
        'plan', COALESCE(v_plan, 'commercial_pro'),
        'issued_at', v_issued_at,
        'expires_at', v_expires_at,
        'grace_days', 14
    );
END;
$$;
