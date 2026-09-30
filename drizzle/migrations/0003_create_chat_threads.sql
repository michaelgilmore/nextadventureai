CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own threads select" ON public.chat_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own threads insert" ON public.chat_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own threads update" ON public.chat_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own threads delete" ON public.chat_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX chat_threads_user_updated ON public.chat_threads (user_id, updated_at DESC);