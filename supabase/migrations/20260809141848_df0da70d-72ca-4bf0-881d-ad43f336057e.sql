GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos TO authenticated;
GRANT ALL ON public.servicos TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.servicos;