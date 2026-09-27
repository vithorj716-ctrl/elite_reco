insert into public.push_config (chave, valor) values
  ('endpoint_despacho', 'https://betaroni1.lovable.app/api/public/push/despachar'),
  ('segredo_despacho', '4KULd7cAIbuaRq7CD4Il0WN0ln-b425_ZzXL4nF5bdkb4yff')
on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

revoke all on function public.disparar_push_notificacao() from public, anon, authenticated;