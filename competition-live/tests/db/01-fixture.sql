-- CI-only mock of the *existing* comp26 schema. No real team names, keys or production data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.comp26_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  event_day date NOT NULL,
  current_round integer NOT NULL DEFAULT 1,
  phase text NOT NULL DEFAULT 'upcoming',
  awards_revealed boolean NOT NULL DEFAULT false,
  active_retry_team uuid,
  announcement text NOT NULL DEFAULT '测试赛事',
  round_started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.comp26_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.comp26_events(id),
  draw_order integer NOT NULL,
  name text NOT NULL,
  round_no integer,
  lane text,
  score numeric,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 1,
  tie_order integer,
  note text,
  scored_at timestamptz,
  UNIQUE(event_id,draw_order),
  UNIQUE(event_id,name)
);
CREATE TABLE public.comp26_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.comp26_events(id),
  role text NOT NULL,
  secret_hash text NOT NULL UNIQUE
);
CREATE TABLE public.comp26_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor_role text NOT NULL,
  action text NOT NULL,
  team_id uuid,
  before_data jsonb,
  after_data jsonb
);
CREATE TABLE public.comp26_reset_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_role text NOT NULL DEFAULT 'admin',
  event_data jsonb NOT NULL,
  teams_data jsonb NOT NULL,
  scored_count integer NOT NULL
);
-- Existing pre-V8 function signatures that are replaced by migration.
CREATE FUNCTION public.comp26_action(
 p_secret text, p_action text,
 p_team_id uuid DEFAULT NULL, p_score numeric DEFAULT NULL,
 p_note text DEFAULT NULL, p_tie integer DEFAULT NULL
) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"stub":true}'::jsonb $$;
CREATE FUNCTION public.comp26_reset(
 p_secret text, p_confirmation text, p_expected_scores integer DEFAULT NULL
) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"stub":true}'::jsonb $$;
ALTER TABLE public.comp26_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp26_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp26_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp26_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp26_reset_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY comp26_read_events ON public.comp26_events FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY comp26_read_teams ON public.comp26_teams FOR SELECT TO anon,authenticated USING (true);
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.comp26_events,public.comp26_teams TO anon,authenticated;
-- Synthetic future event: reset-on-competition-day safeguards are not bypassed.
INSERT INTO public.comp26_events(id,slug,title,event_day)
VALUES ('00000000-0000-4000-8000-000000000001','smart-cart-2026','CI ONLY synthetic competition','2099-11-22');
INSERT INTO public.comp26_teams(event_id,draw_order,name,round_no,lane)
SELECT '00000000-0000-4000-8000-000000000001',
  n,'CI队'||n, (n+1)/2, CASE WHEN n%2=1 THEN 'A' ELSE 'B' END
FROM generate_series(1,36) AS n;
-- Fake credentials used only inside ephemeral PostgreSQL service, NEVER real access codes.
INSERT INTO public.comp26_tokens(event_id,role,secret_hash)
SELECT '00000000-0000-4000-8000-000000000001', role,
  encode(sha256(convert_to('MOVE.ARENA:2026:'||role||':000000','UTF8')),'hex')
FROM (VALUES ('admin'),('judge_a'),('judge_b')) AS roles(role);
