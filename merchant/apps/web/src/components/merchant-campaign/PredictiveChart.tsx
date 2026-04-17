import { motion } from "framer-motion";
import type { BudgetEstimation } from "@/lib/merchant-campaign/types";
import { formatCompact, formatVND } from "@/lib/formatCurrency";
import type { QrScanRow } from "@/lib/supabase/tables";

export type PredictiveSeriesPoint = { day: string; actual: number; predicted: number };

export type PredictiveChartModel = {
  series: PredictiveSeriesPoint[];
  qrActivityTotal: number;
};

export function generatePredictiveData(
  estimation: BudgetEstimation | null,
  scans: QrScanRow[] = [],
): PredictiveChartModel {
  const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const liveByDay = [0, 0, 0, 0, 0, 0, 0];
  for (const s of scans) {
    const jsDay = new Date(s.created_at).getDay();
    const idx = (jsDay + 6) % 7;
    liveByDay[idx] += 1;
  }
  const hasScans = scans.length > 0;

  if (!estimation) {
    const series = days.map((day, i) => ({ day, actual: liveByDay[i], predicted: 0 }));
    return { series, qrActivityTotal: scans.length };
  }

  const weeklyConversions = estimation.estimatedConversion;
  const weights = [0.1, 0.12, 0.14, 0.16, 0.18, 0.17, 0.13];

  const series = days.map((day, i) => {
    const predicted = Math.round(weeklyConversions * weights[i]);
    const actual = hasScans ? liveByDay[i] : 0;
    return { day, actual, predicted };
  });

  return { series, qrActivityTotal: scans.length };
}

export function PredictiveChart({
  data,
  estimation,
  qrActivityTotal,
}: {
  data: PredictiveSeriesPoint[];
  estimation: BudgetEstimation | null;
  qrActivityTotal: number;
}) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.predicted, d.actual)), 1);
  const showActualLegend = data.some((d) => d.actual > 0);

  return (
    <div
      className="bg-surface-primary rounded-xl border border-border-primary/60
        shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-5 h-full"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em]">
            Phân tích dự báo
          </h4>
          <p className="text-[10px] text-text-tertiary mt-1 max-w-[42ch] leading-relaxed">
            Lượt quét QR được đồng bộ từ số đơn đã thanh toán của chiến dịch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-text-tertiary">
            {showActualLegend && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-sm bg-shinhan-navy" />
                Thực tế
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-shinhan-gold/60 border border-shinhan-gold" />
              Dự báo
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-2 h-40">
        {data.map((d, i) => {
          const predictedH = (d.predicted / maxVal) * 100;
          const actualH = (d.actual / maxVal) * 100;
          const isPredictedOnly = d.actual === 0;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="relative w-full h-36 flex items-end justify-center gap-[2px]">
                {!isPredictedOnly && (
                  <motion.div
                    key={`${d.day}-${d.actual}`}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      delay: i * 0.06,
                      duration: 0.7,
                      ease: [0.22, 0.61, 0.36, 1],
                    }}
                    className="w-[36%] bg-shinhan-navy rounded-t-sm origin-bottom"
                    style={{ height: `${actualH}%` }}
                  />
                )}
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    delay: i * 0.06 + 0.04,
                    duration: 0.7,
                    ease: [0.22, 0.61, 0.36, 1],
                  }}
                  className={`rounded-t-sm origin-bottom ${
                    isPredictedOnly
                      ? "w-[50%] bg-shinhan-gold/12 border border-dashed border-shinhan-gold/40"
                      : "w-[36%] bg-shinhan-gold/12 border border-dashed border-shinhan-gold/30"
                  }`}
                  style={{ height: `${predictedH}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-text-tertiary">{d.day}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-border-primary/50">
        <div className="grid grid-cols-4 gap-3">
          <StatLine
            label="Lượt quét QR"
            value={formatVND(qrActivityTotal)}
            change={
              qrActivityTotal > 0
                ? "Đồng bộ từ đơn đã thanh toán"
                : "Chưa có đơn đã thanh toán"
            }
          />
          <StatLine
            label="Lượt tiếp cận dự kiến"
            value={estimation ? formatVND(estimation.estimatedReach) : "---"}
            change={estimation ? `~${formatVND(estimation.estimatedConversion)} chuyển đổi` : ""}
          />
          <StatLine
            label="Chi phí / khách"
            value={estimation ? `${formatVND(estimation.costPerAcquisition)} VND` : "---"}
            change={estimation ? estimation.breakEvenPoint : ""}
          />
          <StatLine
            label="Doanh thu dự báo"
            value={
              estimation
                ? `${formatCompact(estimation.estimatedRevenueMin)} – ${formatCompact(estimation.estimatedRevenueMax)}`
                : "---"
            }
            change={estimation ? `ROI ${estimation.estimatedROI >= 0 ? "+" : ""}${estimation.estimatedROI}%` : ""}
          />
        </div>
      </div>
    </div>
  );
}

function StatLine({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-text-tertiary mb-0.5 tracking-[0.01em]">{label}</p>
      <p className="text-[14px] font-semibold text-text-primary font-mono tabular-nums tracking-[-0.02em]">
        {value}
      </p>
      {change && (
        <p className="text-[11px] font-medium text-status-success mt-0.5 font-mono">{change}</p>
      )}
    </div>
  );
}
