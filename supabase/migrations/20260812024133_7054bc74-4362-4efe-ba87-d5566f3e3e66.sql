CREATE UNIQUE INDEX IF NOT EXISTS motos_placa_locadora_uk ON public.motos (locadora_id, upper(btrim(placa)));

CREATE OR REPLACE FUNCTION public.motos_bloqueia_exclusao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vistorias WHERE moto_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.vistoria_evidencias WHERE moto_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.vistoria_historico WHERE moto_id = OLD.id) THEN
    RAISE EXCEPTION 'Esta moto possui histórico operacional e não pode ser excluída definitivamente. Ela será inativada para preservar o histórico.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS motos_bloqueia_exclusao_trg ON public.motos;
CREATE TRIGGER motos_bloqueia_exclusao_trg
BEFORE DELETE ON public.motos
FOR EACH ROW EXECUTE FUNCTION public.motos_bloqueia_exclusao();