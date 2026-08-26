-- ============================================================================
-- TSP SYSTEM PRODUCTION MIGRATION: AUTHORITATIVE POSTGRESQL PROFILES & RLS
-- ============================================================================

-- 1. Create authoritative profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    department TEXT NOT NULL DEFAULT 'General Department',
    designation TEXT NOT NULL DEFAULT 'Officer',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique indexes for username and email
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- 2. Non-recursive SECURITY DEFINER helper function for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role, status 
  INTO v_role, v_status
  FROM public.profiles
  WHERE auth_user_id = auth.uid();

  RETURN (v_role = 'admin' AND v_status = 'active');
END;
$$;

-- Grant execution to authenticated, service_role, and anon
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- 3. Profile field protection trigger for normal users
CREATE OR REPLACE FUNCTION public.trig_protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If caller is not an active administrator:
  IF NOT public.is_admin() THEN
    -- Block modifications to role
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access Denied: Only administrators can modify user roles.';
    END IF;
    -- Block modifications to auth_user_id
    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
      RAISE EXCEPTION 'Access Denied: auth_user_id cannot be modified.';
    END IF;
    -- Block modifications to user_id
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Access Denied: user_id cannot be modified.';
    END IF;
    -- Block modifications to status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Access Denied: status cannot be modified.';
    END IF;
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trig_protect_profile_fields();

-- 4. Row Level Security Policies on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert profiles" ON public.profiles;
CREATE POLICY "Allow authenticated insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id OR (select public.is_admin()));

DROP POLICY IF EXISTS "Allow authenticated update profiles" ON public.profiles;
CREATE POLICY "Allow authenticated update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id OR (select public.is_admin()))
WITH CHECK (auth.uid() = auth_user_id OR (select public.is_admin()));

DROP POLICY IF EXISTS "Allow admin delete profiles" ON public.profiles;
CREATE POLICY "Allow admin delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING ((select public.is_admin()));

-- 5. Row Level Security Policies on public.materials
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read materials" ON public.materials;
CREATE POLICY "Allow authenticated read materials"
ON public.materials FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow admin insert materials" ON public.materials;
CREATE POLICY "Allow admin insert materials"
ON public.materials FOR INSERT
TO authenticated
WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Allow admin update materials" ON public.materials;
CREATE POLICY "Allow admin update materials"
ON public.materials FOR UPDATE
TO authenticated
USING ((select public.is_admin()))
WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Allow admin delete materials" ON public.materials;
CREATE POLICY "Allow admin delete materials"
ON public.materials FOR DELETE
TO authenticated
USING ((select public.is_admin()));

-- 6. Row Level Security Policies on public.material_usage
ALTER TABLE public.material_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read material_usage" ON public.material_usage;
CREATE POLICY "Allow authenticated read material_usage"
ON public.material_usage FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow admin insert material_usage" ON public.material_usage;
CREATE POLICY "Allow admin insert material_usage"
ON public.material_usage FOR INSERT
TO authenticated
WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Allow admin update material_usage" ON public.material_usage;
CREATE POLICY "Allow admin update material_usage"
ON public.material_usage FOR UPDATE
TO authenticated
USING ((select public.is_admin()))
WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "Allow admin delete material_usage" ON public.material_usage;
CREATE POLICY "Allow admin delete material_usage"
ON public.material_usage FOR DELETE
TO authenticated
USING ((select public.is_admin()));

-- 7. Grant Permissions to roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

GRANT SELECT ON public.materials TO anon;
GRANT SELECT ON public.material_usage TO anon;
GRANT SELECT ON public.profiles TO anon;

-- 8. Idempotent migration seed for existing verified TSP users
INSERT INTO public.profiles (id, auth_user_id, user_id, username, name, email, role, department, designation, status)
VALUES
  ('usr_admin_01', '51bb5452-75de-498e-8eed-0fdebee074c1', 'USER-001', 'jalel', 'Engr. Jalel Ahmed', 'admin@tsp.gov.bd', 'admin', 'Electrical Maintenance', 'Executive Engineer (Electrical)', 'active'),
  ('usr_normal_02', 'f84070f5-ce06-4091-88b4-8caadf6ab5ec', 'USER-002', 'rubel', 'Md. Rubel Hossain', 'rubelctg1237@gmail.com', 'admin', 'Electrical Maintenance', 'Assistant Engineer (Electrical)', 'active'),
  ('usr_normal_03', '2c00c5dc-865e-42a4-9ecc-72aad792a065', 'USER-003', 'kamrul', 'Kamrul Islam', 'kamrul@tsp.gov.bd', 'user', 'Mechanical Division', 'Sub-Assistant Engineer', 'active'),
  ('usr_normal_04', '88c5b326-79e0-423e-aab6-31df033b0553', 'USER-004', 'nasir', 'Nasir Uddin', 'nasir.store@tsp.gov.bd', 'user', 'Store & Inventory (ভান্ডার)', 'Store Officer', 'active'),
  ('usr_1787566471331_0axp', '48456601-fde6-469b-b16c-6745fd221c8f', 'USER-005', 'vancot.payroll', 'vancot.payroll', 'vancot.payroll@shinshingroup.com', 'user', 'General Department', 'Officer', 'active'),
  ('usr_1787569034517_czd4', 'f820ac82-3daf-4791-9a50-f349294ca2c7', 'USER-006', 'rubelctg', 'rubelctg123@yahoo.com', 'rubelctg123@yahoo.com', 'user', 'Electrical Maintenance', 'Officer', 'active'),
  ('usr_1787570322542_isst', '94db5d87-be51-4ebd-86ab-3c9b343c76d6', 'USER-007', 'okk', 'ok@gov.com', 'ok@gov.com', 'user', 'Electrical Maintenance', 'Officer', 'active')
ON CONFLICT (id) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  user_id = EXCLUDED.user_id,
  username = EXCLUDED.username,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  designation = EXCLUDED.designation,
  status = EXCLUDED.status,
  updated_at = NOW();
