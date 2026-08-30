-- ChronosAgent SafeState - Comprehensive Database Schema (PostgreSQL)
-- Row Level Security (RLS) Strict Enabled

-- 1. User Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- 2. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
    plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan IN ('starter', 'pro', 'enterprise')),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- 3. Licenses (Ed25519 Cryptographic Licenses)
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    license_key TEXT UNIQUE NOT NULL,
    max_devices INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own licenses"
    ON licenses FOR SELECT
    USING (auth.uid() = user_id);

-- 4. Device Activations (Hardware Fingerprint Bindings)
CREATE TABLE IF NOT EXISTS device_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    machine_fingerprint TEXT NOT NULL,
    device_name TEXT NOT NULL,
    activated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_license_device UNIQUE (license_id, machine_fingerprint)
);

ALTER TABLE device_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device activations"
    ON device_activations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM licenses
            WHERE licenses.id = device_activations.license_id
            AND licenses.user_id = auth.uid()
        )
    );

-- 5. Security Policies (Governance & Guardrails)
CREATE TABLE IF NOT EXISTS security_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default SafeState Policy',
    max_execution_time_sec INTEGER NOT NULL DEFAULT 30,
    allowed_domains TEXT[] DEFAULT ARRAY['api.github.com', 'api.stripe.com', 'api.openai.com', 'api.anthropic.com'],
    blocked_syscalls TEXT[] DEFAULT ARRAY['sys_raw_socket', 'execve', 'unlink', 'rmdir'],
    auto_rollback_on_error BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own security policies"
    ON security_policies FOR ALL
    USING (auth.uid() = user_id);

-- 6. Agent Traces (Audit & Telemetry Log)
CREATE TABLE IF NOT EXISTS agent_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    agent_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    verdict TEXT NOT NULL CHECK (verdict IN ('ALLOWED', 'BLOCKED', 'ROLLED_BACK')),
    reason TEXT,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE agent_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent traces"
    ON agent_traces FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert agent traces"
    ON agent_traces FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 7. Saga Compensations (External API Rollback Registry)
CREATE TABLE IF NOT EXISTS saga_compensations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    original_action TEXT NOT NULL,
    compensating_action TEXT NOT NULL,
    target_service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
    details JSONB DEFAULT '{}'::jsonb,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE saga_compensations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view saga compensations"
    ON saga_compensations FOR SELECT
    USING (true);

-- Trigger to automatically create profile on Auth sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);

    -- Automatically create a default Pro trial subscription
    INSERT INTO public.subscriptions (user_id, status, plan, current_period_end)
    VALUES (new.id, 'active', 'pro', NOW() + INTERVAL '30 days');

    -- Automatically generate a commercial license key
    INSERT INTO public.licenses (user_id, license_key, max_devices, status)
    VALUES (
        new.id, 
        'CHRONOS-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' || 
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 5 FOR 4)) || '-' || 
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 9 FOR 4)),
        5,
        'active'
    );

    -- Automatically create default Security Policy
    INSERT INTO public.security_policies (user_id, name)
    VALUES (new.id, 'Default SafeState Policy');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
