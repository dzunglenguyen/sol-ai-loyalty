"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, RefreshCcw, TrendingUp } from "lucide-react";
import { formatCompact, formatVND } from "@/lib/formatCurrency";
import {
  getStoreRevenueAnalytics,
  type AnalyticsRangeKey,
  type RevenueTrendPoint,
  type StoreRevenueAnalytics,
} from "@/lib/supabase/ordersRepo";
import { getQrScanCountsForCampaigns } from "@/lib/supabase/qrScansRepo";
import { listCampaigns } from "@/lib/supabase/campaignsRepo";

type AlertRow = { key: string; title: string; detail: string; level: "warn" | "info" };

const RANGE_OPTIONS: Array<{ key: AnalyticsRangeKey; label: string }> = [
  { key: "15m", label: "15 phút" },
  { key: "60m", label: "60 phút" },
  { key: "today", label: "Hôm nay" },
];

function padTrend(points: RevenueTrendPoint[], rangeStartIso: string, nowIso: string, stepMinutes: number) {
  const map = new Map(points.map((p) => [p.bucketStartIso, p]));
  const out: RevenueTrendPoint[] = [];
  const start = new Date(rangeStartIso);
  const end = new Date(nowIso);
  const stepMs = stepMinutes * 60_000;
  const alignedStartMs = Math.floor(start.getTime() / stepMs) * stepMs;
  const alignedEndMs = Math.ceil(end.getTime() / stepMs) * stepMs;

  for (let t = alignedStartMs; t <= alignedEndMs; t += stepMs) {
    const iso = new Date(t).toISOString();
    out.push(map.get(iso) ?? { bucketStartIso: iso, paidOrders: 0, paidRevenueVnd: 0 });
  }
  return out;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((cols) =>
      cols
        .map((col) => {
          const v = String(col ?? "");
          if (v.includes(",") || v.includes("\"") || v.includes("\n")) {
            return `"${v.replaceAll("\"", "\"\"")}"`;
          }
          return v;
        })
        .join(","),
    )
    .join("\n");
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRangeKey>("60m");
  const [analytics, setAnalytics] = useState<StoreRevenueAnalytics | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [campaignNameById, setCampaignNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [stats, campaigns] = await Promise.all([
      getStoreRevenueAnalytics({ range, trendBucketMinutes: 10, topCampaignLimit: 5 }),
      listCampaigns(),
    ]);

    const campaignIds = stats.campaignIdsInRange;
    const scanStats = await getQrScanCountsForCampaigns(campaignIds, stats.rangeStartIso);
    const map: Record<string, string> = {};
    for (const c of campaigns) map[c.id] = c.title || "Chưa đặt tên";

    setCampaignNameById(map);
    setScanCount(scanStats.total);
    setAnalytics(stats);
    setIsLoading(false);
  }, [range]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await load();
      if (!active) return;
    };
    void run();
    const t = setInterval(() => {
      void run();
    }, 8000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [load]);

  const conversionPct = useMemo(() => {
    if (!analytics || scanCount <= 0) return null;
    return Math.round((analytics.paidOrdersWithCampaign / scanCount) * 100);
  }, [analytics, scanCount]);

  const trend = useMemo(() => {
    if (!analytics) return [];
    return padTrend(analytics.trend, analytics.rangeStartIso, analytics.nowIso, 10);
  }, [analytics]);

  const alerts = useMemo<AlertRow[]>(() => {
    if (!analytics) return [];
    const rows: AlertRow[] = [];
    if (analytics.paidOrders === 0) {
      rows.push({
        key: "no-revenue",
        title: "Chưa có doanh thu paid",
        detail: "Trong khung thời gian hiện tại chưa có đơn hoàn tất thanh toán.",
        level: "warn",
      });
    }
    if (analytics.paidOrders > 0 && analytics.pendingOrders / analytics.paidOrders > 1.2) {
      rows.push({
        key: "pending-high",
        title: "Pending đang cao",
        detail: "Tỷ lệ đơn pending đang cao hơn paid, cần kiểm tra quy trình chốt đơn tại quầy.",
        level: "warn",
      });
    }
    if (conversionPct !== null && scanCount >= 10 && conversionPct < 10) {
      rows.push({
        key: "conversion-low",
        title: "Chuyển đổi QR -> Paid thấp",
        detail: `Conversion hiện tại ${conversionPct}% trên ${scanCount} lượt quét.`,
        level: "warn",
      });
    }
    if (rows.length === 0) {
      rows.push({
        key: "healthy",
        title: "Tình trạng ổn định",
        detail: "Không có cảnh báo lớn trong khung thời gian đang xem.",
        level: "info",
      });
    }
    return rows;
  }, [analytics, conversionPct, scanCount]);

  const handleExportCsv = () => {
    if (!analytics) return;
    const nowLabel = new Date(analytics.nowIso).toISOString().replaceAll(":", "").slice(0, 15);
    const rows: string[][] = [
      ["range", range],
      ["from", analytics.rangeStartIso],
      ["to", analytics.nowIso],
      ["paid_revenue_vnd", String(analytics.paidRevenueVnd)],
      ["gross_revenue_vnd", String(analytics.grossRevenueVnd)],
      ["discount_spend_vnd", String(analytics.paidDiscountVnd)],
      ["paid_orders", String(analytics.paidOrders)],
      ["pending_orders", String(analytics.pendingOrders)],
      ["cancelled_orders", String(analytics.cancelledOrders)],
      ["avg_order_value_vnd", String(analytics.averageOrderValueVnd)],
      ["qr_scans", String(scanCount)],
      ["qr_to_paid_conversion_pct", String(conversionPct ?? "")],
      [],
      ["trend_bucket_iso", "paid_orders", "paid_revenue_vnd"],
      ...trend.map((p) => [p.bucketStartIso, String(p.paidOrders), String(p.paidRevenueVnd)]),
      [],
      ["top_campaign_id", "campaign_name", "paid_orders", "paid_revenue_vnd", "pending_orders", "cancelled_orders"],
      ...analytics.topCampaigns.map((c) => [
        c.campaignId ?? "",
        c.campaignId ? (campaignNameById[c.campaignId] ?? "Chưa đặt tên") : "Không gắn chiến dịch",
        String(c.paidOrders),
        String(c.paidRevenueVnd),
        String(c.pendingOrders),
        String(c.cancelledOrders),
      ]),
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${range}_${nowLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto scroll-container">
      <div className="app-content-container pt-6 pb-10 space-y-4">
        <header className="bg-surface-primary rounded-xl border border-border-primary/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-text-primary tracking-[-0.02em]">Dashboard doanh thu tổng</h1>
              <p className="text-[12px] text-text-tertiary mt-1">
                Theo dõi realtime theo đơn paid/pending/cancelled, scan QR và hiệu quả theo chiến dịch.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border-primary text-text-secondary hover:bg-surface-secondary"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Làm mới
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!analytics}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-shinhan-navy text-white disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRange(option.key)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border ${
                  range === option.key
                    ? "bg-shinhan-navy text-white border-shinhan-navy"
                    : "bg-white text-text-secondary border-border-primary hover:bg-surface-secondary"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Doanh thu đã thanh toán" value={analytics ? `${formatCompact(analytics.paidRevenueVnd)} ₫` : "..."} />
          <Metric label="Doanh thu thuần (gross)" value={analytics ? `${formatCompact(analytics.grossRevenueVnd)} ₫` : "..."} />
          <Metric label="Giảm giá đã dùng" value={analytics ? `${formatCompact(analytics.paidDiscountVnd)} ₫` : "..."} />
          <Metric label="AOV" value={analytics ? `${formatCompact(analytics.averageOrderValueVnd)} ₫` : "..."} />
          <Metric label="Đơn paid" value={analytics ? formatVND(analytics.paidOrders) : "..."} />
          <Metric label="Đơn pending" value={analytics ? formatVND(analytics.pendingOrders) : "..."} />
          <Metric label="Đơn cancelled" value={analytics ? formatVND(analytics.cancelledOrders) : "..."} />
          <Metric
            label="QR -> Paid"
            value={conversionPct !== null ? `${conversionPct}%` : "--"}
            sub={analytics ? `${formatVND(scanCount)} lượt quét / ${formatVND(analytics.paidOrdersWithCampaign)} paid` : ""}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="bg-surface-primary rounded-xl border border-border-primary/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-shinhan-navy" />
              <h2 className="text-[13px] font-semibold text-text-primary">Doanh thu theo giờ (bucket 10 phút)</h2>
            </div>
            <RevenueTrendChart points={trend} />
          </div>
          <div className="bg-surface-primary rounded-xl border border-border-primary/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-shinhan-navy" />
              <h2 className="text-[13px] font-semibold text-text-primary">Cảnh báo</h2>
            </div>
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li key={alert.key} className="rounded-lg border border-border-primary/50 bg-surface-secondary/50 p-2.5">
                  <p className={`text-[11px] font-semibold ${alert.level === "warn" ? "text-status-warning" : "text-status-success"}`}>
                    {alert.title}
                  </p>
                  <p className="text-[11px] text-text-tertiary mt-0.5">{alert.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-surface-primary rounded-xl border border-border-primary/60 p-4">
          <h2 className="text-[13px] font-semibold text-text-primary mb-3">Top chiến dịch theo doanh thu</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="text-text-tertiary border-b border-border-primary/60">
                  <th className="py-2 pr-3 font-medium">Chiến dịch</th>
                  <th className="py-2 pr-3 font-medium">Doanh thu</th>
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 pr-3 font-medium">Pending</th>
                  <th className="py-2 pr-3 font-medium">Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.topCampaigns.length ? (
                  analytics.topCampaigns.map((row) => (
                    <tr key={row.campaignId} className="border-b border-border-primary/40 last:border-0">
                      <td className="py-2 pr-3 text-text-primary">
                        {row.campaignId ? (campaignNameById[row.campaignId] ?? "Chưa đặt tên") : "Không gắn chiến dịch"}
                      </td>
                      <td className="py-2 pr-3 text-text-primary font-mono">{formatCompact(row.paidRevenueVnd)} ₫</td>
                      <td className="py-2 pr-3">{formatVND(row.paidOrders)}</td>
                      <td className="py-2 pr-3">{formatVND(row.pendingOrders)}</td>
                      <td className="py-2 pr-3">{formatVND(row.cancelledOrders)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-text-tertiary">
                      {isLoading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu chiến dịch trong khung thời gian đã chọn."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border-primary/60 bg-surface-primary p-3">
      <p className="text-[10px] text-text-tertiary mb-1">{label}</p>
      <p className="text-[18px] font-semibold text-text-primary font-mono">{value}</p>
      {sub ? <p className="text-[11px] text-text-secondary mt-1">{sub}</p> : null}
    </div>
  );
}

function RevenueTrendChart({ points }: { points: RevenueTrendPoint[] }) {
  const max = Math.max(...points.map((p) => p.paidRevenueVnd), 1);
  if (points.length === 0) {
    return <p className="text-[12px] text-text-tertiary">Chưa có dữ liệu trong khung thời gian đã chọn.</p>;
  }
  const showEvery = points.length > 72 ? 12 : points.length > 36 ? 6 : points.length > 18 ? 3 : 1;
  return (
    <div className="h-56 flex items-end gap-0 overflow-hidden">
      {points.map((p, idx) => {
        const h = Math.round((p.paidRevenueVnd / max) * 100);
        const hour = new Date(p.bucketStartIso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const showLabel = idx % showEvery === 0 || idx === points.length - 1;
        return (
          <div key={p.bucketStartIso} className="min-w-0 flex-1 flex flex-col items-center justify-end gap-1">
            <div className="w-full h-44 flex items-end">
              <div
                title={`${hour}: ${formatCompact(p.paidRevenueVnd)} ₫ (${p.paidOrders} đơn)`}
                className="w-full bg-shinhan-navy/85 rounded-t-sm min-h-[2px]"
                style={{ height: `${Math.max(2, h)}%` }}
              />
            </div>
            <span className="w-full truncate text-center text-[9px] text-text-tertiary">{showLabel ? hour : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
