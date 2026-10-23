CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS businesses_user_id_idx ON public.businesses (user_id);
CREATE INDEX IF NOT EXISTS businesses_updated_at_idx ON public.businesses (updated_at);

CREATE TABLE IF NOT EXISTS public.business_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients (user_id);
CREATE INDEX IF NOT EXISTS clients_created_at_idx ON public.clients (created_at);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  number VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT invoices_user_number_idx UNIQUE (user_id, number)
);
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON public.invoices (created_at);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  number VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT documents_user_number_idx UNIQUE (user_id, number)
);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS documents_created_at_idx ON public.documents (created_at);

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  number VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT quotes_user_number_idx UNIQUE (user_id, number)
);
CREATE INDEX IF NOT EXISTS quotes_user_id_idx ON public.quotes (user_id);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx ON public.quotes (created_at);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS invoice_items_user_id_idx ON public.invoice_items (user_id);
CREATE INDEX IF NOT EXISTS invoice_items_created_at_idx ON public.invoice_items (created_at);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY,
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  provider_reference VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  document_type VARCHAR(20) NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year, document_type)
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
