create extension if not exists pg_cron with schema extensions;

create or replace function public.reprocessar_fila_push()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_segredo text;
begin
  select valor into v_url from public.push_config where chave = 'endpoint_despacho';
  select valor into v_segredo from public.push_config where chave = 'segredo_despacho';

  if v_url is null or v_segredo is null then
    raise warning 'Configuração de despacho de push ausente';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_segredo
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
exception when others then
  raise warning 'Falha ao agendar retentativa de push: %', sqlerrm;
end;
$$;

revoke all on function public.reprocessar_fila_push() from public, anon, authenticated;
grant execute on function public.reprocessar_fila_push() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'reprocessar-fila-push') then
    perform cron.unschedule('reprocessar-fila-push');
  end if;
  perform cron.schedule(
    'reprocessar-fila-push',
    '* * * * *',
    'select public.reprocessar_fila_push();'
  );
end;
$$;