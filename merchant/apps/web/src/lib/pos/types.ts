export type OrderStatus = "pending" | "paid" | "cancelled";

export interface OrderItemRecord {
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface OrderRow {
  id: string;
  merchant_key: string;
  campaign_id: string | null;
  status: OrderStatus;
  items: OrderItemRecord[];
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  qr_payload: string | null;
  transfer_content: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}
