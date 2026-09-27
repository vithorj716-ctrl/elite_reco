REVOKE ALL ON FUNCTION public.fotos_obrigatorias_vistoria() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vistoria_foto_valida(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vistoria_bloqueios_itens(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vistoria_bloqueios_conclusao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vistorias_inconsistentes() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fotos_obrigatorias_vistoria() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vistoria_foto_valida(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vistoria_bloqueios_itens(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vistoria_bloqueios_conclusao(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vistorias_inconsistentes() TO authenticated, service_role;