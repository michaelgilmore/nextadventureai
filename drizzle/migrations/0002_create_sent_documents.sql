CREATE TABLE public.sent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('resume','cover_letter')),
  file_name text,
  content_text text NOT NULL,
  include_in_future boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sent_documents TO authenticated;
GRANT ALL ON public.sent_documents TO service_role;
ALTER TABLE public.sent_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sent documents" ON public.sent_documents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sent_documents_updated_at BEFORE UPDATE ON public.sent_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();