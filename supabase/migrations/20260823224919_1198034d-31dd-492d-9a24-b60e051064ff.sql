CREATE OR REPLACE FUNCTION public.servicos_do_agente()
RETURNS TABLE (servico_id uuid, codigo text, nome text, valor numeric, aceita boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agente uuid := public.agente_do_usuario(auth.uid());
BEGIN
  IF v_agente IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT s.id, s.codigo, s.nome,
           public.valor_tabela_servico(NULL::uuid, s.id, 'pagamento'),
           public.agente_aceita_servico(v_agente, s.id)
      FROM public.servicos s
     WHERE s.ativo
     ORDER BY s.posicao, s.nome;
END; $$;

REVOKE EXECUTE ON FUNCTION public.servicos_do_agente() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.servicos_do_agente() TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_servico_aceito(_servico uuid, _aceita boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agente uuid := public.agente_do_usuario(auth.uid());
BEGIN
  IF v_agente IS NULL THEN RAISE EXCEPTION 'Usuário não é um agente de campo'; END IF;
  INSERT INTO public.agente_servicos (agente_id, servico_id, aceita)
  VALUES (v_agente, _servico, _aceita)
  ON CONFLICT (agente_id, servico_id)
  DO UPDATE SET aceita = EXCLUDED.aceita, atualizado_em = now();

  IF _aceita THEN
    PERFORM public.processar_fila_distribuicao();
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.definir_servico_aceito(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.definir_servico_aceito(uuid, boolean) TO authenticated;