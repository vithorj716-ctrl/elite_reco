REVOKE UPDATE ON public.notificacoes FROM authenticated;
GRANT UPDATE (lida, lida_em) ON public.notificacoes TO authenticated;

CREATE OR REPLACE FUNCTION public.disparar_push_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text;
  v_segredo text;
BEGIN
  SELECT valor INTO v_url FROM public.push_config WHERE chave = 'endpoint_despacho';
  SELECT valor INTO v_segredo FROM public.push_config WHERE chave = 'segredo_despacho';

  IF v_url IS NULL OR v_segredo IS NULL THEN
    INSERT INTO public.push_notification_logs
      (notification_id, usuario_id, status, erro)
    VALUES
      (NEW.id, NEW.usuario_id, 'erro_trigger', 'Configuração de despacho ausente');
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_segredo
    ),
    body := jsonb_build_object('notificacao_id', NEW.id),
    timeout_milliseconds := 8000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.push_notification_logs
      (notification_id, usuario_id, status, erro)
    VALUES
      (NEW.id, NEW.usuario_id, 'erro_trigger', left(SQLERRM, 400));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao registrar erro de push: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.disparar_push_notificacao() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disparar_push_notificacao() TO service_role;