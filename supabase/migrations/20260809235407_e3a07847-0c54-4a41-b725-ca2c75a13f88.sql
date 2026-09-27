create extension if not exists pg_net with schema extensions;

alter table public.push_subscriptions
  add column if not exists agente_id uuid references public.agentes(id) on delete set null,
  add column if not exists user_agent text not null default '',
  add column if not exists ultimo_erro text not null default '',
  add column if not exists ultimo_envio_em timestamptz;

create index if not exists push_subscriptions_usuario_ativo_idx
  on public.push_subscriptions (usuario_id) where ativo;

create table if not exists public.push_notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notificacoes(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  usuario_id uuid,
  status text not null default 'enviado',
  erro text not null default '',
  enviado_em timestamptz not null default now()
);

grant select on public.push_notification_logs to authenticated;
grant all on public.push_notification_logs to service_role;
alter table public.push_notification_logs enable row level security;

create policy "equipe le logs de push"
  on public.push_notification_logs for select to authenticated
  using (public.equipe(auth.uid()));

create table if not exists public.push_config (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);

grant all on public.push_config to service_role;
alter table public.push_config enable row level security;
-- sem policies: apenas service_role e funções security definer acessam

create or replace function public.disparar_push_notificacao()
returns trigger
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
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_segredo
    ),
    body := jsonb_build_object('notificacao_id', new.id),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists disparar_push_notificacao_trg on public.notificacoes;
create trigger disparar_push_notificacao_trg
after insert on public.notificacoes
for each row execute function public.disparar_push_notificacao();