ALTER TYPE public.status_ordem ADD VALUE IF NOT EXISTS 'pendente_definicao' BEFORE 'pendente';
ALTER TYPE public.status_ordem ADD VALUE IF NOT EXISTS 'liberada' AFTER 'pendente';