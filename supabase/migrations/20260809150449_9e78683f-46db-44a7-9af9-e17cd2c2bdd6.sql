-- =============== NOTIFICAÇÕES ===============
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'operacional',
  titulo text NOT NULL,
  mensagem text NOT NULL DEFAULT '',
  ordem_id uuid REFERENCES public.ordens(id) ON DELETE CASCADE,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  lida boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  entregue_em timestamptz,
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notificacoes_usuario_idx ON public.notificacoes (usuario_id, criada_em DESC);
CREATE INDEX notificacoes_pendentes_idx ON public.notificacoes (entregue_em) WHERE entregue_em IS NULL;

GRANT SELECT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_select_proprias" ON public.notificacoes
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "notificacoes_update_proprias" ON public.notificacoes
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "notificacoes_delete_proprias" ON public.notificacoes
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());

-- =============== PUSH SUBSCRIPTIONS ===============
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  dispositivo text NOT NULL DEFAULT '',
  navegador text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_usuario_idx ON public.push_subscriptions (usuario_id) WHERE ativo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_proprias_select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "push_proprias_insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "push_proprias_update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "push_proprias_delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());

CREATE TRIGGER push_subscriptions_atualizada
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

-- tocar_atualizado_em usa NEW.atualizado_em; esta tabela usa atualizada_em
CREATE OR REPLACE FUNCTION public.tocar_atualizada_em()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.atualizada_em = now(); RETURN NEW; END; $$;

DROP TRIGGER push_subscriptions_atualizada ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_atualizada
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizada_em();

-- =============== CANCELAMENTOS COM TAXA ===============
CREATE TABLE public.cancelamentos_ordem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL UNIQUE REFERENCES public.ordens(id) ON DELETE CASCADE,
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id),
  usuario_id uuid,
  valor_original numeric NOT NULL DEFAULT 0,
  percentual_cobranca numeric NOT NULL DEFAULT 0,
  valor_cobranca numeric NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT '',
  aceite_cobranca boolean NOT NULL DEFAULT false,
  texto_aceite text NOT NULL DEFAULT '',
  aceito_em timestamptz,
  cancelado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cancelamentos_ordem TO authenticated;
GRANT ALL ON public.cancelamentos_ordem TO service_role;
ALTER TABLE public.cancelamentos_ordem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cancelamentos_select" ON public.cancelamentos_ordem
  FOR SELECT TO authenticated
  USING (public.equipe(auth.uid()) OR locadora_id = public.locadora_do_usuario(auth.uid()));

-- =============== GERAÇÃO DE NOTIFICAÇÕES ===============
CREATE OR REPLACE FUNCTION public.notificar_agente(
  _agente_id uuid, _tipo text, _titulo text, _mensagem text, _ordem_id uuid
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, ordem_id)
  SELECT p.id, _tipo, _titulo, _mensagem, _ordem_id
    FROM public.profiles p
   WHERE _agente_id IS NOT NULL AND p.agente_id = _agente_id;
$$;

CREATE OR REPLACE FUNCTION public.notificar_locadora(
  _locadora_id uuid, _tipo text, _titulo text, _mensagem text, _ordem_id uuid
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, ordem_id)
  SELECT p.id, _tipo, _titulo, _mensagem, _ordem_id
    FROM public.profiles p
   WHERE _locadora_id IS NOT NULL AND p.locadora_id = _locadora_id;
$$;

CREATE OR REPLACE FUNCTION public.ordens_notificacoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_resumo text;
  v_loc text;
BEGIN
  SELECT nome INTO v_loc FROM public.locadoras WHERE id = NEW.locadora_id;
  v_resumo := coalesce(v_loc, 'Locadora') || ' • ' || NEW.placa ||
              ' • ' || coalesce(nullif(NEW.cidade, ''), 'cidade não informada');

  IF TG_OP = 'UPDATE' THEN
    -- nova distribuição para o agente principal
    IF NEW.agente_id IS NOT NULL
       AND (NEW.agente_id IS DISTINCT FROM OLD.agente_id
            OR (NEW.status = 'distribuida' AND OLD.status IS DISTINCT FROM 'distribuida')) THEN
      PERFORM public.notificar_agente(NEW.agente_id, 'nova_ordem',
        'Nova solicitação de recolhimento', v_resumo, NEW.id);
    END IF;

    IF NEW.agente_auxiliar_id IS NOT NULL
       AND NEW.agente_auxiliar_id IS DISTINCT FROM OLD.agente_auxiliar_id THEN
      PERFORM public.notificar_agente(NEW.agente_auxiliar_id, 'nova_ordem',
        'Você entrou como apoio em um recolhimento', v_resumo, NEW.id);
    END IF;

    IF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN
      PERFORM public.notificar_agente(coalesce(NEW.agente_id, OLD.agente_id), 'cancelamento',
        'Recolhimento cancelado', v_resumo ||
        coalesce(' — ' || nullif(NEW.motivo_cancelamento, ''), ''), NEW.id);
      PERFORM public.notificar_locadora(NEW.locadora_id, 'cancelamento',
        'Solicitação cancelada', v_resumo, NEW.id);
    END IF;

    IF NEW.iniciada_em IS NOT NULL AND OLD.iniciada_em IS NULL THEN
      PERFORM public.notificar_locadora(NEW.locadora_id, 'status',
        'Deslocamento iniciado', v_resumo, NEW.id);
    END IF;

    IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida' THEN
      PERFORM public.notificar_locadora(NEW.locadora_id, 'status',
        'Recolhimento concluído', v_resumo, NEW.id);
    END IF;

    -- alterações relevantes em ordem já atribuída
    IF NEW.agente_id IS NOT NULL AND NEW.agente_id = OLD.agente_id
       AND NEW.status NOT IN ('cancelada','concluida')
       AND (NEW.endereco IS DISTINCT FROM OLD.endereco
            OR NEW.placa IS DISTINCT FROM OLD.placa
            OR NEW.prioridade IS DISTINCT FROM OLD.prioridade
            OR NEW.observacoes IS DISTINCT FROM OLD.observacoes) THEN
      PERFORM public.notificar_agente(NEW.agente_id, 'alteracao',
        'Ordem alterada', v_resumo, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ordens_notificacoes_trg
  AFTER UPDATE ON public.ordens
  FOR EACH ROW EXECUTE FUNCTION public.ordens_notificacoes();

-- =============== TAXA DE CANCELAMENTO (LOCADORA) ===============
CREATE OR REPLACE FUNCTION public.valor_servico_ordem(_ordem_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  o public.ordens%ROWTYPE;
  v_tabela uuid;
  v_valor numeric := 0;
  v_unidade text := 'fixo';
  v_cobrancas numeric := 0;
BEGIN
  SELECT * INTO o FROM public.ordens WHERE id = _ordem_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF o.valor_cobranca IS NOT NULL AND o.valor_cobranca > 0 THEN
    RETURN o.valor_cobranca;
  END IF;

  SELECT tabela_cobranca_id INTO v_tabela FROM public.locadoras WHERE id = o.locadora_id;
  IF v_tabela IS NOT NULL AND o.servico_id IS NOT NULL THEN
    SELECT i.valor, i.unidade INTO v_valor, v_unidade
      FROM public.itens_remuneracao i
     WHERE i.tabela_id = v_tabela AND i.servico_id = o.servico_id AND i.ativo
     ORDER BY i.posicao LIMIT 1;
  END IF;

  v_valor := coalesce(v_valor, 0);
  IF v_unidade = 'km' THEN
    v_valor := v_valor * greatest(coalesce(o.quantidade_km, 0), 0);
  END IF;

  IF v_valor = 0 THEN
    SELECT coalesce(sum(c.valor), 0) INTO v_cobrancas
      FROM public.ordem_cobrancas c WHERE c.ordem_id = _ordem_id;
    v_valor := v_cobrancas;
  END IF;

  RETURN coalesce(v_valor, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.previa_cancelamento_locadora(_ordem_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  o public.ordens%ROWTYPE;
  v_loc uuid := public.locadora_do_usuario(auth.uid());
  v_valor numeric;
  v_iniciado boolean;
BEGIN
  SELECT * INTO o FROM public.ordens WHERE id = _ordem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
  IF v_loc IS NULL OR o.locadora_id <> v_loc THEN
    RAISE EXCEPTION 'Esta solicitação não pertence à sua locadora';
  END IF;

  v_iniciado := o.iniciada_em IS NOT NULL AND o.status NOT IN ('concluida','cancelada');
  v_valor := public.valor_servico_ordem(_ordem_id);

  RETURN jsonb_build_object(
    'deslocamento_iniciado', v_iniciado,
    'valor_original', v_valor,
    'percentual', CASE WHEN v_iniciado THEN 50 ELSE 0 END,
    'valor_cobranca', CASE WHEN v_iniciado THEN round(v_valor * 0.5, 2) ELSE 0 END,
    'ja_cancelada', o.status = 'cancelada',
    'iniciada_em', o.iniciada_em
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_ordem_locadora(
  _ordem_id uuid, _motivo text DEFAULT '', _aceite boolean DEFAULT false, _texto_aceite text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  o public.ordens%ROWTYPE;
  v_loc uuid := public.locadora_do_usuario(auth.uid());
  v_iniciado boolean;
  v_valor numeric := 0;
  v_taxa numeric := 0;
  v_pct numeric := 0;
BEGIN
  SELECT * INTO o FROM public.ordens WHERE id = _ordem_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
  IF v_loc IS NULL OR o.locadora_id <> v_loc THEN
    RAISE EXCEPTION 'Esta solicitação não pertence à sua locadora';
  END IF;
  IF o.status = 'cancelada' THEN RAISE EXCEPTION 'Esta solicitação já está cancelada'; END IF;
  IF o.status = 'concluida' THEN RAISE EXCEPTION 'Recolhimento concluído não pode ser cancelado'; END IF;
  IF o.recebimento_pago OR o.pagamento_pago THEN
    RAISE EXCEPTION 'Ordem já faturada: fale com a central';
  END IF;

  v_iniciado := o.iniciada_em IS NOT NULL;

  IF v_iniciado THEN
    IF NOT _aceite THEN
      RAISE EXCEPTION 'É obrigatório aceitar a cobrança de 50%% para cancelar após o início do deslocamento';
    END IF;
    v_valor := public.valor_servico_ordem(_ordem_id);
    v_pct := 50;
    v_taxa := round(v_valor * 0.5, 2);

    INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
    VALUES (_ordem_id, coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Locadora'),
            'Taxa de cancelamento apresentada',
            'Valor do serviço ' || to_char(v_valor, 'FM999999990.00') ||
            ' • taxa 50% = ' || to_char(v_taxa, 'FM999999990.00'));

    -- a cobrança precisa ser lançada antes do cancelamento (gatilho de cobranças)
    IF v_taxa > 0 THEN
      INSERT INTO public.ordem_cobrancas (ordem_id, locadora_id, nome, valor, observacao, criado_por)
      VALUES (_ordem_id, o.locadora_id,
              'Taxa de cancelamento após início do deslocamento', v_taxa,
              'Cobrança de 50% aceita pela locadora no cancelamento.', auth.uid());
    END IF;
  END IF;

  -- registro único por ordem: garante idempotência da cobrança
  INSERT INTO public.cancelamentos_ordem (
    ordem_id, locadora_id, usuario_id, valor_original, percentual_cobranca,
    valor_cobranca, motivo, aceite_cobranca, texto_aceite, aceito_em
  ) VALUES (
    _ordem_id, o.locadora_id, auth.uid(), v_valor, v_pct, v_taxa,
    coalesce(_motivo, ''), v_iniciado AND _aceite, coalesce(_texto_aceite, ''),
    CASE WHEN v_iniciado AND _aceite THEN now() ELSE NULL END
  );

  IF v_iniciado THEN
    INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
    VALUES (_ordem_id, coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Locadora'),
            'Taxa de cancelamento aceita', coalesce(_texto_aceite, ''));
  END IF;

  UPDATE public.ordens
     SET status = 'cancelada', motivo_cancelamento = coalesce(_motivo, '')
   WHERE id = _ordem_id;

  INSERT INTO public.ordem_historico (ordem_id, quem, acao, detalhe)
  VALUES (_ordem_id, coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Locadora'),
          'Cancelamento concluído', coalesce(nullif(_motivo, ''), 'sem motivo informado'));

  RETURN jsonb_build_object(
    'valor_original', v_valor, 'percentual', v_pct, 'valor_cobranca', v_taxa,
    'deslocamento_iniciado', v_iniciado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_ordem_locadora(uuid, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancelar_ordem_locadora(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.previa_cancelamento_locadora(uuid) TO authenticated;

-- =============== REALTIME ===============
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cancelamentos_ordem;
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;