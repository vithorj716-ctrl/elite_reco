CREATE TABLE public.ordem_cobrancas (
  id uuid primary key default gen_random_uuid(),
  ordem_id uuid not null references public.ordens(id) on delete cascade,
  locadora_id uuid not null references public.locadoras(id),
  nome text not null default '',
  valor numeric not null default 0,
  observacao text not null default '',
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordem_cobrancas TO authenticated;
GRANT ALL ON public.ordem_cobrancas TO service_role;

ALTER TABLE public.ordem_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas visiveis" ON public.ordem_cobrancas FOR SELECT TO authenticated
USING (public.equipe(auth.uid()) OR locadora_id = public.locadora_do_usuario(auth.uid()));

CREATE POLICY "equipe cria cobrancas" ON public.ordem_cobrancas FOR INSERT TO authenticated
WITH CHECK (public.equipe(auth.uid()));

CREATE POLICY "equipe atualiza cobrancas" ON public.ordem_cobrancas FOR UPDATE TO authenticated
USING (public.equipe(auth.uid())) WITH CHECK (public.equipe(auth.uid()));

CREATE POLICY "equipe apaga cobrancas" ON public.ordem_cobrancas FOR DELETE TO authenticated
USING (public.equipe(auth.uid()));

CREATE INDEX ordem_cobrancas_ordem_idx ON public.ordem_cobrancas(ordem_id);

CREATE TRIGGER ordem_cobrancas_atualizado BEFORE UPDATE ON public.ordem_cobrancas
FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ordem_cobrancas;