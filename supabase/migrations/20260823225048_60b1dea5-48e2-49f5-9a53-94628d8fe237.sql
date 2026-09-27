CREATE OR REPLACE FUNCTION public.registrar_presenca(_online boolean DEFAULT true)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agente uuid; v_quando timestamptz;
BEGIN
  v_agente := public.agente_do_usuario(auth.uid());
  IF v_agente IS NULL THEN RAISE EXCEPTION 'Usuário não é um agente de campo'; END IF;

  UPDATE public.agentes
     SET online = _online,
         visto_em = CASE WHEN _online THEN now() ELSE visto_em END
   WHERE id = v_agente
   RETURNING visto_em INTO v_quando;

  -- Com fila pendente, todo sinal de presença é uma chance de distribuir.
  IF _online AND EXISTS (
       SELECT 1 FROM public.distribuicoes
        WHERE status IN ('aguardando_distribuicao','recusada') AND agente_id IS NULL
     ) THEN
    PERFORM public.processar_fila_distribuicao();
  END IF;

  RETURN v_quando;
END; $$;