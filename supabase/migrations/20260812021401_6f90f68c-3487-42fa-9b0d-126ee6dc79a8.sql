-- 1. Dados completos da solicitação + fluxo de campo
ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS contato_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contato_telefone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contato_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cidade text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS link_maps text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS host text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pin_validade text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS texto_origem text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aceita_em timestamptz,
  ADD COLUMN IF NOT EXISTS chegada_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_aceito boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS termo_aceito_em timestamptz;

-- 2. Regras de negócio da vistoria (mesmo rigor do recolhimento)
CREATE OR REPLACE FUNCTION public.vistorias_regras()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_equipe boolean := public.equipe(auth.uid());
  v_agente uuid := public.agente_do_usuario(auth.uid());
  v_locadora uuid := public.locadora_do_usuario(auth.uid());
  v_conclusao boolean;
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
      NEW.aceita_em := NULL;
      NEW.iniciada_em := NULL;
      NEW.chegada_em := NULL;
      NEW.termo_aceito := false;
      NEW.termo_aceito_em := NULL;
    END IF;
    NEW.solicitada_por := coalesce(NEW.solicitada_por, auth.uid());
    RETURN NEW;
  END IF;

  NEW.atualizado_em := now();
  v_conclusao := OLD.status = 'em_andamento' AND NEW.status = 'concluida';

  IF OLD.status = 'concluida' AND NOT v_equipe THEN
    RAISE EXCEPTION 'Vistoria concluída não pode ser alterada';
  END IF;

  -- Locadora: só edita a própria solicitação enquanto ela não foi distribuída
  IF NOT v_equipe AND v_agente IS NULL AND v_locadora IS NOT NULL
     AND OLD.locadora_id = v_locadora THEN
    IF OLD.status NOT IN ('pendente','cancelada') THEN
      RAISE EXCEPTION 'A vistoria já está em andamento: fale com a central';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('cancelada','pendente') THEN
      RAISE EXCEPTION 'A locadora só pode cancelar a própria solicitação';
    END IF;
    IF NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
       OR NEW.agente_id IS DISTINCT FROM OLD.agente_id
       OR NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
       OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'A locadora não pode alterar dados financeiros ou de distribuição';
    END IF;
  END IF;

  IF NOT v_equipe AND v_agente IS NOT NULL THEN
    IF NEW.agente_id IS DISTINCT FROM OLD.agente_id
       OR NEW.locadora_id IS DISTINCT FROM OLD.locadora_id
       OR NEW.moto_id IS DISTINCT FROM OLD.moto_id
       OR NEW.recebimento_pago IS DISTINCT FROM OLD.recebimento_pago
       OR NEW.pagamento_pago IS DISTINCT FROM OLD.pagamento_pago THEN
      RAISE EXCEPTION 'O agente não pode alterar dados de distribuição ou financeiros';
    END IF;
    -- valores só podem ser gravados no instante da conclusão (snapshot)
    IF (NEW.valor_cobranca IS DISTINCT FROM OLD.valor_cobranca
        OR NEW.valor_pagamento IS DISTINCT FROM OLD.valor_pagamento
        OR NEW.tabela_cobranca_id IS DISTINCT FROM OLD.tabela_cobranca_id
        OR NEW.tabela_pagamento_id IS DISTINCT FROM OLD.tabela_pagamento_id)
       AND NOT v_conclusao THEN
      RAISE EXCEPTION 'O agente não pode alterar valores da vistoria';
    END IF;
    IF NEW.status NOT IN ('em_andamento','concluida') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'O agente só pode iniciar e concluir a vistoria';
    END IF;
  END IF;

  -- Marcos de campo
  IF NEW.aceita_em IS NOT NULL AND OLD.aceita_em IS NULL THEN
    NEW.aceita_em := coalesce(NEW.aceita_em, now());
  END IF;
  IF NEW.iniciada_em IS NOT NULL AND OLD.iniciada_em IS NULL AND NEW.aceita_em IS NULL THEN
    NEW.aceita_em := now();
  END IF;
  IF NEW.chegada_em IS NOT NULL AND OLD.chegada_em IS NULL AND NEW.iniciada_em IS NULL THEN
    RAISE EXCEPTION 'Para anunciar a chegada é obrigatório iniciar o deslocamento';
  END IF;
  IF NEW.termo_aceito AND NOT OLD.termo_aceito THEN
    NEW.termo_aceito_em := coalesce(NEW.termo_aceito_em, now());
  END IF;

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
      IF NEW.agente_id IS NULL THEN RAISE EXCEPTION 'Escolha um agente para distribuir a vistoria'; END IF;
      NEW.distribuida_em := coalesce(NEW.distribuida_em, now());
      NEW.distribuida_por := coalesce(NEW.distribuida_por, auth.uid());
      NEW.aceita_em := NULL; NEW.iniciada_em := NULL; NEW.chegada_em := NULL;
      NEW.concluida_em := NULL; NEW.cancelada_em := NULL;
      NEW.termo_aceito := false; NEW.termo_aceito_em := NULL;
    ELSIF NEW.status = 'em_andamento' THEN
      IF NOT v_equipe AND (NEW.agente_id IS NULL OR NEW.agente_id <> v_agente) THEN
        RAISE EXCEPTION 'Somente o agente responsável pode iniciar esta vistoria';
      END IF;
      NEW.aceita_em := coalesce(NEW.aceita_em, now());
      NEW.iniciada_em := coalesce(NEW.iniciada_em, now());
    ELSIF NEW.status = 'concluida' THEN
      IF NEW.iniciada_em IS NULL THEN
        RAISE EXCEPTION 'Você precisa iniciar o deslocamento antes de concluir a vistoria';
      END IF;
      IF NEW.chegada_em IS NULL THEN
        RAISE EXCEPTION 'Você precisa anunciar sua chegada antes de continuar';
      END IF;
      IF NOT NEW.termo_aceito THEN
        RAISE EXCEPTION 'É necessário aceitar o termo de responsabilidade antes de concluir';
      END IF;
      NEW.concluida_em := coalesce(NEW.concluida_em, now());
    ELSIF NEW.status = 'cancelada' THEN
      IF btrim(coalesce(NEW.motivo_cancelamento,'')) = '' THEN
        RAISE EXCEPTION 'Informe o motivo do cancelamento';
      END IF;
      NEW.cancelada_em := now();
    ELSIF NEW.status = 'pendente' THEN
      NEW.agente_id := NULL;
      NEW.distribuida_em := NULL; NEW.iniciada_em := NULL; NEW.aceita_em := NULL;
      NEW.chegada_em := NULL; NEW.concluida_em := NULL; NEW.cancelada_em := NULL;
      NEW.motivo_cancelamento := '';
      NEW.termo_aceito := false; NEW.termo_aceito_em := NULL;
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

-- 3. Bloqueio de exclusão de vistoria com histórico financeiro
CREATE OR REPLACE FUNCTION public.vistorias_bloqueia_exclusao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'concluida' OR OLD.recebimento_pago OR OLD.pagamento_pago THEN
    RAISE EXCEPTION 'Vistoria concluída ou faturada não pode ser excluída: use o cancelamento';
  END IF;
  RETURN OLD;
END; $function$;

DROP TRIGGER IF EXISTS vistorias_bloqueia_exclusao_trg ON public.vistorias;
CREATE TRIGGER vistorias_bloqueia_exclusao_trg
  BEFORE DELETE ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION public.vistorias_bloqueia_exclusao();

-- 4. Permissões da locadora sobre as próprias solicitações
DROP POLICY IF EXISTS "vistorias locadora atualiza" ON public.vistorias;
CREATE POLICY "vistorias locadora atualiza" ON public.vistorias
  FOR UPDATE TO authenticated
  USING (locadora_id = public.locadora_do_usuario(auth.uid()))
  WITH CHECK (locadora_id = public.locadora_do_usuario(auth.uid()));

DROP POLICY IF EXISTS "vistorias locadora exclui" ON public.vistorias;
CREATE POLICY "vistorias locadora exclui" ON public.vistorias
  FOR DELETE TO authenticated
  USING (locadora_id = public.locadora_do_usuario(auth.uid())
         AND status IN ('pendente','cancelada'));

DROP POLICY IF EXISTS "motos locadora exclui" ON public.motos;
CREATE POLICY "motos locadora exclui" ON public.motos
  FOR DELETE TO authenticated
  USING (locadora_id = public.locadora_do_usuario(auth.uid())
         AND NOT EXISTS (SELECT 1 FROM public.vistorias v WHERE v.moto_id = motos.id));

-- 5. Evidências no Storage: mesmo cofre das fotos de recolhimento
--    caminho: locadoras/{locadoraId}/vistorias/{vistoriaId}/fotos/{arquivo}
DROP POLICY IF EXISTS "evidencias vistoria envio" ON storage.objects;
CREATE POLICY "evidencias vistoria envio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencias'
    AND (storage.foldername(name))[3] = 'vistorias'
    AND EXISTS (
      SELECT 1 FROM public.vistorias v
       WHERE v.id::text = (storage.foldername(name))[4]
         AND (public.equipe(auth.uid())
              OR v.agente_id = public.agente_do_usuario(auth.uid())
              OR v.locadora_id = public.locadora_do_usuario(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "evidencias vistoria leitura" ON storage.objects;
CREATE POLICY "evidencias vistoria leitura" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidencias'
    AND (storage.foldername(name))[3] = 'vistorias'
    AND EXISTS (
      SELECT 1 FROM public.vistorias v
       WHERE v.id::text = (storage.foldername(name))[4]
         AND (public.equipe(auth.uid())
              OR v.agente_id = public.agente_do_usuario(auth.uid())
              OR v.locadora_id = public.locadora_do_usuario(auth.uid()))
    )
  );

-- 6. Serviço "Vistoria de Moto" no catálogo global
INSERT INTO public.servicos (codigo, nome, descricao, unidade, ativo, posicao)
SELECT 'vistoria_moto', 'Vistoria de Moto',
       'Vistoria periódica da motocicleta com checklist e registro fotográfico.',
       'fixo', true,
       coalesce((SELECT max(posicao) + 1 FROM public.servicos), 1)
WHERE NOT EXISTS (SELECT 1 FROM public.servicos WHERE codigo = 'vistoria_moto');