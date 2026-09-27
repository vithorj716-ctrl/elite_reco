ALTER TABLE public.ordens DISABLE TRIGGER USER;

UPDATE public.ordens o
   SET horario_especial = public.em_horario_especial(coalesce(o.criada_em, now()));

UPDATE public.ordens o
   SET valor_cobranca_base = d.valor_cobranca_base,
       valor_cobranca_adicional = coalesce(d.valor_cobranca_adicional, 0),
       valor_cobranca_final = d.valor_cobranca,
       valor_pagamento_base = d.valor_pagamento_base,
       valor_pagamento_adicional = coalesce(d.valor_pagamento_adicional, 0),
       valor_pagamento_final = d.valor_pagamento,
       horario_especial = d.horario_especial,
       definido_por = d.aprovada_por, definido_em = d.aprovada_em,
       liberado_por = d.aprovada_por, liberado_em = d.aprovada_em
  FROM public.distribuicoes d
 WHERE d.ordem_id = o.id AND d.aprovada_em IS NOT NULL;

-- ordens antigas: preserva exatamente o valor já gravado, sem consultar a tabela atual
UPDATE public.ordens o
   SET valor_cobranca_final = coalesce(o.valor_cobranca_final, o.valor_cobranca),
       valor_pagamento_final = coalesce(o.valor_pagamento_final, o.valor_pagamento),
       valor_cobranca_base = coalesce(o.valor_cobranca_base, o.valor_cobranca),
       valor_pagamento_base = coalesce(o.valor_pagamento_base, o.valor_pagamento),
       legado = true,
       liberado_em = coalesce(o.liberado_em, o.distribuida_em, o.criada_em)
 WHERE o.liberado_em IS NULL
   AND o.status::text IN ('distribuida','em_andamento','concluida','cancelada');

UPDATE public.ordens SET status = 'liberada'
 WHERE status::text = 'pendente' AND liberado_em IS NOT NULL;
UPDATE public.ordens SET status = 'pendente_definicao'
 WHERE status::text = 'pendente';

ALTER TABLE public.ordens ENABLE TRIGGER USER;