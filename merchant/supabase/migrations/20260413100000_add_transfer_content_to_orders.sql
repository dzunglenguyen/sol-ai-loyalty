-- Add transfer content for bank reconciliation/search
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS transfer_content TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_transfer_content ON orders(transfer_content);
