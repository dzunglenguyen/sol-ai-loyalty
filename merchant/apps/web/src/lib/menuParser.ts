export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
}

/**
 * Parse stored menu document text into structured Product objects.
 * Supports formats:
 *   "Tên món: X | Giá: Yđ | Danh mục: Z"
 *   "X: 45.000đ (Z) — Mô tả"
 *   "X: 45.000đ (Z)"
 */
export function parseMenuFromDocumentText(extractedText: string): Product[] {
  if (!extractedText?.trim()) return [];

  const lines = extractedText.split("\n").filter((l) => l.trim());
  const products: Product[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed =
      parsePipeFormat(line) ??
      parseColonFormat(line) ??
      parseDashFormat(line);

    if (parsed && !seen.has(parsed.name.toLowerCase())) {
      seen.add(parsed.name.toLowerCase());
      products.push({
        id: crypto.randomUUID(),
        ...parsed,
      });
    }
  }

  return products;
}

/** Format: "Tên món: X | Giá: Yđ | Danh mục: Z" */
function parsePipeFormat(line: string): Omit<Product, "id"> | null {
  const parts = line.split("|").map((s) => s.trim());
  if (parts.length < 2) return null;

  let name = "";
  let price = 0;
  let category = "";
  let description = "";

  for (const part of parts) {
    if (part.startsWith("Tên món:")) {
      name = part.replace("Tên món:", "").trim();
    } else if (part.startsWith("Giá:")) {
      price = parseVndNumber(part.replace("Giá:", ""));
    } else if (part.startsWith("Danh mục:")) {
      category = part.replace("Danh mục:", "").trim();
    } else if (part.startsWith("Mô tả:")) {
      description = part.replace("Mô tả:", "").trim();
    }
  }

  if (!name) return null;
  return { name, price, category, description };
}

/** Format: "Cà Phê Đen: 28.000đ (CÀ PHÊ PHA PHIN) — 250 ml" */
function parseColonFormat(line: string): Omit<Product, "id"> | null {
  const match = line.match(/^(.+?):\s*([\d.,]+)\s*đ/);
  if (!match) return null;

  const name = match[1].trim();
  const price = parseVndNumber(match[2]);

  // Extract category from parentheses
  const catMatch = line.match(/\(([^)]+)\)/);
  const category = catMatch ? catMatch[1].trim() : "";

  // Extract description after em-dash
  const descMatch = line.match(/—\s*(.+)$/);
  const description = descMatch ? descMatch[1].trim() : "";

  return { name, price, category, description };
}

/** Format: "- Cà Phê Đen: 28,000 VND" */
function parseDashFormat(line: string): Omit<Product, "id"> | null {
  const cleaned = line.replace(/^[-•*]\s*/, "");
  const match = cleaned.match(/^(.+?)[:\s]+([\d.,]+)\s*(đ|VND|vnd)?/);
  if (!match) return null;

  return {
    name: match[1].trim(),
    price: parseVndNumber(match[2]),
    category: "",
    description: "",
  };
}

/** Parse Vietnamese-formatted number: "28.000" or "28,000" → 28000 */
function parseVndNumber(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return parseInt(digits, 10) || 0;
}
