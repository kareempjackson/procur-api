-- Migration: Create shipping_documents table
-- Description: Store shipping documentation for cross-country trade
-- Date: 2026-04-07

CREATE TABLE IF NOT EXISTS shipping_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  doc_type    TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_size   INT,
  mime_type   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_docs_seller ON shipping_documents(seller_org_id);

ALTER TABLE shipping_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY shipping_documents_read ON shipping_documents
  FOR SELECT USING (true);

COMMENT ON TABLE shipping_documents IS 'Shipping documents for cross-country trade (permits, certificates, etc.)';
