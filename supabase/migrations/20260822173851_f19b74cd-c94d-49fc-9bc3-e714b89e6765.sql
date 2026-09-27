CREATE OR REPLACE FUNCTION public.presenca_valida(_visto timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _visto IS NOT NULL AND _visto > now() - interval '90 seconds'
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_presenca(boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.agente_disponivel(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.agente_ocupado(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agente_disponivel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agente_ocupado(uuid) TO authenticated;