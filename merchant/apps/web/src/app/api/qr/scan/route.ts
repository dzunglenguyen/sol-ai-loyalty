import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { BRAND_HEX } from "@/lib/brand";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

function safeUrl(value: string | null, fallback: string): string {
  if (!value) return fallback;
  try {
    return new URL(value).toString();
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const campaignId = searchParams.get("campaignId");
  const slot = searchParams.get("slot") ?? "morning";
  const dynamic = searchParams.get("dynamic") === "1";
  const offer = searchParams.get("offer") ?? (slot === "morning" ? "cafe" : "milk-tea");
  const next = safeUrl(searchParams.get("next"), `${requestUrl.origin}/`);

  const qrPayload = searchParams.toString()
    ? `${next}${next.includes("?") ? "&" : "?"}${searchParams.toString()}`
    : next;

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabasePublishableKey();

  if (supabaseUrl && supabaseKey) {
    const sb = createClient(supabaseUrl, supabaseKey);
    const { error } = await sb.from("qr_scans").insert({
      campaign_id: campaignId,
      qr_payload: qrPayload,
      status: "opened",
      source: "qr_live_scan",
      metadata: {
        channel: "live_qr",
        slot,
        dynamic,
        offer,
        userAgent: request.headers.get("user-agent"),
      },
    });
    if (error) {
      console.error("[supabase] api/qr/scan insert", error);
    }
  }

  if (searchParams.get("next")) {
    return NextResponse.redirect(next, { status: 302 });
  }

  const navy = BRAND_HEX.shinhanNavy;
  const html = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Đã ghi nhận quét QR</title>
    <style>
      body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f3f0;color:#1a1a1a;margin:0;padding:24px}
      .card{max-width:520px;margin:10vh auto;background:#fff;border:1px solid #e5e4e1;border-radius:14px;padding:20px}
      .k{color:#5c5c5c;font-size:12px}
      .v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
      a{color:${navy}}
    </style>
  </head>
  <body>
    <div class="card">
      <h2 style="margin:0 0 8px;color:${navy}">Đã ghi nhận lượt quét QR</h2>
      <p style="margin:0 0 16px">Cảm ơn bạn đã quét mã. Hệ thống đã ghi nhận sự kiện thành công.</p>
      <div class="k">Campaign ID</div><div class="v">${campaignId ?? "-"}</div>
      <div class="k" style="margin-top:10px">Slot</div><div class="v">${slot}</div>
      <div class="k" style="margin-top:10px">Offer</div><div class="v">${offer}</div>
      <p style="margin-top:16px"><a href="${next}">Quay lại trang chính</a></p>
    </div>
  </body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
