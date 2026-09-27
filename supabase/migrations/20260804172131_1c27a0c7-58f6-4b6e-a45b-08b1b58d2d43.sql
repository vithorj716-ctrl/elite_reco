create type public.app_role as enum ('super_admin', 'operador', 'cliente', 'agente');
create type public.status_ordem as enum ('pendente','distribuida','em_andamento','concluida','cancelada');
create type public.prioridade as enum ('baixa','normal','alta','urgente');
create type public.tipo_servico as enum ('captura_normal','captura_dificil','busca_especial');

create table public.locadoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text not null default '',
  cidade text not null default '',
  uf text not null default '',
  responsavel text not null default '',
  telefone text not null default '',
  email text not null default '',
  ativa boolean not null default true,
  criada_em timestamptz not null default now()
);
grant select, insert, update, delete on public.locadoras to authenticated;
grant all on public.locadoras to service_role;
alter table public.locadoras enable row level security;

create table public.agentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null default '',
  cidade text not null default '',
  ativo boolean not null default true,
  online boolean not null default false,
  criado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.agentes to authenticated;
grant all on public.agentes to service_role;
alter table public.agentes enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  locadora_id uuid references public.locadoras(id) on delete set null,
  agente_id uuid references public.agentes(id) on delete set null,
  criado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.locadora_do_usuario(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select locadora_id from public.profiles where id = _user_id
$$;

create or replace function public.agente_do_usuario(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select agente_id from public.profiles where id = _user_id
$$;

create or replace function public.equipe(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'super_admin') or public.has_role(_user_id,'operador')
$$;

create table public.ordens (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  locadora_id uuid not null references public.locadoras(id) on delete restrict,
  agente_id uuid references public.agentes(id) on delete set null,
  placa text not null,
  marca text not null default '',
  modelo text not null default '',
  ano text not null default '',
  cor text not null default '',
  valor_pendente numeric not null default 0,
  telefone text not null default '',
  endereco text not null default '',
  cidade text not null default '',
  observacoes text,
  link_rastreador text,
  prioridade prioridade not null default 'normal',
  tipo_servico tipo_servico not null default 'captura_normal',
  status status_ordem not null default 'pendente',
  checklist jsonb,
  termo_aceito boolean not null default false,
  recebimento_pago boolean not null default false,
  pagamento_pago boolean not null default false,
  criada_em timestamptz not null default now(),
  distribuida_em timestamptz,
  iniciada_em timestamptz,
  chegada_em timestamptz,
  concluida_em timestamptz
);
create index ordens_locadora_idx on public.ordens (locadora_id);
create index ordens_agente_idx on public.ordens (agente_id);
create index ordens_status_idx on public.ordens (status);
grant select, insert, update, delete on public.ordens to authenticated;
grant all on public.ordens to service_role;
alter table public.ordens enable row level security;

create table public.ordem_fotos (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.ordens(id) on delete cascade,
  imagem text not null,
  etapa text not null,
  criada_em timestamptz not null default now()
);
create index ordem_fotos_ordem_idx on public.ordem_fotos (ordem_id);
grant select, insert on public.ordem_fotos to authenticated;
grant all on public.ordem_fotos to service_role;
alter table public.ordem_fotos enable row level security;

create table public.ordem_historico (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.ordens(id) on delete cascade,
  quem text not null,
  quando timestamptz not null default now(),
  acao text not null,
  detalhe text,
  gps text
);
create index ordem_historico_ordem_idx on public.ordem_historico (ordem_id);
grant select, insert on public.ordem_historico to authenticated;
grant all on public.ordem_historico to service_role;
alter table public.ordem_historico enable row level security;

create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  locadora_id uuid not null references public.locadoras(id) on delete cascade,
  arquivo text not null,
  total integer not null default 0,
  autor text not null default '',
  criada_em timestamptz not null default now()
);
grant select, insert on public.importacoes to authenticated;
grant all on public.importacoes to service_role;
alter table public.importacoes enable row level security;

create table public.precos (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('locadora','agente')),
  referencia_id uuid not null,
  tipo_servico tipo_servico not null,
  valor numeric not null default 0,
  unique (escopo, referencia_id, tipo_servico)
);
grant select, insert, update, delete on public.precos to authenticated;
grant all on public.precos to service_role;
alter table public.precos enable row level security;

create policy "locadoras visiveis" on public.locadoras for select to authenticated
  using (public.equipe(auth.uid()) or id = public.locadora_do_usuario(auth.uid()));
create policy "equipe gerencia locadoras" on public.locadoras for insert to authenticated
  with check (public.equipe(auth.uid()));
create policy "equipe atualiza locadoras" on public.locadoras for update to authenticated
  using (public.equipe(auth.uid())) with check (public.equipe(auth.uid()));
create policy "admin apaga locadoras" on public.locadoras for delete to authenticated
  using (public.has_role(auth.uid(),'super_admin'));

create policy "perfis visiveis" on public.profiles for select to authenticated
  using (id = auth.uid() or public.equipe(auth.uid()));
create policy "atualiza perfil proprio" on public.profiles for update to authenticated
  using (id = auth.uid() or public.equipe(auth.uid()))
  with check (id = auth.uid() or public.equipe(auth.uid()));

create policy "papeis visiveis" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.equipe(auth.uid()));

create policy "agentes visiveis" on public.agentes for select to authenticated
  using (public.equipe(auth.uid()) or id = public.agente_do_usuario(auth.uid()));
create policy "equipe cria agentes" on public.agentes for insert to authenticated
  with check (public.equipe(auth.uid()));
create policy "equipe atualiza agentes" on public.agentes for update to authenticated
  using (public.equipe(auth.uid()) or id = public.agente_do_usuario(auth.uid()))
  with check (public.equipe(auth.uid()) or id = public.agente_do_usuario(auth.uid()));
create policy "equipe apaga agentes" on public.agentes for delete to authenticated
  using (public.equipe(auth.uid()));

create policy "ordens por nivel" on public.ordens for select to authenticated using (
  public.equipe(auth.uid())
  or locadora_id = public.locadora_do_usuario(auth.uid())
  or agente_id = public.agente_do_usuario(auth.uid())
);
create policy "equipe cria ordens" on public.ordens for insert to authenticated
  with check (public.equipe(auth.uid()));
create policy "equipe atualiza ordens" on public.ordens for update to authenticated
  using (public.equipe(auth.uid())) with check (public.equipe(auth.uid()));
create policy "agente atualiza sua ordem" on public.ordens for update to authenticated
  using (agente_id = public.agente_do_usuario(auth.uid()))
  with check (agente_id = public.agente_do_usuario(auth.uid()));
create policy "equipe apaga ordens" on public.ordens for delete to authenticated
  using (public.equipe(auth.uid()));

create policy "fotos visiveis" on public.ordem_fotos for select to authenticated using (
  exists (select 1 from public.ordens o where o.id = ordem_id and (
    public.equipe(auth.uid())
    or o.locadora_id = public.locadora_do_usuario(auth.uid())
    or o.agente_id = public.agente_do_usuario(auth.uid())))
);
create policy "envia fotos" on public.ordem_fotos for insert to authenticated with check (
  exists (select 1 from public.ordens o where o.id = ordem_id and (
    public.equipe(auth.uid()) or o.agente_id = public.agente_do_usuario(auth.uid())))
);

create policy "historico visivel" on public.ordem_historico for select to authenticated using (
  exists (select 1 from public.ordens o where o.id = ordem_id and (
    public.equipe(auth.uid())
    or o.locadora_id = public.locadora_do_usuario(auth.uid())
    or o.agente_id = public.agente_do_usuario(auth.uid())))
);
create policy "registra historico" on public.ordem_historico for insert to authenticated with check (
  exists (select 1 from public.ordens o where o.id = ordem_id and (
    public.equipe(auth.uid()) or o.agente_id = public.agente_do_usuario(auth.uid())))
);

create policy "importacoes por nivel" on public.importacoes for select to authenticated
  using (public.equipe(auth.uid()) or locadora_id = public.locadora_do_usuario(auth.uid()));
create policy "equipe importa" on public.importacoes for insert to authenticated
  with check (public.equipe(auth.uid()));

create policy "precos visiveis" on public.precos for select to authenticated
  using (public.equipe(auth.uid()));
create policy "precos equipe cria" on public.precos for insert to authenticated
  with check (public.equipe(auth.uid()));
create policy "precos equipe atualiza" on public.precos for update to authenticated
  using (public.equipe(auth.uid())) with check (public.equipe(auth.uid()));
create policy "precos equipe apaga" on public.precos for delete to authenticated
  using (public.equipe(auth.uid()));

alter table public.locadoras replica identity full;
alter table public.agentes replica identity full;
alter table public.profiles replica identity full;
alter table public.user_roles replica identity full;
alter table public.ordens replica identity full;
alter table public.ordem_fotos replica identity full;
alter table public.ordem_historico replica identity full;
alter table public.importacoes replica identity full;
alter table public.precos replica identity full;

alter publication supabase_realtime add table public.locadoras;
alter publication supabase_realtime add table public.agentes;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.user_roles;
alter publication supabase_realtime add table public.ordens;
alter publication supabase_realtime add table public.ordem_fotos;
alter publication supabase_realtime add table public.ordem_historico;
alter publication supabase_realtime add table public.importacoes;
alter publication supabase_realtime add table public.precos;