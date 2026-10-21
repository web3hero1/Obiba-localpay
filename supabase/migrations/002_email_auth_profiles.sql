-- ==============================================================================
-- OBIBA EMAIL AUTHENTICATION & PROFILES MIGRATION (PRD §8)
-- Links Supabase Auth to customer financial profile with Row-Level Security
-- ==============================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT 'GH',
    onboarding_completed BOOLEAN NOT NULL DEFAULT true,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' 
        CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED', 'RESTRICTED', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for phone queries
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);

-- 2. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can view their own profile only
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Policy 2: Authenticated users can update permitted fields in their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    -- Prevent browser client from modifying privileged attributes
    AND verification_status = (SELECT verification_status FROM public.profiles WHERE id = auth.uid())
);

-- Policy 3: Allow service_role to manage all profiles
CREATE POLICY "Service role has full access to profiles" 
ON public.profiles 
FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);

-- 3. AUTOMATIC PROFILE CREATION TRIGGER ON AUTH.USERS INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        phone_number,
        country_code,
        onboarding_completed,
        verification_status
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Obiba Member'),
        COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
        COALESCE(NEW.raw_user_meta_data->>'country_code', 'GH'),
        true,
        'UNVERIFIED'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. FUNCTION FOR UPDATED_AT TIMESTAMP
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
