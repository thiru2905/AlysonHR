import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  change,
  hint,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  change?: number;
  hint?: string;
  icon?: LucideIcon;
  trend?: number[];
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="surface-card p-5 transition-all hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12.5px] text-muted-foreground font-medium">{label}</div>
        {Icon && (
          <div className="h-7 w-7 rounded-md bg-accent/60 grid place-items-center text-accent-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <div className="mt-3 font-display text-[28px] leading-none tracking-tight text-foreground">{value}</div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {typeof change === "number" ? (
          <div
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium " +
              (positive
                ? "bg-[oklch(0.95_0.04_155)] text-[oklch(0.4_0.1_155)]"
                : "bg-[oklch(0.95_0.04_30)] text-[oklch(0.45_0.13_30)]")
            }
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        ) : <span />}
        {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
      </div>
      {trend && trend.length > 1 && (
        <Sparkline values={trend} positive={positive} className="mt-3" />
      )}
    </div>
  );
}

function Sparkline({ values, positive, className }: { values: number[]; positive: boolean; className?: string }) {
  const w = 200;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ");
  const stroke = positive ? "oklch(0.55 0.12 155)" : "oklch(0.55 0.18 28)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={"w-full h-8 " + (className ?? "")} preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} points={points} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
