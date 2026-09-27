-- ───────────────────────── Tipos ─────────────────────────
CREATE TYPE public.status_vistoria AS ENUM ('pendente','distribuida','em_andamento','concluida','cancelada');
CREATE TYPE public.situacao_moto AS ENUM ('ativa','inativa');

CREATE SEQUENCE IF NOT EXISTS public.vistorias_codigo_seq;

-- ───────────────────────── Motos ─────────────────────────
CREATE TABLE public.motos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id) ON DELETE CASCADE,
  placa text NOT NULL,
  marca text NOT NULL DEFAULT '',
  modelo text NOT NULL DEFAULT '',
  ano text NOT NULL DEFAULT '',
  cor text NOT NULL DEFAULT '',
  chassi text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  situacao public.situacao_moto NOT NULL DEFAULT 'ativa',
  ultima_vistoria_at timestamptz,
  proxima_vistoria_at timestamptz,
  criada_por uuid,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX motos_placa_locadora_uk ON public.motos (upper(placa), locadora_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motos TO authenticated;
GRANT ALL ON public.motos TO service_role;
ALTER TABLE public.motos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motos equipe total" ON public.motos FOR ALL TO authenticated
  USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "motos locadora le" ON public.motos FOR SELECT TO authenticated
  USING (locadora_id = public.locadora_do_usuario(auth.uid()));
CREATE POLICY "motos locadora cadastra" ON public.motos FOR INSERT TO authenticated
  WITH CHECK (locadora_id = public.locadora_do_usuario(auth.uid()));
CREATE POLICY "motos locadora edita" ON public.motos FOR UPDATE TO authenticated
  USING (locadora_id = public.locadora_do_usuario(auth.uid()))
  WITH CHECK (locadora_id = public.locadora_do_usuario(auth.uid()));

-- ─────────────────────── Vistorias ───────────────────────
CREATE TABLE public.vistorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL DEFAULT '',
  moto_id uuid NOT NULL REFERENCES public.motos(id) ON DELETE CASCADE,
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id) ON DELETE CASCADE,
  agente_id uuid REFERENCES public.agentes(id),
  servico_id uuid REFERENCES public.servicos(id),
  status public.status_vistoria NOT NULL DEFAULT 'pendente',
  origem text NOT NULL DEFAULT 'central',
  observacoes text NOT NULL DEFAULT '',
  checklist jsonb,
  motivo_cancelamento text NOT NULL DEFAULT '',
  solicitada_em timestamptz NOT NULL DEFAULT now(),
  solicitada_por uuid,
  distribuida_em timestamptz,
  distribuida_por uuid,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  cancelada_em timestamptz,
  valor_cobranca numeric,
  valor_pagamento numeric,
  tabela_cobranca_id uuid REFERENCES public.tabelas_remuneracao(id),
  tabela_pagamento_id uuid REFERENCES public.tabelas_remuneracao(id),
  recebimento_pago boolean NOT NULL DEFAULT false,
  pagamento_pago boolean NOT NULL DEFAULT false,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vistorias_moto_idx ON public.vistorias (moto_id);
CREATE INDEX vistorias_agente_idx ON public.vistorias (agente_id);
CREATE INDEX vistorias_locadora_idx ON public.vistorias (locadora_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vistorias TO authenticated;
GRANT ALL ON public.vistorias TO service_role;
ALTER TABLE public.vistorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vistorias equipe total" ON public.vistorias FOR ALL TO authenticated
  USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "vistorias locadora le" ON public.vistorias FOR SELECT TO authenticated
  USING (locadora_id = public.locadora_do_usuario(auth.uid()));
CREATE POLICY "vistorias locadora solicita" ON public.vistorias FOR INSERT TO authenticated
  WITH CHECK (locadora_id = public.locadora_do_usuario(auth.uid()));
CREATE POLICY "vistorias agente le" ON public.vistorias FOR SELECT TO authenticated
  USING (agente_id IS NOT NULL AND agente_id = public.agente_do_usuario(auth.uid()));
CREATE POLICY "vistorias agente atualiza" ON public.vistorias FOR UPDATE TO authenticated
  USING (agente_id IS NOT NULL AND agente_id = public.agente_do_usuario(auth.uid()))
  WITH CHECK (agente_id IS NOT NULL AND agente_id = public.agente_do_usuario(auth.uid()));

-- ─────────────── Evidências da vistoria ───────────────
CREATE TABLE public.vistoria_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id uuid NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  moto_id uuid NOT NULL REFERENCES public.motos(id) ON DELETE CASCADE,
  locadora_id uuid NOT NULL REFERENCES public.locadoras(id) ON DELETE CASCADE,
  agente_id uuid REFERENCES public.agentes(id),
  usuario_id uuid,
  tipo text NOT NULL DEFAULT 'foto',
  etapa text NOT NULL DEFAULT 'vistoria',
  nome text NOT NULL DEFAULT '',
  caminho text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT '',
  tamanho bigint NOT NULL DEFAULT 0,
  gps text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  criada_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.vistoria_evidencias TO authenticated;
GRANT ALL ON public.vistoria_evidencias TO service_role;
ALTER TABLE public.vistoria_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evid vistoria equipe" ON public.vistoria_evidencias FOR ALL TO authenticated
  USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "evid vistoria locadora le" ON public.vistoria_evidencias FOR SELECT TO authenticated
  USING (locadora_id = public.locadora_do_usuario(auth.uid()));
CREATE POLICY "evid vistoria agente le" ON public.vistoria_evidencias FOR SELECT TO authenticated
  USING (agente_id IS NOT NULL AND agente_id = public.agente_do_usuario(auth.uid()));
CREATE POLICY "evid vistoria agente envia" ON public.vistoria_evidencias FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vistorias v
     WHERE v.id = vistoria_id AND v.agente_id = public.agente_do_usuario(auth.uid())));

-- ─────────────── Histórico da vistoria ───────────────
CREATE TABLE public.vistoria_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id uuid NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  moto_id uuid REFERENCES public.motos(id) ON DELETE CASCADE,
  quem text NOT NULL DEFAULT '',
  quando timestamptz NOT NULL DEFAULT now(),
  acao text NOT NULL,
  detalhe text NOT NULL DEFAULT '',
  gps text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT ON public.vistoria_historico TO authenticated;
GRANT ALL ON public.vistoria_historico TO service_role;
ALTER TABLE public.vistoria_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hist vistoria equipe" ON public.vistoria_historico FOR ALL TO authenticated
  USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE POLICY "hist vistoria le" ON public.vistoria_historico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vistorias v WHERE v.id = vistoria_id
    AND (v.locadora_id = public.locadora_do_usuario(auth.uid())
         OR v.agente_id = public.agente_do_usuario(auth.uid()))));
CREATE POLICY "hist vistoria escreve" ON public.vistoria_historico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vistorias v WHERE v.id = vistoria_id
    AND (v.locadora_id = public.locadora_do_usuario(auth.uid())
         OR v.agente_id = public.agente_do_usuario(auth.uid()))));

-- ─────────────── Avisos ligados à vistoria ───────────────
ALTER TABLE public.notificacoes ADD COLUMN vistoria_id uuid REFERENCES public.vistorias(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.notificar_equipe(_tipo text, _titulo text, _mensagem text, _vistoria_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, vistoria_id)
  SELECT ur.user_id, _tipo, _titulo, _mensagem, _vistoria_id
    FROM public.user_roles ur
   WHERE ur.role IN ('super_admin','operador');
$$;

CREATE OR REPLACE FUNCTION public.notificar_agente_vistoria(_agente_id uuid, _tipo text, _titulo text, _mensagem text, _vistoria_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, vistoria_id)
  SELECT p.id, _tipo, _titulo, _mensagem, _vistoria_id
    FROM public.profiles p
   WHERE _agente_id IS NOT NULL AND p.agente_id = _agente_id;
$$;

CREATE OR REPLACE FUNCTION public.notificar_locadora_vistoria(_locadora_id uuid, _tipo text, _titulo text, _mensagem text, _vistoria_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, vistoria_id)
  SELECT p.id, _tipo, _titulo, _mensagem, _vistoria_id
    FROM public.profiles p
   WHERE _locadora_id IS NOT NULL AND p.locadora_id = _locadora_id;
$$;

-- ─────────────── Regras da moto ───────────────
CREATE OR REPLACE FUNCTION public.motos_regras()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_loc text;
BEGIN
  NEW.placa := upper(btrim(NEW.placa));
  IF NEW.placa = '' THEN RAISE EXCEPTION 'A placa é obrigatória'; END IF;
  IF TG_OP = 'UPDATE' THEN NEW.atualizado_em := now(); END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER motos_regras_trg BEFORE INSERT OR UPDATE ON public.motos
  FOR EACH ROW EXECUTE FUNCTION public.motos_regras();

CREATE OR REPLACE FUNCTION public.motos_avisos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_loc text;
BEGIN
  IF NOT public.equipe(auth.uid()) THEN
    SELECT nome INTO v_loc FROM public.locadoras WHERE id = NEW.locadora_id;
    PERFORM public.notificar_equipe('operacional', 'Nova moto cadastrada',
      coalesce(v_loc,'Locadora') || ' • ' || NEW.placa, NULL);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER motos_avisos_trg AFTER INSERT ON public.motos
  FOR EACH ROW EXECUTE FUNCTION public.motos_avisos();

-- ─────────────── Regras da vistoria ───────────────
CREATE OR REPLACE FUNCTION public.vistorias_regras()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_equipe boolean := public.equipe(auth.uid());
  v_agente uuid := public.agente_do_usuario(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
      NEW.codigo := 'VS-' || lpad(nextval('public.vistorias_codigo_seq')::text, 5, '0');
    END IF;
    IF NOT v_equipe THEN
      NEW.status := 'pendente';
      NEW.agente_id := NULL;
      NEW.valor_cobranca := NULL;
      NEW.valor_pagamento := NULL;
      NEW.recebimento_pago := false;
      NEW.pagamento_pago := false;
    END IF;
    NEW.solicitada_por := coalesce(NEW.solicitada_por, auth.uid());
    RETURN NEW;
  END IF;

  NEW.atualizado_em := now();

  IF OLD.status = 'concluida' AND NOT v_equipe THEN
    RAISE EXCEPTION 'Vistoria concluída não pode ser alterada';
  END IF;

  IF NOT v_equipe AND v_agente IS NOT NULL THEN
    IF NEW.agente_id IS DISTINCT FROM OLD.agente_id
       OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
       OR NEW.moto_id IS DISTINCT FROM OLD.moto_id
       OR NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
       OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'O agente não pode alterar dados de distribuição ou financeiros';
    END IF;
    IF NEW.status NOT IN ('em_andamento','concluida') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'O agente só pode iniciar e concluir a vistoria';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pendente'     AND NEW.status IN ('distribuida','cancelada'))
      OR (OLD.status = 'distribuida'  AND NEW.status IN ('em_andamento','pendente','cancelada'))
      OR (OLD.status = 'em_andamento' AND NEW.status IN ('concluida','pendente','cancelada'))
      OR (OLD.status = 'cancelada'    AND NEW.status = 'pendente')
    ) THEN
      RAISE EXCEPTION 'Transição de situação inválida: % para %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'distribuida' THEN
      IF NEW.agente_id IS NULL THEN RAISE EXCEPTION 'Escolha um agente para distribuir a vistoria'; END IF;
      NEW.distribuida_em := coalesce(NEW.distribuida_em, now());
      NEW.distribuida_por := coalesce(NEW.distribuida_por, auth.uid());
      NEW.iniciada_em := NULL; NEW.concluida_em := NULL; NEW.cancelada_em := NULL;
    ELSIF NEW.status = 'em_andamento' THEN
      IF NOT v_equipe AND (NEW.agente_id IS NULL OR NEW.agente_id <> v_agente) THEN
        RAISE EXCEPTION 'Somente o agente responsável pode iniciar esta vistoria';
      END IF;
      NEW.iniciada_em := coalesce(NEW.iniciada_em, now());
    ELSIF NEW.status = 'concluida' THEN
      IF NEW.iniciada_em IS NULL THEN RAISE EXCEPTION 'Inicie a vistoria antes de concluí-la'; END IF;
      NEW.concluida_em := coalesce(NEW.concluida_em, now());
    ELSIF NEW.status = 'cancelada' THEN
      IF btrim(coalesce(NEW.motivo_cancelamento,'')) = '' THEN
        RAISE EXCEPTION 'Informe o motivo do cancelamento';
      END IF;
      NEW.cancelada_em := now();
    ELSIF NEW.status = 'pendente' THEN
      NEW.agente_id := NULL;
      NEW.distribuida_em := NULL; NEW.iniciada_em := NULL;
      NEW.concluida_em := NULL; NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER vistorias_regras_trg BEFORE INSERT OR UPDATE ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION public.vistorias_regras();

CREATE OR REPLACE FUNCTION public.vistorias_efeitos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_placa text; v_loc text; v_resumo text;
BEGIN
  SELECT m.placa INTO v_placa FROM public.motos m WHERE m.id = NEW.moto_id;
  SELECT l.nome INTO v_loc FROM public.locadoras l WHERE l.id = NEW.locadora_id;
  v_resumo := coalesce(v_loc,'Locadora') || ' • ' || coalesce(v_placa,'moto');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.vistoria_historico (vistoria_id, moto_id, quem, acao, detalhe)
    VALUES (NEW.id, NEW.moto_id,
            coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()),'Sistema'),
            'Vistoria solicitada', v_resumo);
    IF NOT public.equipe(auth.uid()) THEN
      PERFORM public.notificar_equipe('operacional','Nova vistoria solicitada', v_resumo, NEW.id);
    END IF;
    PERFORM public.notificar_locadora_vistoria(NEW.locadora_id,'operacional','Solicitação de vistoria registrada', v_resumo, NEW.id);
    RETURN NEW;
  END IF;

  IF NEW.agente_id IS NOT NULL
     AND (NEW.agente_id IS DISTINCT FROM OLD.agente_id
          OR (NEW.status = 'distribuida' AND OLD.status IS DISTINCT FROM 'distribuida')) THEN
    PERFORM public.notificar_agente_vistoria(NEW.agente_id,'nova_ordem','Nova vistoria atribuída', v_resumo, NEW.id);
    INSERT INTO public.vistoria_historico (vistoria_id, moto_id, quem, acao, detalhe)
    VALUES (NEW.id, NEW.moto_id,
            coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()),'Central'),
            CASE WHEN OLD.agente_id IS NULL THEN 'Vistoria distribuída' ELSE 'Vistoria reatribuída' END,
            coalesce((SELECT nome FROM public.agentes WHERE id = NEW.agente_id),''));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.vistoria_historico (vistoria_id, moto_id, quem, acao, detalhe)
    VALUES (NEW.id, NEW.moto_id,
            coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()),'Sistema'),
            'Situação: ' || NEW.status::text, coalesce(nullif(NEW.motivo_cancelamento,''), v_resumo));
  END IF;

  IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM 'concluida' THEN
    UPDATE public.motos
       SET ultima_vistoria_at = NEW.concluida_em,
           proxima_vistoria_at = NEW.concluida_em + interval '40 days',
           atualizado_em = now()
     WHERE id = NEW.moto_id;
    PERFORM public.notificar_locadora_vistoria(NEW.locadora_id,'status','Vistoria concluída', v_resumo, NEW.id);
    PERFORM public.notificar_equipe('status','Vistoria concluída', v_resumo, NEW.id);
  END IF;

  IF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN
    PERFORM public.notificar_locadora_vistoria(NEW.locadora_id,'cancelamento','Vistoria cancelada', v_resumo, NEW.id);
    IF OLD.agente_id IS NOT NULL THEN
      PERFORM public.notificar_agente_vistoria(OLD.agente_id,'cancelamento','Vistoria cancelada', v_resumo, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER vistorias_efeitos_trg AFTER INSERT OR UPDATE ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION public.vistorias_efeitos();

-- ─────────────── Serviço no catálogo existente ───────────────
INSERT INTO public.servicos (codigo, nome, descricao, unidade, ativo, posicao)
SELECT 'vistoria_moto', 'Vistoria de Moto', 'Vistoria periódica de motocicleta (ciclo de 40 dias).', 'fixo', true,
       coalesce((SELECT max(posicao) + 1 FROM public.servicos), 1)
WHERE NOT EXISTS (SELECT 1 FROM public.servicos WHERE codigo = 'vistoria_moto');

-- ─────────────── Realtime ───────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.motos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vistorias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vistoria_evidencias;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vistoria_historico;