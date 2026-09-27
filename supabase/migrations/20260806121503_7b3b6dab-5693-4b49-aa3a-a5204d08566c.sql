ALTER TABLE public.auditoria REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auditoria;