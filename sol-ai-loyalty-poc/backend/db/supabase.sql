-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  merchant_key text NOT NULL DEFAULT 'shinhan-demo'::text,
  title text NOT NULL DEFAULT ''::text,
  draft jsonb NOT NULL,
  status text NOT NULL DEFAULT 'idle'::text CHECK (status = ANY (ARRAY['idle'::text, 'drafting'::text, 'published'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);
CREATE TABLE public.merchant_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_key text NOT NULL DEFAULT 'shinhan-demo'::text UNIQUE,
  business_name text,
  sector text,
  aov_vnd integer,
  peak_hours text,
  customer_segment text,
  ai_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  address_text text,
  maps_url text,
  latitude double precision,
  longitude double precision,
  CONSTRAINT merchant_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT merchant_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  merchant_key text NOT NULL,
  campaign_id uuid,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal integer NOT NULL DEFAULT 0,
  discount_amount integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  qr_payload text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.qr_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  qr_payload text NOT NULL,
  status text NOT NULL DEFAULT 'scanned'::text CHECK (status = ANY (ARRAY['scanned'::text, 'opened'::text, 'redeemed'::text, 'expired'::text])),
  source text DEFAULT 'simulated'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT qr_scans_pkey PRIMARY KEY (id),
  CONSTRAINT qr_scans_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.store_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  merchant_key text NOT NULL DEFAULT 'shinhan-demo'::text,
  doc_type text NOT NULL CHECK (doc_type = ANY (ARRAY['menu'::text, 'space_image'::text, 'brand_voice'::text])),
  title text NOT NULL,
  file_name text,
  extracted_text text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT store_documents_pkey PRIMARY KEY (id)
);