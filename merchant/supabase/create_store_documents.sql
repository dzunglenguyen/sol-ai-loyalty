-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor)
-- Table for AI Store Knowledge Base

CREATE TABLE IF NOT EXISTS store_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_key TEXT NOT NULL DEFAULT 'shinhan-demo',
  doc_type TEXT NOT NULL CHECK (doc_type IN ('menu', 'space_image', 'brand_voice')),
  title TEXT NOT NULL,
  file_name TEXT,
  extracted_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE store_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access for hackathon demo"
  ON store_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);
