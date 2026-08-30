-- ChronosAgent SafeState - PostgreSQL RPC Endpoints
-- Zero-Cost Serverless Execution directly in Database Engine

-- 1. Activate Device License RPC
CREATE OR REPLACE FUNCTION public.activate_device_license(
    p_license_key TEXT,
    p_machine_fingerprint TEXT,
    p_device_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_license RECORD;
    v_subscription RECORD;
    v_active_count INTEGER;
    v_existing_activation RECORD;
    v_result JSONB;
BEGIN
    -- 1. Verify License exists and is active
    SELECT * INTO v_license
    FROM public.licenses
    WHERE license_key = p_license_key AND status = 'active';

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'License key invalid or inactive'
        );
    END IF;

    -- 2. Verify Subscription is active
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE user_id = v_license.user_id AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;

    IF NOT FOUND OR v_subscription.current_period_end < NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Subscription expired or not found'
        );
    END IF;

    -- 3. Check if device is already registered
    SELECT * INTO v_existing_activation
    FROM public.device_activations
    WHERE license_id = v_license.id AND machine_fingerprint = p_machine_fingerprint;

    IF FOUND THEN
        -- Update last seen
        UPDATE public.device_activations
        SET last_seen_at = NOW(), device_name = p_device_name
        WHERE id = v_existing_activation.id;
    ELSE
        -- Check device limits
        SELECT COUNT(*) INTO v_active_count
        FROM public.device_activations
        WHERE license_id = v_license.id;

        IF v_active_count >= v_license.max_devices THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Maximum device limit reached (%s devices)', v_license.max_devices)
            );
        END IF;

        -- Register new device activation
        INSERT INTO public.device_activations (license_id, machine_fingerprint, device_name, activated_at, last_seen_at)
        VALUES (v_license.id, p_machine_fingerprint, p_device_name, NOW(), NOW());
    END IF;

    -- 4. Construct response payload for client-side cryptographic verification
    RETURN jsonb_build_object(
        'success', true,
        'license_id', v_license.id,
        'user_id', v_license.user_id,
        'machine_fingerprint', p_machine_fingerprint,
        'plan', v_subscription.plan,
        'expires_at', EXTRACT(EPOCH FROM v_subscription.current_period_end)::BIGINT,
        'issued_at', EXTRACT(EPOCH FROM NOW())::BIGINT
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Verify Device License RPC (Phone-Home Sync)
CREATE OR REPLACE FUNCTION public.verify_device_license(
    p_license_key TEXT,
    p_machine_fingerprint TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_license RECORD;
    v_subscription RECORD;
    v_activation RECORD;
BEGIN
    SELECT * INTO v_license
    FROM public.licenses
    WHERE license_key = p_license_key AND status = 'active';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'License revoked or not found');
    END IF;

    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE user_id = v_license.user_id AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;

    IF NOT FOUND OR v_subscription.current_period_end < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Subscription expired');
    END IF;

    SELECT * INTO v_activation
    FROM public.device_activations
    WHERE license_id = v_license.id AND machine_fingerprint = p_machine_fingerprint;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Device not registered for this license');
    END IF;

    -- Update last seen timestamp
    UPDATE public.device_activations
    SET last_seen_at = NOW()
    WHERE id = v_activation.id;

    RETURN jsonb_build_object(
        'valid', true,
        'license_id', v_license.id,
        'user_id', v_license.user_id,
        'machine_fingerprint', p_machine_fingerprint,
        'plan', v_subscription.plan,
        'expires_at', EXTRACT(EPOCH FROM v_subscription.current_period_end)::BIGINT,
        'issued_at', EXTRACT(EPOCH FROM NOW())::BIGINT
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Log Agent Trace RPC
CREATE OR REPLACE FUNCTION public.log_agent_trace(
    p_agent_id TEXT,
    p_session_id TEXT,
    p_action_type TEXT,
    p_payload JSONB,
    p_verdict TEXT,
    p_reason TEXT,
    p_latency_ms INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_trace_id UUID;
BEGIN
    INSERT INTO public.agent_traces (
        user_id, agent_id, session_id, action_type, payload, verdict, reason, latency_ms, created_at
    )
    VALUES (
        auth.uid(), p_agent_id, p_session_id, p_action_type, p_payload, p_verdict, p_reason, p_latency_ms, NOW()
    )
    RETURNING id INTO v_trace_id;

    RETURN jsonb_build_object(
        'success', true,
        'trace_id', v_trace_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to public/anon/authenticated roles
GRANT EXECUTE ON FUNCTION public.activate_device_license(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_device_license(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_agent_trace(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;
