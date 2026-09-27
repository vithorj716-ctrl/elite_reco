revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.equipe(uuid) from public, anon;
revoke execute on function public.locadora_do_usuario(uuid) from public, anon;
revoke execute on function public.agente_do_usuario(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.equipe(uuid) to authenticated, service_role;
grant execute on function public.locadora_do_usuario(uuid) to authenticated, service_role;
grant execute on function public.agente_do_usuario(uuid) to authenticated, service_role;