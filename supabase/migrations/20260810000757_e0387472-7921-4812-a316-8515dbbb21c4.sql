update public.notificacoes n
set entregue_em = null
where n.entregue_em is not null
  and not exists (
    select 1 from public.push_notification_logs l where l.notification_id = n.id
  );