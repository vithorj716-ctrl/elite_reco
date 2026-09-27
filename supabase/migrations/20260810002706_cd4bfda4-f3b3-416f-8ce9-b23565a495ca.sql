CREATE TABLE public.push_dispatch_tokens (
  notificacao_id uuid PRIMARY KEY REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
GRANT ALL ON public.push_dispatch_tokens TO service_role;
ALTER TABLE public.push_dispatch_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX push_dispatch_tokens_expira_idx ON public.push_dispatch_tokens (expira_em);

CREATE OR REPLACE FUNCTION public.disparar_push_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text;
  v_token uuid;
BEGIN
  SELECT valor INTO v_url FROM public.push_config WHERE chave = 'endpoint_despacho';

  IF v_url IS NULL THEN
    INSERT INTO public.push_notification_logs
      (notification_id, usuario_id, status, erro)
    VALUES
      (NEW.id, NEW.usuario_id, 'erro_trigger', 'Endpoint de despacho ausente');
    RETURN NEW;
  END IF;

  DELETE FROM public.push_dispatch_tokens WHERE expira_em < now();
  INSERT INTO public.push_dispatch_tokens (notificacao_id)
  VALUES (NEW.id)
  ON CONFLICT (notificacao_id) DO UPDATE
    SET token = gen_random_uuid(), criado_em = now(), expira_em = now() + interval '10 minutes'
  RETURNING token INTO v_token;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('notificacao_id', NEW.id, 'token', v_token),
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

DELETE FROM public.push_config WHERE chave = 'segredo_despacho';