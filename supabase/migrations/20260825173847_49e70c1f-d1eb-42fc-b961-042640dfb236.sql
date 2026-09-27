-- 1) Fonte única das fotos obrigatórias da vistoria
CREATE OR REPLACE FUNCTION public.fotos_obrigatorias_vistoria()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY['frente','traseira','lateral_esquerda','lateral_direita','painel']::text[];
$$;

-- 2) Foto realmente persistida: registro + arquivo com caminho e tamanho
CREATE OR REPLACE FUNCTION public.vistoria_foto_valida(_vistoria uuid, _etapa text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.vistoria_evidencias e
     WHERE e.vistoria_id = _vistoria
       AND e.etapa = _etapa
       AND e.avaria_id IS NULL
       AND coalesce(e.tipo,'foto') = 'foto'
       AND btrim(coalesce(e.caminho,'')) <> ''
       AND coalesce(e.tamanho,0) > 0
  );
$$;

-- 3) Pendências dos filhos da vistoria (fotos, checklist, avarias)
CREATE OR REPLACE FUNCTION public.vistoria_bloqueios_itens(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b jsonb := '[]'::jsonb;
  v_faltando text;
  v_n integer;
  r record;
BEGIN
  SELECT string_agg(etapa, ', ' ORDER BY ord) INTO v_faltando
    FROM unnest(public.fotos_obrigatorias_vistoria()) WITH ORDINALITY AS t(etapa, ord)
   WHERE NOT public.vistoria_foto_valida(_id, t.etapa);
  IF v_faltando IS NOT NULL THEN
    b := b || jsonb_build_object('chave','fotos','texto','Fotos obrigatórias pendentes: ' || v_faltando,'dados',v_faltando);
  END IF;

  SELECT count(*) INTO v_n
    FROM public.vistoria_itens i
   WHERE i.vistoria_id = _id AND i.obrigatorio AND i.condicao = 'nao_avaliado';
  IF v_n > 0 THEN
    b := b || jsonb_build_object('chave','checklist','texto','Existem ' || v_n || ' item(ns) do checklist ainda não avaliados');
  END IF;

  SELECT count(*) INTO v_n
    FROM public.vistoria_checklist_itens c
   WHERE c.ativo AND c.obrigatorio
     AND NOT EXISTS (SELECT 1 FROM public.vistoria_itens i
                      WHERE i.vistoria_id = _id AND i.codigo = c.codigo
                        AND i.condicao <> 'nao_avaliado');
  IF v_n > 0 THEN
    b := b || jsonb_build_object('chave','checklist_catalogo','texto','Existem ' || v_n || ' item(ns) obrigatórios do checklist sem avaliação');
  END IF;

  FOR r IN
    SELECT i.id, i.item
      FROM public.vistoria_itens i
     WHERE i.vistoria_id = _id AND i.condicao = 'ruim'
       AND NOT EXISTS (
         SELECT 1 FROM public.vistoria_avarias a
          WHERE a.item_id = i.id AND btrim(a.descricao) <> ''
            AND EXISTS (
              SELECT 1 FROM public.vistoria_evidencias e
               WHERE e.avaria_id = a.id
                 AND btrim(coalesce(e.caminho,'')) <> ''
                 AND coalesce(e.tamanho,0) > 0
            )
       )
  LOOP
    b := b || jsonb_build_object('chave','avaria-' || r.id,'texto', r.item || ': descreva a avaria e anexe ao menos uma foto');
  END LOOP;

  RETURN b;
END;
$$;

-- 4) Consulta oficial de pendências, usada pela tela do agente
CREATE OR REPLACE FUNCTION public.vistoria_bloqueios_conclusao(_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.vistorias;
  b jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v FROM public.vistorias WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vistoria não encontrada';
  END IF;
  IF NOT public.vistoria_visivel(_id) THEN
    RAISE EXCEPTION 'Sem permissão para consultar esta vistoria';
  END IF;

  IF v.status = 'concluida' THEN
    RETURN jsonb_build_object('ok', true, 'bloqueios', b);
  END IF;

  IF v.iniciada_em IS NULL THEN
    b := b || jsonb_build_object('chave','deslocamento','texto','Inicie o deslocamento antes de concluir a vistoria');
  END IF;
  IF v.chegada_em IS NULL THEN
    b := b || jsonb_build_object('chave','chegada','texto','Anuncie a chegada ao local antes de concluir a vistoria');
  END IF;
  IF v.km IS NULL OR v.km < 0 THEN
    b := b || jsonb_build_object('chave','km','texto','Registre a quilometragem lida no painel');
  END IF;

  b := b || public.vistoria_bloqueios_itens(_id);

  RETURN jsonb_build_object('ok', jsonb_array_length(b) = 0, 'bloqueios', b);
END;
$$;

-- 5) Validação final da conclusão — agora usando as mesmas regras
CREATE OR REPLACE FUNCTION public.vistorias_valida_conclusao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b jsonb;
  v_msg text;
BEGIN
  IF NEW.status <> 'concluida' OR OLD.status = 'concluida' THEN
    RETURN NEW;
  END IF;

  IF NEW.km IS NULL OR NEW.km < 0 THEN
    RAISE EXCEPTION 'Informe a quilometragem da motocicleta antes de concluir a vistoria';
  END IF;
  IF NEW.iniciada_em IS NULL THEN
    RAISE EXCEPTION 'Você precisa iniciar o deslocamento antes de concluir a vistoria';
  END IF;
  IF NEW.chegada_em IS NULL THEN
    RAISE EXCEPTION 'Você precisa anunciar sua chegada antes de concluir a vistoria';
  END IF;
  IF NOT NEW.termo_aceito THEN
    RAISE EXCEPTION 'É necessário aceitar o termo de responsabilidade antes de concluir';
  END IF;

  b := public.vistoria_bloqueios_itens(NEW.id);
  IF jsonb_array_length(b) > 0 THEN
    SELECT string_agg(x->>'texto', ' | ') INTO v_msg FROM jsonb_array_elements(b) x;
    RAISE EXCEPTION 'Não é possível concluir a vistoria: %', v_msg;
  END IF;

  RETURN NEW;
END;
$$;

-- 6) Auditoria de vistorias inconsistentes (somente equipe interna)
CREATE OR REPLACE FUNCTION public.vistorias_inconsistentes()
RETURNS TABLE (
  vistoria_id uuid,
  codigo text,
  locadora_id uuid,
  moto_id uuid,
  status public.status_vistoria,
  concluida_em timestamptz,
  fotos_faltando text,
  registros_sem_arquivo integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NOT public.equipe(auth.uid()) THEN
    RAISE EXCEPTION 'Somente a equipe interna pode auditar vistorias';
  END IF;

  RETURN QUERY
  SELECT v.id, v.codigo, v.locadora_id, v.moto_id, v.status, v.concluida_em,
         (SELECT string_agg(t.etapa, ', ' ORDER BY t.ord)
            FROM unnest(public.fotos_obrigatorias_vistoria()) WITH ORDINALITY AS t(etapa, ord)
           WHERE NOT public.vistoria_foto_valida(v.id, t.etapa)) AS fotos_faltando,
         (SELECT count(*)::int FROM public.vistoria_evidencias e
           WHERE e.vistoria_id = v.id
             AND (btrim(coalesce(e.caminho,'')) = ''
                  OR NOT EXISTS (SELECT 1 FROM storage.objects o
                                  WHERE o.bucket_id = 'evidencias' AND o.name = e.caminho))) AS registros_sem_arquivo
    FROM public.vistorias v
   WHERE v.status = 'concluida'
     AND (
       EXISTS (SELECT 1 FROM unnest(public.fotos_obrigatorias_vistoria()) AS etapa
                WHERE NOT public.vistoria_foto_valida(v.id, etapa))
       OR EXISTS (SELECT 1 FROM public.vistoria_evidencias e
                   WHERE e.vistoria_id = v.id
                     AND (btrim(coalesce(e.caminho,'')) = ''
                          OR NOT EXISTS (SELECT 1 FROM storage.objects o
                                          WHERE o.bucket_id = 'evidencias' AND o.name = e.caminho)))
     )
   ORDER BY v.concluida_em DESC NULLS LAST;
END;
$$;