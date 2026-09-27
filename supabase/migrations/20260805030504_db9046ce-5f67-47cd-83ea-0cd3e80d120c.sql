-- ============ 1. COLUNAS NOVAS ============
ALTER TABLE public.ordens
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS valor_cobranca numeric,
  ADD COLUMN IF NOT EXISTS valor_pagamento numeric;

-- ============ 2. CORREÇÕES DE CHECK / VALORES ============
ALTER TABLE public.precos DROP CONSTRAINT IF EXISTS precos_escopo_check;
ALTER TABLE public.precos ADD CONSTRAINT precos_escopo_check
  CHECK (escopo IN ('locadora','agente','pagamento'));

ALTER TABLE public.precos DROP CONSTRAINT IF EXISTS precos_valor_check;
ALTER TABLE public.precos ADD CONSTRAINT precos_valor_check CHECK (valor >= 0);

ALTER TABLE public.itens_remuneracao DROP CONSTRAINT IF EXISTS itens_remuneracao_valor_check;
ALTER TABLE public.itens_remuneracao ADD CONSTRAINT itens_remuneracao_valor_check CHECK (valor >= 0);

ALTER TABLE public.lancamentos_agente DROP CONSTRAINT IF EXISTS lancamentos_agente_valor_check;
ALTER TABLE public.lancamentos_agente ADD CONSTRAINT lancamentos_agente_valor_check CHECK (valor > 0);

ALTER TABLE public.pagamentos_agente DROP CONSTRAINT IF EXISTS pagamentos_agente_valor_check;
ALTER TABLE public.pagamentos_agente ADD CONSTRAINT pagamentos_agente_valor_check CHECK (valor > 0);

ALTER TABLE public.ordem_cobrancas DROP CONSTRAINT IF EXISTS ordem_cobrancas_valor_check;
ALTER TABLE public.ordem_cobrancas ADD CONSTRAINT ordem_cobrancas_valor_check CHECK (valor > 0);

ALTER TABLE public.ordens DROP CONSTRAINT IF EXISTS ordens_valor_pendente_check;
ALTER TABLE public.ordens ADD CONSTRAINT ordens_valor_pendente_check CHECK (valor_pendente >= 0);

-- ============ 3. UNICIDADE DE CADASTROS ============
CREATE UNIQUE INDEX IF NOT EXISTS locadoras_cnpj_unico
  ON public.locadoras (regexp_replace(cnpj,'\D','','g')) WHERE regexp_replace(cnpj,'\D','','g') <> '';
CREATE UNIQUE INDEX IF NOT EXISTS agentes_cpf_unico
  ON public.agentes (regexp_replace(cpf,'\D','','g')) WHERE regexp_replace(cpf,'\D','','g') <> '';
CREATE UNIQUE INDEX IF NOT EXISTS agentes_placa_unica
  ON public.agentes (upper(regexp_replace(moto_placa,'[^A-Za-z0-9]','','g')))
  WHERE regexp_replace(moto_placa,'[^A-Za-z0-9]','','g') <> '';
CREATE UNIQUE INDEX IF NOT EXISTS agentes_email_unico
  ON public.agentes (lower(email)) WHERE email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS locadora_apelidos_unico
  ON public.locadora_apelidos (lower(apelido));

-- ============ 4. PROTEÇÃO DO HISTÓRICO DO AGENTE ============
ALTER TABLE public.lancamentos_agente DROP CONSTRAINT lancamentos_agente_agente_id_fkey;
ALTER TABLE public.lancamentos_agente ADD CONSTRAINT lancamentos_agente_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE RESTRICT;
ALTER TABLE public.pagamentos_agente DROP CONSTRAINT pagamentos_agente_agente_id_fkey;
ALTER TABLE public.pagamentos_agente ADD CONSTRAINT pagamentos_agente_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE RESTRICT;
ALTER TABLE public.ordens DROP CONSTRAINT ordens_agente_id_fkey;
ALTER TABLE public.ordens ADD CONSTRAINT ordens_agente_id_fkey
  FOREIGN KEY (agente_id) REFERENCES public.agentes(id) ON DELETE RESTRICT;

-- ============ 5. CÓDIGO SEQUENCIAL SEM CORRIDA ============
CREATE SEQUENCE IF NOT EXISTS public.ordens_codigo_seq AS bigint START 1;
SELECT setval('public.ordens_codigo_seq',
  GREATEST(1, COALESCE((SELECT max(NULLIF(regexp_replace(codigo,'\D','','g'),'')::bigint) FROM public.ordens), 0)));

CREATE OR REPLACE FUNCTION public.proximo_codigo_ordem(_quantidade integer DEFAULT 1)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'OS-' || lpad(nextval('public.ordens_codigo_seq')::text, 5, '0')
  FROM generate_series(1, GREATEST(1, LEAST(_quantidade, 500)))
$$;
GRANT EXECUTE ON FUNCTION public.proximo_codigo_ordem(integer) TO authenticated;

-- ============ 6. REGRAS DE ORDEM (INSERT/UPDATE) ============
CREATE OR REPLACE FUNCTION public.ordens_regras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equipe boolean := public.equipe(auth.uid());
  v_liquidada boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_equipe THEN
      NEW.status := 'pendente';
      NEW.agente_id := NULL;
      NEW.recebimento_pago := false;
      NEW.pagamento_pago := false;
      NEW.valor_cobranca := NULL;
      NEW.valor_pagamento := NULL;
      NEW.distribuida_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
    END IF;
    IF NEW.codigo IS NULL OR btrim(NEW.codigo) = '' THEN
      NEW.codigo := 'OS-' || lpad(nextval('public.ordens_codigo_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
  END IF;

  v_liquidada := OLD.recebimento_pago OR OLD.pagamento_pago;

  -- Agente só mexe no andamento da própria ordem
  IF NOT v_equipe THEN
    IF NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
       OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
       OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico
       OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
       OR NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
       OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'Agente não pode alterar dados cadastrais ou financeiros da ordem';
    END IF;
    IF NEW.status NOT IN ('em_andamento','concluida') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Agente só pode avançar a ordem no fluxo de campo';
    END IF;
  END IF;

  -- Ordem liquidada é imutável: só o estorno (desmarcar) é permitido
  IF v_liquidada THEN
    IF (NEW.recebimento_pago OR NEW.pagamento_pago)
       AND (NEW.status IS DISTINCT FROM OLD.status
            OR NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
            OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
            OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
            OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
            OR NEW.valor_pendente IS DISTINCT FROM OLD.valor_pendente
            OR NEW.tipo_servico IS DISTINCT FROM OLD.tipo_servico) THEN
      RAISE EXCEPTION 'Ordem já faturada ou paga. Estorne a liquidação antes de alterá-la.';
    END IF;
  END IF;

  -- Só liquida ordem concluída
  IF (NEW.recebimento_pago AND NOT OLD.recebimento_pago AND NEW.status <> 'concluida')
     OR (NEW.pagamento_pago AND NOT OLD.pagamento_pago AND NEW.status <> 'concluida') THEN
    RAISE EXCEPTION 'Só é possível liquidar uma ordem concluída';
  END IF;

  -- Transições válidas
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pendente'     AND NEW.status IN ('distribuida','cancelada'))
      OR (OLD.status = 'distribuida'  AND NEW.status IN ('em_andamento','pendente','cancelada'))
      OR (OLD.status = 'em_andamento' AND NEW.status IN ('concluida','pendente','cancelada'))
      OR (OLD.status = 'concluida'    AND NEW.status = 'pendente')
      OR (OLD.status = 'cancelada'    AND NEW.status = 'pendente')
    ) THEN
      RAISE EXCEPTION 'Transição de situação inválida: % para %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'distribuida' THEN
      IF NEW.agente_id IS NULL THEN
        RAISE EXCEPTION 'Ordem distribuída precisa de um agente';
      END IF;
      NEW.distribuida_em := COALESCE(NEW.distribuida_em, now());
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
      NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
    ELSIF NEW.status = 'em_andamento' THEN
      NEW.iniciada_em := COALESCE(NEW.iniciada_em, now());
    ELSIF NEW.status = 'concluida' THEN
      IF NEW.iniciada_em IS NULL THEN
        RAISE EXCEPTION 'Não é possível concluir uma ordem que não foi iniciada em campo';
      END IF;
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    ELSIF NEW.status = 'cancelada' THEN
      NEW.cancelada_em := now();
    ELSIF NEW.status = 'pendente' THEN
      NEW.agente_id := NULL;
      NEW.distribuida_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.concluida_em := NULL;
      NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
      NEW.valor_cobranca := NULL;
      NEW.valor_pagamento := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ordens_regras_trg ON public.ordens;
CREATE TRIGGER ordens_regras_trg
  BEFORE INSERT OR UPDATE ON public.ordens
  FOR EACH ROW EXECUTE FUNCTION public.ordens_regras();

-- ============ 7. EXCLUSÃO DE ORDEM ============
CREATE OR REPLACE FUNCTION public.ordens_bloqueia_exclusao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.recebimento_pago OR OLD.pagamento_pago THEN
    RAISE EXCEPTION 'Ordem já faturada ou paga não pode ser excluída';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos_agente WHERE ordem_id = OLD.id) THEN
    RAISE EXCEPTION 'Ordem possui lançamentos financeiros e não pode ser excluída';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ordens_bloqueia_exclusao_trg ON public.ordens;
CREATE TRIGGER ordens_bloqueia_exclusao_trg
  BEFORE DELETE ON public.ordens
  FOR EACH ROW EXECUTE FUNCTION public.ordens_bloqueia_exclusao();

-- ============ 8. COBRANÇAS ============
CREATE OR REPLACE FUNCTION public.cobrancas_regras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem public.ordens%ROWTYPE;
BEGIN
  SELECT * INTO v_ordem FROM public.ordens
   WHERE id = COALESCE(NEW.ordem_id, OLD.ordem_id);
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF v_ordem.recebimento_pago THEN
    RAISE EXCEPTION 'Ordem já faturada: as cobranças estão bloqueadas';
  END IF;
  IF v_ordem.status = 'cancelada' AND TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'Não é possível lançar cobrança em ordem cancelada';
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.locadora_id IS DISTINCT FROM v_ordem.locadora_id THEN
    NEW.locadora_id := v_ordem.locadora_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS cobrancas_regras_trg ON public.ordem_cobrancas;
CREATE TRIGGER cobrancas_regras_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.ordem_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.cobrancas_regras();