CREATE TABLE public.work_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text NOT NULL,
  role_title text NOT NULL DEFAULT '',
  team_structure text NOT NULL DEFAULT '',
  technologies text NOT NULL DEFAULT '',
  software_tools text NOT NULL DEFAULT '',
  additional_details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_experience TO authenticated;
GRANT ALL ON public.work_experience TO service_role;
ALTER TABLE public.work_experience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own work experience" ON public.work_experience FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX work_experience_user_id_idx ON public.work_experience (user_id);
CREATE TRIGGER work_experience_updated_at BEFORE UPDATE ON public.work_experience FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();