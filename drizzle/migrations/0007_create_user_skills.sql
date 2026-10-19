CREATE TABLE public.user_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  skill_key text NOT NULL,
  label text NOT NULL,
  level smallint NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
  target_level smallint NOT NULL DEFAULT 3 CHECK (target_level BETWEEN 0 AND 5),
  improvement_plan text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skills TO authenticated;
GRANT ALL ON public.user_skills TO service_role;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own skills" ON public.user_skills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_skills_updated_at BEFORE UPDATE ON public.user_skills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.skill_level_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  skill_id uuid NOT NULL REFERENCES public.user_skills(id) ON DELETE CASCADE,
  level smallint NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.skill_level_history TO authenticated;
GRANT ALL ON public.skill_level_history TO service_role;
ALTER TABLE public.skill_level_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own skill history" ON public.skill_level_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX skill_level_history_skill_idx ON public.skill_level_history (skill_id, recorded_at);

CREATE OR REPLACE FUNCTION public.log_skill_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.level IS DISTINCT FROM OLD.level THEN
    INSERT INTO public.skill_level_history (user_id, skill_id, level) VALUES (NEW.user_id, NEW.id, NEW.level);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_skills_log_level AFTER INSERT OR UPDATE ON public.user_skills FOR EACH ROW EXECUTE FUNCTION public.log_skill_level();