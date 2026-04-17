import { getSupabaseBrowserClient, getCurrentMerchantKey } from "./client";

export type DocType = "menu" | "space_image" | "brand_voice";

export type StoreDocument = {
  id: string;
  merchant_key: string;
  doc_type: DocType;
  title: string;
  file_name: string | null;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
};

async function queryDocumentsByKey(key: string): Promise<StoreDocument[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb || !key) return [];
  const { data, error } = await sb
    .from("store_documents")
    .select("*")
    .eq("merchant_key", key)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[supabase] queryDocumentsByKey", key, error);
    return [];
  }
  return (data ?? []) as StoreDocument[];
}

async function backfillLegacyDocuments(targetKey: string): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb || !targetKey) return false;

  const legacyKeys = ["", "shinhan-demo"];
  const { data, error } = await sb
    .from("store_documents")
    .select("id")
    .in("merchant_key", legacyKeys)
    .limit(200);

  if (error || !data || data.length === 0) return false;

  const ids = data.map((row) => row.id);
  const { error: updateError } = await sb
    .from("store_documents")
    .update({ merchant_key: targetKey })
    .in("id", ids);

  if (updateError) {
    console.error("[supabase] backfillLegacyDocuments(update)", updateError);
    return false;
  }
  return true;
}

export async function listDocuments(
  merchantKey?: string,
): Promise<StoreDocument[]> {
  const key = merchantKey ?? await getCurrentMerchantKey();
  if (!key) return [];

  const directDocs = await queryDocumentsByKey(key);
  if (directDocs.length > 0) return directDocs;

  const backfilled = await backfillLegacyDocuments(key);
  if (backfilled) {
    return queryDocumentsByKey(key);
  }
  return [];
}

export async function listDocumentsByType(
  docType: DocType,
  merchantKey?: string,
): Promise<StoreDocument[]> {
  const key = merchantKey ?? await getCurrentMerchantKey();
  const sb = getSupabaseBrowserClient();
  if (!sb || !key) return [];
  const { data, error } = await sb
    .from("store_documents")
    .select("*")
    .eq("merchant_key", key)
    .eq("doc_type", docType)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[supabase] listDocumentsByType", error);
    return [];
  }
  return data as StoreDocument[];
}

export async function insertDocument(
  doc: Omit<StoreDocument, "id" | "created_at" | "updated_at">,
): Promise<StoreDocument | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("store_documents")
    .insert({
      merchant_key: doc.merchant_key,
      doc_type: doc.doc_type,
      title: doc.title,
      file_name: doc.file_name,
      extracted_text: doc.extracted_text,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[supabase] insertDocument", error);
    return null;
  }
  return data as StoreDocument;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("store_documents").delete().eq("id", id);
  if (error) {
    console.error("[supabase] deleteDocument", error);
    return false;
  }
  return true;
}

export function buildKnowledgeDigest(docs: StoreDocument[]): string {
  if (docs.length === 0) return "";

  const menuDocs = docs.filter((d) => d.doc_type === "menu");
  const spaceDocs = docs.filter((d) => d.doc_type === "space_image");
  const brandDocs = docs.filter((d) => d.doc_type === "brand_voice");

  const parts: string[] = [];

  if (menuDocs.length > 0) {
    parts.push("=== MENU / BẢNG GIÁ CỬA HÀNG ===");
    menuDocs.forEach((d) => {
      parts.push(`[${d.title}]`);
      if (d.extracted_text) parts.push(d.extracted_text);
    });
  }

  if (spaceDocs.length > 0) {
    parts.push("\n=== KHÔNG GIAN / VỊ TRÍ CỬA HÀNG ===");
    spaceDocs.forEach((d) => {
      parts.push(`[${d.title}]`);
      if (d.extracted_text) parts.push(d.extracted_text);
    });
  }

  if (brandDocs.length > 0) {
    parts.push("\n=== PHONG CÁCH & CHÍNH SÁCH THƯƠNG HIỆU ===");
    brandDocs.forEach((d) => {
      parts.push(`[${d.title}]`);
      if (d.extracted_text) parts.push(d.extracted_text);
    });
  }

  return parts.join("\n");
}
