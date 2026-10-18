CREATE TABLE public.ai_request_limits (user_id uuid NOT NULL, operation text NOT NULL CHECK (operation IN ('extract','generate')), window_start timestamptz NOT NULL, requests integer NOT NULL DEFAULT 0, PRIMARY KEY (user_id, operation, window_start));
GRANT ALL ON public.ai_request_limits TO service_role;
REVOKE ALL ON public.ai_request_limits FROM anon, authenticated;
ALTER TABLE public.ai_request_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only_ai_budget ON public.ai_request_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.consume_ai_request(_user_id uuid, _operation text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE total integer; BEGIN IF _operation NOT IN ('extract','generate') THEN RAISE EXCEPTION 'Invalid operation'; END IF; INSERT INTO public.ai_request_limits(user_id, operation, window_start, requests) VALUES (_user_id, _operation, date_trunc('hour', now()), 1) ON CONFLICT (user_id, operation, window_start) DO UPDATE SET requests = ai_request_limits.requests + 1 RETURNING requests INTO total; RETURN total <= CASE WHEN _operation = 'extract' THEN 20 ELSE 30 END; END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_request(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_request(uuid,text) TO service_role;