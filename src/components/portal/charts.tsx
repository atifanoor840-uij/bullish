import { useState } from "react";

type Point = { label: string; value: number; detail?: string };

/** Cumulative line/area chart with a hover readout. Colours follow profit/loss tokens. */
export function TrendChart({ points, format, height = 260 }: { points: Point[]; format: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const W = 800, H = height, pad = 12;
  const vals = points.map((p) => p.value);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => pad + ((max - v) / range) * (H - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!.value;
  const color = last >= 0 ? "var(--profit)" : "var(--loss)";
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="relative">
      {h && (
        <div className="pointer-events-none absolute top-0 left-0 z-10 rounded-lg border border-white/10 bg-card px-3 py-2 text-xs shadow-xl">
          <p className="text-muted-foreground">{h.label}</p>
          <p className={`font-semibold ${h.value >= 0 ? "text-profit" : "text-loss"}`}>{format(h.value)}</p>
          {h.detail && <p className="text-muted-foreground">{h.detail}</p>}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: H }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)));
        }}
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="white" strokeOpacity="0.04" />)}
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="white" strokeOpacity="0.15" strokeDasharray="4 4" />
        <path d={`${line} L${W},${y(min)} L0,${y(min)} Z`} fill="url(#trend-fill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="white" strokeOpacity="0.2" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

/** Daily signed bars (green up / red down). */
export function SignedBars({ bars, format, height = 260 }: { bars: Point[]; format: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!bars.length) return null;
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const h = hover !== null ? bars[hover] : null;
  return (
    <div className="relative">
      {h && (
        <div className="pointer-events-none absolute top-0 left-0 z-10 rounded-lg border border-white/10 bg-card px-3 py-2 text-xs shadow-xl">
          <p className="text-muted-foreground">{h.label}</p>
          <p className={`font-semibold ${h.value >= 0 ? "text-profit" : "text-loss"}`}>{format(h.value)}</p>
          {h.detail && <p className="text-muted-foreground">{h.detail}</p>}
        </div>
      )}
      <div className="flex items-stretch gap-1" style={{ height }} onMouseLeave={() => setHover(null)}>
        {bars.map((b, i) => (
          <div key={i} className="flex flex-1 flex-col justify-center" onMouseEnter={() => setHover(i)}>
            <div className="flex h-1/2 items-end">
              {b.value > 0 && <div className="w-full rounded-t-sm bg-profit/80 transition hover:bg-profit" style={{ height: `${(b.value / max) * 100}%` }} />}
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex h-1/2 items-start">
              {b.value < 0 && <div className="w-full rounded-b-sm bg-loss/80 transition hover:bg-loss" style={{ height: `${(Math.abs(b.value) / max) * 100}%` }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Semi-circle gauge (0–100). */
export function ScoreGauge({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 70, c = Math.PI * r;
  const color = v >= 80 ? "var(--profit)" : v >= 60 ? "var(--primary)" : "var(--loss)";
  return (
    <div className="relative mx-auto w-48">
      <svg viewBox="0 0 180 100" className="w-full">
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="12" strokeLinecap="round" />
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-display text-2xl font-semibold">{v.toFixed(0)}%</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Tiny inline sparkline. */
export function Sparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values), r = max - min || 1;
  const d = values.map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * width},${height - ((v - min) / r) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={values[values.length - 1]! >= values[0]! ? "var(--profit)" : "var(--loss)"} strokeWidth="1.5" />
    </svg>
  );
}
