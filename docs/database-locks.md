# Database locks

These locks are already applied to project xawdlkjemzpuztyyxtae, as verified by the owner, and are recorded here for operators. This is a reference document, not a migration, and is not wired into Drizzle.

```sql
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, email, full_name) ON public.profiles TO authenticated;
GRANT UPDATE (email, full_name, updated_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_managed_profile_columns() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     AND coalesce(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres','service_role','supabase_admin') THEN
    RAISE EXCEPTION 'subscription_tier is server-managed and cannot be changed from a client session';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     AND coalesce(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres','service_role','supabase_admin') THEN
    RAISE EXCEPTION 'stripe_customer_id is server-managed and cannot be changed from a client session';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_protect_managed_columns BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_managed_profile_columns();

REVOKE INSERT, UPDATE ON public.daily_solves FROM anon, authenticated;
GRANT INSERT (user_id, solve_date) ON public.daily_solves TO authenticated;
DROP POLICY IF EXISTS "Users can update own daily solves" ON public.daily_solves;

CREATE OR REPLACE FUNCTION public.increment_daily_solve() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to record a solve';
  END IF;
  INSERT INTO public.daily_solves (user_id, solve_date, solve_count)
  VALUES (auth.uid(), CURRENT_DATE, 1)
  ON CONFLICT (user_id, solve_date)
  DO UPDATE SET solve_count = public.daily_solves.solve_count + 1, updated_at = now()
  RETURNING solve_count INTO new_count;
  RETURN new_count;
END $$;

REVOKE ALL ON FUNCTION public.increment_daily_solve() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_daily_solve() TO authenticated;

REVOKE ALL ON public.guest_solves FROM anon, authenticated;
DROP POLICY IF EXISTS "Anyone can read guest solves" ON public.guest_solves;
DROP POLICY IF EXISTS "Anyone can insert guest solves" ON public.guest_solves;
DROP POLICY IF EXISTS "Anyone can update guest solves" ON public.guest_solves;
```

Warning: do not re-grant UPDATE on profiles or daily_solves to client roles; the trigger is defense in depth, not a substitute for the grants.