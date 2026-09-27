DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.aceitar_distribuicao(uuid)',
    'public.recusar_distribuicao(uuid, text)',
    'public.definir_auxiliar_distribuicao(uuid, uuid)',
    'public.admin_redistribuir(uuid, uuid, text)',
    'public.admin_alterar_servico(uuid, uuid, text)',
    'public.admin_alterar_valor(uuid, numeric, numeric, text)',
    'public.admin_cancelar_distribuicao(uuid, text)',
    'public.reenviar_notificacao_distribuicao(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;