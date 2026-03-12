
-- 1. User roles table for secure admin access
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can read roles, users can read their own
CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Benchmark audit logging table
CREATE TABLE public.benchmark_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  run_type text NOT NULL DEFAULT 'full',
  total_tests integer NOT NULL,
  passed integer NOT NULL,
  failed integer NOT NULL,
  errors integer NOT NULL,
  accuracy numeric NOT NULL,
  duration_ms integer NOT NULL,
  results jsonb NOT NULL DEFAULT '[]',
  solver_version text NOT NULL DEFAULT 'v4.0',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.benchmark_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert benchmark runs"
ON public.benchmark_runs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read benchmark runs"
ON public.benchmark_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
