-- 1. Preferências de serviço do agente (opt-out: sem linha = aceita)
CREATE TABLE IF NOT EXISTS public.agente_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id uuid NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  aceita boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agente_id, servico_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_servicos TO authenticated;
GRANT ALL ON public.agente_servicos TO service_role;
ALTER TABLE public.agente_servicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agente_servicos_leitura" ON public.agente_servicos;
CREATE POLICY "agente_servicos_leitura" ON public.agente_servicos FOR SELECT TO authenticated
USING (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()));

DROP POLICY IF EXISTS "agente_servicos_escrita" ON public.agente_servicos;
CREATE POLICY "agente_servicos_escrita" ON public.agente_servicos FOR ALL TO authenticated
USING (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()))
WITH CHECK (public.equipe(auth.uid()) OR agente_id = public.agente_do_usuario(auth.uid()));

-- 2. Agente aceita este serviço? (sem registro = aceita)
CREATE OR REPLACE FUNCTION public.agente_aceita_servico(_agente uuid, _servico uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.agente_servicos s
     WHERE s.agente_id = _agente AND _servico IS NOT NULL
       AND s.servico_id = _servico AND s.aceita = false
  )
$$;

-- 3. Sorteio passa a respeitar o tipo de serviço aceito pelo agente
CREATE OR REPLACE FUNCTION public.sortear_agente_distribuicao(_dist uuid, _origem distribuicao_origem DEFAULT 'automatica', _forcado uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  d public.distribuicoes%ROWTYPE;
  v_cidade text;
  v_escolhido uuid;
  v_elegiveis jsonb := '[]'::jsonb;
  v_descartados jsonb := '[]'::jsonb;
  v_resumo text;
  v_regra text;
BEGIN
  PERFORM set_config('app.distribuicao', '1', true);
  PERFORM pg_advisory_xact_lock(hashtext('distribuicao_sorteio'));

  SELECT * INTO d FROM public.distribuicoes WHERE id = _dist FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribuição não encontrada'; END IF;

  SELECT cidade INTO v_cidade FROM public.locadoras WHERE id = d.locadora_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'cidade', a.cidade)), '[]'::jsonb)
    INTO v_elegiveis
    FROM public.agentes a
   WHERE a.ativo AND a.situacao = 'ativo'
     AND a.online AND public.presenca_valida(a.visto_em)
     AND NOT public.agente_ocupado(a.id)
     AND public.agente_aceita_servico(a.id, d.servico_id)
     AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
     AND a.id IS DISTINCT FROM d.agente_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'motivo',
           CASE WHEN NOT a.ativo THEN 'inativo'
                WHEN a.situacao <> 'ativo' THEN 'situação ' || a.situacao
                WHEN EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id) THEN 'recusou esta operação'
                WHEN NOT a.online THEN 'offline'
                WHEN NOT public.presenca_valida(a.visto_em) THEN 'conexão perdida'
                WHEN public.agente_ocupado(a.id) THEN 'ocupado com outra operação'
                WHEN NOT public.agente_aceita_servico(a.id, d.servico_id) THEN 'não aceita este tipo de serviço'
                ELSE 'agente atual' END)), '[]'::jsonb)
    INTO v_descartados
    FROM public.agentes a
   WHERE NOT (a.ativo AND a.situacao = 'ativo'
              AND a.online AND public.presenca_valida(a.visto_em)
              AND NOT public.agente_ocupado(a.id)
              AND public.agente_aceita_servico(a.id, d.servico_id)
              AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
              AND a.id IS DISTINCT FROM d.agente_id);

  IF _forcado IS NOT NULL THEN
    v_escolhido := _forcado;
    v_regra := 'Agente definido manualmente pelo administrador';
  ELSE
    SELECT a.id INTO v_escolhido
      FROM public.agentes a
     WHERE a.ativo AND a.situacao = 'ativo'
       AND a.online AND public.presenca_valida(a.visto_em)
       AND NOT public.agente_ocupado(a.id)
       AND public.agente_aceita_servico(a.id, d.servico_id)
       AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
       AND a.id IS DISTINCT FROM d.agente_id
       AND v_cidade <> '' AND (lower(a.cidade) = lower(v_cidade) OR v_cidade = ANY (a.cidades_atendidas))
     ORDER BY random() LIMIT 1;
    v_regra := 'Sorteio entre agentes online e disponíveis que atendem ' || coalesce(nullif(v_cidade,''), 'a região');

    IF v_escolhido IS NULL THEN
      SELECT a.id INTO v_escolhido
        FROM public.agentes a
       WHERE a.ativo AND a.situacao = 'ativo'
         AND a.online AND public.presenca_valida(a.visto_em)
         AND NOT public.agente_ocupado(a.id)
         AND public.agente_aceita_servico(a.id, d.servico_id)
         AND NOT EXISTS (SELECT 1 FROM public.distribuicao_recusas r WHERE r.distribuicao_id = _dist AND r.agente_id = a.id)
         AND a.id IS DISTINCT FROM d.agente_id
       ORDER BY random() LIMIT 1;
      v_regra := 'Sorteio entre todos os agentes online e disponíveis';
    END IF;
  END IF;

  UPDATE public.distribuicoes
     SET elegiveis = v_elegiveis, descartados = v_descartados, regra = v_regra,
         origem = _origem, atualizado_em = now()
   WHERE id = _dist;

  IF v_escolhido IS NULL THEN
    UPDATE public.distribuicoes SET status = 'aguardando_distribuicao', agente_id = NULL WHERE id = _dist;
    IF d.status <> 'aguardando_distribuicao' THEN
      PERFORM public.registrar_evento_distribuicao(_dist, 'Aguardando agente',
        'Nenhum agente online, disponível e habilitado para este serviço — a operação segue na fila', true,
        jsonb_build_object('descartados', v_descartados));
      PERFORM public.notificar_equipe('operacional', 'Operação aguardando agente',
        'A operação entrou na fila e será distribuída assim que um agente elegível ficar online.', NULL);
    END IF;
    RETURN NULL;
  END IF;

  UPDATE public.distribuicoes
     SET agente_id = v_escolhido, status = 'notificada', distribuida_em = now(),
         notificada_em = now(), aceita_em = NULL, recusada_em = NULL
   WHERE id = _dist;

  IF d.tipo = 'recolhimento' THEN
    UPDATE public.ordens SET agente_id = v_escolhido, status = 'distribuida', aceita_em = NULL
     WHERE id = d.ordem_id;
  ELSE
    UPDATE public.vistorias SET agente_id = v_escolhido, status = 'distribuida', aceita_em = NULL
     WHERE id = d.vistoria_id;
  END IF;

  v_resumo := d.servico_nome || ' • ' || coalesce((SELECT placa FROM public.motos WHERE id = d.moto_id), '');

  PERFORM public.registrar_evento_distribuicao(_dist,
    CASE WHEN _forcado IS NULL THEN 'Agente sorteado automaticamente' ELSE 'Agente definido pelo administrador' END,
    coalesce((SELECT nome FROM public.agentes WHERE id = v_escolhido), '') || ' — ' || v_regra,
    _forcado IS NULL,
    jsonb_build_object('agente_id', v_escolhido, 'elegiveis', v_elegiveis, 'descartados', v_descartados));

  PERFORM public.registrar_evento_distribuicao(_dist, 'Notificação enviada', v_resumo, true,
    jsonb_build_object('agente_id', v_escolhido));

  IF d.tipo = 'recolhimento' THEN
    PERFORM public.notificar_agente(v_escolhido, 'nova_ordem', 'Nova operação disponível', v_resumo, d.ordem_id);
  ELSE
    PERFORM public.notificar_agente_vistoria(v_escolhido, 'nova_ordem', 'Nova operação disponível', v_resumo, d.vistoria_id);
  END IF;

  RETURN v_escolhido;
END; $function$;

-- 4. Fila: tenta distribuir tudo que está aguardando agente
CREATE OR REPLACE FUNCTION public.processar_fila_distribuicao()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_ok integer := 0; v_agente uuid;
BEGIN
  FOR r IN
    SELECT id FROM public.distribuicoes
     WHERE status IN ('aguardando_distribuicao','recusada') AND agente_id IS NULL
     ORDER BY criada_em
     LIMIT 50
  LOOP
    v_agente := public.sortear_agente_distribuicao(r.id, 'automatica', NULL);
    IF v_agente IS NOT NULL THEN v_ok := v_ok + 1; END IF;
  END LOOP;
  RETURN v_ok;
END; $$;

GRANT EXECUTE ON FUNCTION public.processar_fila_distribuicao() TO authenticated;

-- 5. Heartbeat: ao confirmar presença, a fila é reprocessada automaticamente
CREATE OR REPLACE FUNCTION public.registrar_presenca(_online boolean DEFAULT true)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agente uuid; v_quando timestamptz; v_antes boolean; v_valida_antes boolean;
BEGIN
  v_agente := public.agente_do_usuario(auth.uid());
  IF v_agente IS NULL THEN RAISE EXCEPTION 'Usuário não é um agente de campo'; END IF;

  SELECT online, public.presenca_valida(visto_em) INTO v_antes, v_valida_antes
    FROM public.agentes WHERE id = v_agente;

  UPDATE public.agentes
     SET online = _online,
         visto_em = CASE WHEN _online THEN now() ELSE visto_em END
   WHERE id = v_agente
   RETURNING visto_em INTO v_quando;

  -- Ficou elegível agora (ligou o botão ou reconectou): puxa a fila na hora.
  IF _online AND (NOT coalesce(v_antes,false) OR NOT coalesce(v_valida_antes,false)) THEN
    PERFORM public.processar_fila_distribuicao();
  END IF;

  RETURN v_quando;
END; $$;

-- 6. Ao concluir/cancelar operação o agente volta a ficar livre: reprocessa a fila
CREATE OR REPLACE FUNCTION public.fila_apos_liberar_agente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('concluida','cancelada') AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.processar_fila_distribuicao();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fila_ordens ON public.ordens;
CREATE TRIGGER trg_fila_ordens AFTER UPDATE ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.fila_apos_liberar_agente();

DROP TRIGGER IF EXISTS trg_fila_vistorias ON public.vistorias;
CREATE TRIGGER trg_fila_vistorias AFTER UPDATE ON public.vistorias
FOR EACH ROW EXECUTE FUNCTION public.fila_apos_liberar_agente();

-- 7. Central em tempo real também para a distribuição
ALTER TABLE public.distribuicoes REPLICA IDENTITY FULL;
ALTER TABLE public.distribuicao_eventos REPLICA IDENTITY FULL;
ALTER TABLE public.agente_servicos REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.distribuicoes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.distribuicao_eventos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.agente_servicos; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;