import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { image_base64, doc_type, file_name } = await req.json();

    // Support multiple LLM providers via LLM_PROVIDER env var ("gemini" | "xai" | "dashscope", default "xai")
    const provider = (process.env.LLM_PROVIDER ?? "xai").toLowerCase();

    let apiKey: string;
    let baseURL: string;
    let model: string;
    let providerName: string;

    if (provider === "gemini") {
      apiKey = process.env.GEMINI_API_KEY ?? "";
      baseURL = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
      model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
      providerName = "Gemini";
    } else if (provider === "dashscope") {
      apiKey = process.env.DASHSCOPE_API_KEY ?? "";
      baseURL = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
      // Use vision model for image processing, fall back to configured model for text
      model = "qwen-vl-ocr";
      providerName = "DashScope";
    } else {
      apiKey = process.env.XAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
      baseURL = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
      model = process.env.XAI_MODEL ?? "grok-4.20-reasoning";
      providerName = "xAI";
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `${provider.toUpperCase()}_API_KEY not configured in web .env.local` },
        { status: 500 },
      );
    }

    const isMenu = doc_type === "menu";

    const systemPrompt = isMenu
      ? `Extract ALL menu items from this image. Return ONLY a JSON array, no markdown, no explanation. Each element: {"name":"item name","price":45000,"category":"category","description":"short desc or empty"}. Rules: price is integer VND (0 if unclear), category is section header (e.g. "Coffee","Main"), no extra commentary.`
      : `Bạn là chuyên gia đánh giá không gian F&B. Mô tả chi tiết không gian cửa hàng trong ảnh:
- Phong cách thiết kế (vintage, hiện đại, minimalist, v.v.)
- Loại chỗ ngồi (trong nhà/ngoài trời, sân thượng, view, v.v.)
- Tiện nghi đặc biệt (điều hòa, wifi, phòng riêng, v.v.)
- Sức chứa ước tính
- Bầu không khí và cảm nhận tổng thể
- Điểm mạnh marketing (view đẹp, yên tĩnh, v.v.)

LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT.`;

    const mediaType = file_name?.toLowerCase().endsWith(".png")
      ? "image/png"
      : file_name?.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    // Gemini OpenAI-compatible endpoint requires API key as BOTH query param AND Authorization header
    // DashScope uses standard OpenAI-compatible format with Bearer token
    const url = provider === "gemini"
      ? `${baseURL}chat/completions?key=${apiKey}`
      : `${baseURL.replace(/\/+$/, "")}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };

    // Build request body — menu uses JSON mode + higher token limit
    // DashScope VL models work better with system prompt merged into user message
    const messages = provider === "dashscope"
      ? [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: systemPrompt + "\n\n" + (isMenu
                  ? "Extract all items from this menu image."
                  : "Hãy phân tích không gian cửa hàng trong ảnh này."),
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${image_base64}`,
                },
              },
            ],
          },
        ]
      : [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${image_base64}`,
                },
              },
              {
                type: "text",
                text: isMenu
                  ? "Extract all items from this menu image."
                  : "Hãy phân tích không gian cửa hàng trong ảnh này.",
              },
            ],
          },
        ];

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: isMenu ? (provider === "dashscope" ? 8192 : 65536) : 4096,
    };

    // Force JSON output for menu extraction (not all providers/models support this)
    if (isMenu && provider !== "dashscope") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[process-document] ${providerName} API error:`, response.status, errBody);
      return NextResponse.json(
        { error: `${providerName} API error: ${response.status}: ${errBody}` },
        { status: 502 },
      );
    }

    const result = await response.json();
    const content: string =
      result.choices?.[0]?.message?.content ?? "Không thể trích xuất nội dung.";

    if (doc_type === "menu") {
      // Try to parse JSON from LLM response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let menu_items: any[] | null = null;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          menu_items = parsed;
        } else if (parsed && typeof parsed === "object") {
          // response_format: json_object may wrap array in an object like { items: [...] } or { menu: [...] }
          const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
          if (arrayKey) {
            menu_items = parsed[arrayKey];
          } else {
            // Single object — wrap in array
            menu_items = [parsed];
          }
        }
      } catch {
        // LLM may have wrapped in markdown — try regex extraction
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) {
              menu_items = parsed;
            }
          } catch {
            menu_items = null;
          }
        }
      }

      let extracted_text: string;
      if (menu_items) {
        extracted_text = menu_items
          .map(
            (item) =>
              `Tên món: ${item.name} | Giá: ${item.price}đ | Danh mục: ${item.category}`,
          )
          .join("\n");
      } else {
        extracted_text = content;
      }

      return NextResponse.json({ extracted_text, menu_items });
    }

    return NextResponse.json({ extracted_text: content });
  } catch (err) {
    console.error("[process-document] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
