CREATE OR REPLACE FUNCTION public.consumir_token_push(_notificacao_id uuid, _token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_consumido uuid;
BEGIN
  DELETE FROM public.push_dispatch_tokens
  WHERE notificacao_id = _notificacao_id
    AND token = _token
    AND expira_em >= now()
  RETURNING notificacao_id INTO v_consumido;
  RETURN v_consumido IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.consumir_token_push(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_token_push(uuid, uuid) TO service_role;