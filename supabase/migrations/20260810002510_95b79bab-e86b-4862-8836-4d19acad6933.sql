do $$
begin
  if exists (select 1 from cron.job where jobname = 'reprocessar-fila-push') then
    perform cron.unschedule('reprocessar-fila-push');
  end if;
end;
$$;