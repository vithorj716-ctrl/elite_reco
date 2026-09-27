CREATE OR REPLACE FUNCTION public.vistorias_valida_conclusao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pendentes integer;
  v_sem_prova integer;
  v_faltando text;
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

  SELECT string_agg(etapa, ', ') INTO v_faltando
    FROM unnest(ARRAY['frente','traseira','lateral_esquerda','lateral_direita','painel']) AS etapa
   WHERE NOT EXISTS (
     SELECT 1 FROM public.vistoria_evidencias e
      WHERE e.vistoria_id = NEW.id AND e.etapa = etapa
   );
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Fotos obrigatórias faltando: %', v_faltando;
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