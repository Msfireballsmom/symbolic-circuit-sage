
-- Daily solve tracking table
CREATE TABLE public.daily_solves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  solve_date date NOT NULL DEFAULT CURRENT_DATE,
  solve_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, solve_date)
);

ALTER TABLE public.daily_solves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily solves"
ON public.daily_solves FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily solves"
ON public.daily_solves FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily solves"
ON public.daily_solves FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Guest solve tracking (by fingerprint/IP, no auth required)
CREATE TABLE public.guest_solves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_solves ENABLE ROW LEVEL SECURITY;

-- Guests can read/insert via anon key
CREATE POLICY "Anyone can read guest solves"
ON public.guest_solves FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can insert guest solves"
ON public.guest_solves FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update guest solves"
ON public.guest_solves FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);
