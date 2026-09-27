-- 1. Novos dados da vistoria
ALTER TABLE public.vistorias
  ADD COLUMN IF NOT EXISTS km numeric,
  ADD COLUMN IF NOT EXISTS latitude text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS longitude text NOT NULL DEFAULT '';

ALTER TYPE status_vistoria ADD VALUE IF NOT EXISTS 'aguardando_complementacao';

-- 2. Catálogo configurável de itens do checklist
CREATE TABLE IF NOT EXISTS public.vistoria_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  obrigatorio boolean NOT NULL DEFAULT true,
  foto_quando_ruim boolean NOT NULL DEFAULT true,
  foto_quando_regular boolean NOT NULL DEFAULT false,
  posicao integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vistoria_checklist_itens TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vistoria_checklist_itens TO authenticated;
GRANT ALL ON public.vistoria_checklist_itens TO service_role;
ALTER TABLE public.vistoria_checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist itens leitura" ON public.vistoria_checklist_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist itens equipe" ON public.vistoria_checklist_itens
  FOR ALL TO authenticated USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));
CREATE TRIGGER vistoria_checklist_itens_atualizado
  BEFORE UPDATE ON public.vistoria_checklist_itens
  FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

INSERT INTO public.vistoria_checklist_itens (codigo, nome, posicao) VALUES
  ('motor','Motor',10),
  ('pneus','Pneus',20),
  ('rodas','Rodas',30),
  ('freio_dianteiro','Freio dianteiro',40),
  ('freio_traseiro','Freio traseiro',50),
  ('farol','Farol',60),
  ('lanterna','Lanterna',70),
  ('setas','Setas',80),
  ('retrovisor_esquerdo','Retrovisor esquerdo',90),
  ('retrovisor_direito','Retrovisor direito',100),
  ('painel','Painel',110),
  ('banco','Banco',120),
  ('guidao','Guidão',130),
  ('manetes','Manetes',140),
  ('carenagem','Carenagem',150),
  ('escapamento','Escapamento',160),
  ('chave','Chave',170),
  ('placa','Placa',180)
ON CONFLICT (codigo) DO NOTHING;

-- 3. Visibilidade compartilhada pelas tabelas filhas
CREATE OR REPLACE FUNCTION public.vistoria_visivel(_vistoria_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vistorias v
     WHERE v.id = _vistoria_id
       AND (public.equipe(auth.uid())
            OR v.locadora_id = public.locadora_do_usuario(auth.uid())
            OR (v.agente_id IS NOT NULL AND v.agente_id = public.agente_do_usuario(auth.uid())))
  )
$$;

CREATE OR REPLACE FUNCTION public.vistoria_editavel(_vistoria_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vistorias v
     WHERE v.id = _vistoria_id
       AND (public.equipe(auth.uid())
            OR (v.agente_id IS NOT NULL AND v.agente_id = public.agente_do_usuario(auth.uid())))
  )
$$;

-- 4. Itens avaliados da vistoria
CREATE TABLE IF NOT EXISTS public.vistoria_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id uuid NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  catalogo_id uuid REFERENCES public.vistoria_checklist_itens(id) ON DELETE SET NULL,
  codigo text NOT NULL DEFAULT '',
  item text NOT NULL,
  condicao text NOT NULL DEFAULT 'nao_avaliado'
    CHECK (condicao IN ('nao_avaliado','bom','regular','ruim')),
  obrigatorio boolean NOT NULL DEFAULT true,
  observacao text NOT NULL DEFAULT '',
  posicao integer NOT NULL DEFAULT 0,
  avaliado_em timestamptz,
  avaliado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vistoria_id, codigo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vistoria_itens TO authenticated;
GRANT ALL ON public.vistoria_itens TO service_role;
ALTER TABLE public.vistoria_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vistoria itens le" ON public.vistoria_itens
  FOR SELECT TO authenticated USING (public.vistoria_visivel(vistoria_id));
CREATE POLICY "vistoria itens escreve" ON public.vistoria_itens
  FOR INSERT TO authenticated WITH CHECK (public.vistoria_editavel(vistoria_id));
CREATE POLICY "vistoria itens atualiza" ON public.vistoria_itens
  FOR UPDATE TO authenticated USING (public.vistoria_editavel(vistoria_id))
  WITH CHECK (public.vistoria_editavel(vistoria_id));
CREATE POLICY "vistoria itens exclui" ON public.vistoria_itens
  FOR DELETE TO authenticated USING (public.equipe(auth.uid()));
CREATE TRIGGER vistoria_itens_atualizado BEFORE UPDATE ON public.vistoria_itens
  FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();
CREATE INDEX IF NOT EXISTS vistoria_itens_vistoria_idx ON public.vistoria_itens(vistoria_id);

-- 5. Avarias
CREATE TABLE IF NOT EXISTS public.vistoria_avarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id uuid NOT NULL REFERENCES public.vistorias(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.vistoria_itens(id) ON DELETE SET NULL,
  componente text NOT NULL,
  condicao text NOT NULL DEFAULT 'ruim' CHECK (condicao IN ('regular','ruim')),
  descricao text NOT NULL DEFAULT '',
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vistoria_avarias TO authenticated;
GRANT ALL ON public.vistoria_avarias TO service_role;
ALTER TABLE public.vistoria_avarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vistoria avarias le" ON public.vistoria_avarias
  FOR SELECT TO authenticated USING (public.vistoria_visivel(vistoria_id));
CREATE POLICY "vistoria avarias escreve" ON public.vistoria_avarias
  FOR INSERT TO authenticated WITH CHECK (public.vistoria_editavel(vistoria_id));
CREATE POLICY "vistoria avarias atualiza" ON public.vistoria_avarias
  FOR UPDATE TO authenticated USING (public.vistoria_editavel(vistoria_id))
  WITH CHECK (public.vistoria_editavel(vistoria_id));
CREATE POLICY "vistoria avarias exclui" ON public.vistoria_avarias
  FOR DELETE TO authenticated USING (public.vistoria_editavel(vistoria_id));
CREATE TRIGGER vistoria_avarias_atualizado BEFORE UPDATE ON public.vistoria_avarias
  FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();
CREATE INDEX IF NOT EXISTS vistoria_avarias_vistoria_idx ON public.vistoria_avarias(vistoria_id);

-- 6. Fotos categorizadas e com contexto de captura
ALTER TABLE public.vistoria_evidencias
  ADD COLUMN IF NOT EXISTS avaria_id uuid REFERENCES public.vistoria_avarias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS km numeric,
  ADD COLUMN IF NOT EXISTS latitude text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS longitude text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS vistoria_evidencias_avaria_idx ON public.vistoria_evidencias(avaria_id);

-- 7. Regras de conclusão da vistoria
CREATE OR REPLACE FUNCTION public.vistorias_valida_conclusao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pendentes integer;
  v_sem_prova integer;
BEGIN
  IF NEW.status <> 'concluida' OR OLD.status = 'concluida' THEN
    RETURN NEW;
  END IF;

  IF NEW.km IS NULL OR NEW.km < 0 THEN
    RAISE EXCEPTION 'Informe a quilometragem da motocicleta antes de concluir a vistoria';
  END IF;

  SELECT count(*) INTO v_pendentes
    FROM public.vistoria_itens i
   WHERE i.vistoria_id = NEW.id AND i.obrigatorio AND i.condicao = 'nao_avaliado';
  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'Existem % item(ns) do checklist ainda não avaliados', v_pendentes;
  END IF;

  SELECT count(*) INTO v_pendentes
    FROM public.vistoria_checklist_itens c
   WHERE c.ativo AND c.obrigatorio
     AND NOT EXISTS (SELECT 1 FROM public.vistoria_itens i
                      WHERE i.vistoria_id = NEW.id AND i.codigo = c.codigo
                        AND i.condicao <> 'nao_avaliado');
  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'Existem % item(ns) do checklist ainda não avaliados', v_pendentes;
  END IF;

  SELECT count(*) INTO v_sem_prova
    FROM public.vistoria_itens i
   WHERE i.vistoria_id = NEW.id AND i.condicao = 'ruim'
     AND NOT EXISTS (
       SELECT 1 FROM public.vistoria_avarias a
        WHERE a.item_id = i.id AND btrim(a.descricao) <> ''
          AND EXISTS (SELECT 1 FROM public.vistoria_evidencias e WHERE e.avaria_id = a.id)
     );
  IF v_sem_prova > 0 THEN
    RAISE EXCEPTION 'Cada item marcado como Ruim precisa de descrição da avaria e ao menos uma foto (% pendente(s))', v_sem_prova;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vistorias_valida_conclusao_trg ON public.vistorias;
CREATE TRIGGER vistorias_valida_conclusao_trg
  BEFORE UPDATE ON public.vistorias
  FOR EACH ROW EXECUTE FUNCTION public.vistorias_valida_conclusao();

-- 8. Histórico automático de itens, avarias e fotos
CREATE OR REPLACE FUNCTION public.vistoria_registra_evento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quem text := coalesce((SELECT nome FROM public.profiles WHERE id = auth.uid()), 'Sistema');
  v_vistoria uuid;
  v_moto uuid;
  v_acao text;
  v_detalhe text := '';
BEGIN
  IF TG_OP = 'DELETE' THEN v_vistoria := OLD.vistoria_id; ELSE v_vistoria := NEW.vistoria_id; END IF;
  SELECT moto_id INTO v_moto FROM public.vistorias WHERE id = v_vistoria;

  IF TG_TABLE_NAME = 'vistoria_itens' THEN
    IF TG_OP = 'UPDATE' AND NEW.condicao IS NOT DISTINCT FROM OLD.condicao THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
      v_acao := 'Item removido do checklist'; v_detalhe := OLD.item;
    ELSE
      v_acao := 'Checklist avaliado';
      v_detalhe := NEW.item || ' — ' || NEW.condicao ||
                   coalesce(nullif(' • ' || NEW.observacao, ' • '), '');
    END IF;
  ELSIF TG_TABLE_NAME = 'vistoria_avarias' THEN
    IF TG_OP = 'DELETE' THEN
      v_acao := 'Avaria removida'; v_detalhe := OLD.componente;
    ELSIF TG_OP = 'INSERT' THEN
      v_acao := 'Avaria registrada'; v_detalhe := NEW.componente || ' — ' || NEW.descricao;
    ELSE
      v_acao := 'Avaria atualizada'; v_detalhe := NEW.componente || ' — ' || NEW.descricao;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_acao := 'Foto removida'; v_detalhe := OLD.nome;
    ELSE
      v_acao := 'Foto anexada'; v_detalhe := NEW.categoria || ' • ' || NEW.nome;
    END IF;
  END IF;

  INSERT INTO public.vistoria_historico (vistoria_id, moto_id, quem, acao, detalhe)
  VALUES (v_vistoria, v_moto, v_quem, v_acao, coalesce(v_detalhe, ''));

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS vistoria_itens_evento_trg ON public.vistoria_itens;
CREATE TRIGGER vistoria_itens_evento_trg AFTER INSERT OR UPDATE OR DELETE ON public.vistoria_itens
  FOR EACH ROW EXECUTE FUNCTION public.vistoria_registra_evento();
DROP TRIGGER IF EXISTS vistoria_avarias_evento_trg ON public.vistoria_avarias;
CREATE TRIGGER vistoria_avarias_evento_trg AFTER INSERT OR UPDATE OR DELETE ON public.vistoria_avarias
  FOR EACH ROW EXECUTE FUNCTION public.vistoria_registra_evento();
DROP TRIGGER IF EXISTS vistoria_evidencias_evento_trg ON public.vistoria_evidencias;
CREATE TRIGGER vistoria_evidencias_evento_trg AFTER INSERT OR DELETE ON public.vistoria_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.vistoria_registra_evento();