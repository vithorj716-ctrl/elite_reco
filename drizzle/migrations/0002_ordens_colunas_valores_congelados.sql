ALTER TABLE public.ordens
  ADD COLUMN IF NOT EXISTS valor_cobranca_base numeric,
  ADD COLUMN IF NOT EXISTS valor_cobranca_adicional numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_cobranca_final numeric,
  ADD COLUMN IF NOT EXISTS valor_pagamento_base numeric,
  ADD COLUMN IF NOT EXISTS valor_pagamento_adicional numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pagamento_final numeric,
  ADD COLUMN IF NOT EXISTS horario_especial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS definido_por uuid,
  ADD COLUMN IF NOT EXISTS definido_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberado_por uuid,
  ADD COLUMN IF NOT EXISTS liberado_em timestamptz,
  ADD COLUMN IF NOT EXISTS legado boolean NOT NULL DEFAULT false;