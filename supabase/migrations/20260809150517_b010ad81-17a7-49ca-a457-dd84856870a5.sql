REVOKE EXECUTE ON FUNCTION public.notificar_agente(uuid, text, text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notificar_locadora(uuid, text, text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.valor_servico_ordem(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.previa_cancelamento_locadora(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancelar_ordem_locadora(uuid, text, boolean, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.tocar_atualizada_em() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.previa_cancelamento_locadora(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_ordem_locadora(uuid, text, boolean, text) TO authenticated;