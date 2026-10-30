import { useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp, TrendingDown, BarChart3, Droplet,
} from "lucide-react";
import { assets, getQuote, changePct, fmtPrice, useQuotes, type Asset, type Quote } from "@/lib/live-prices";
import { CtaButton, Reveal, SectionHead } from "./primitives";

function Change({ q, className = "" }: { q: Quote; className?: string }) {
  const c = changePct(q);
  const up = c >= 0;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${up ? "text-profit" : "text-loss"} ${className}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{c.toFixed(2)}%
    </span>
  );
}

/** Price that briefly flashes green/red on each tick. */
function FlashPrice({ symbol, q, className = "" }: { symbol: string; q: Quote; className?: string }) {
  const [flash, setFlash] = useState<0 | 1 | -1>(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setFlash(q.dir);
    const t = setTimeout(() => setFlash(0), 600);
    return () => clearTimeout(t);
  }, [q.price, q.dir]);
  const color = flash === 1 ? "text-profit" : flash === -1 ? "text-loss" : "text-foreground";
  return <span className={`tabular-nums transition-colors duration-500 ${color} ${className}`}>{fmtPrice(symbol, q.price)}</span>;
}

/* ---------------- Live ticker loop ---------------- */

/** Infinite looping row of live asset prices. */
export function LiveTicker() {
  const quotes = useQuotes();
  const list = [...assets, ...assets];
  return (
    <section className="relative border-y border-white/[0.05] bg-surface-alt">
      <div className="flex items-stretch">
        <div className="relative z-10 hidden shrink-0 items-center gap-2 border-r border-white/[0.06] bg-surface-alt px-5 text-xs font-semibold tracking-widest uppercase sm:flex">
          <span className="live-dot" /> Live Markets
        </div>
        <div className="mask-fade-x w-full overflow-hidden">
          <div className="marquee py-3" style={{ ["--marquee-duration" as string]: "60s" }}>
            {list.map((a, i) => {
              const q = getQuote(quotes, a.symbol);
              return (
                <a key={i} href="#markets" className="flex items-center gap-3 border-r border-white/[0.05] px-6 text-sm whitespace-nowrap transition hover:bg-white/[0.03]">
                  <span className="font-display font-semibold text-foreground/90">{a.symbol}</span>
                  <FlashPrice symbol={a.symbol} q={q} className="font-medium" />
                  <Change q={q} className="text-xs" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Instrument icons ---------------- */

const flagCode: Record<string, string> = { EUR: "eu", USD: "us", GBP: "gb", JPY: "jp", AUD: "au", CAD: "ca", CHF: "ch" };
const flag = (cur: string) => `https://flagcdn.com/w80/${flagCode[cur] ?? "us"}.png`;
const coin = (sym: string) => `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${sym.toLowerCase()}.svg`;

const Round = ({ src, className = "" }: { src: string; className?: string }) => (
  <img src={src} alt="" loading="lazy" className={`h-8 w-8 rounded-full object-cover ring-2 ring-card ${className}`} />
);

/** Flag pair for FX, coin logo for crypto, badge for metals / indices / energy. */
function AssetIcon({ a }: { a: Asset }) {
  const [base = "", quote = ""] = a.symbol.split("/");
  if (a.cls === "Forex") {
    return (
      <span className="relative block h-9 w-11 shrink-0">
        <Round src={flag(base)} className="absolute top-0 left-0" />
        <Round src={flag(quote)} className="absolute right-0 bottom-0 !h-6 !w-6" />
      </span>
    );
  }
  if (a.cls === "Crypto") {
    return (
      <span className="relative block h-9 w-11 shrink-0">
        <Round src={coin(base)} className="absolute top-0 left-0 bg-white/5" />
        <Round src={flag("USD")} className="absolute right-0 bottom-0 !h-6 !w-6" />
      </span>
    );
  }
  if (a.cls === "Indices") {
    return (
      <span className="relative block h-9 w-11 shrink-0">
        <span className="absolute top-0 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15 text-sky-400 ring-2 ring-card"><BarChart3 className="h-4 w-4" /></span>
        <Round src={flag("USD")} className="absolute right-0 bottom-0 !h-6 !w-6" />
      </span>
    );
  }
  return (
    <span className="relative block h-9 w-11 shrink-0">
      {a.cls === "Metals" ? (
        <span className="absolute top-0 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-gold font-display text-[11px] font-bold text-primary-foreground ring-2 ring-card">Au</span>
      ) : (
        <span className="absolute top-0 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-200 ring-2 ring-card"><Droplet className="h-4 w-4" /></span>
      )}
      <Round src={flag("USD")} className="absolute right-0 bottom-0 !h-6 !w-6" />
    </span>
  );
}

/* ---------------- Markets table ---------------- */

/** Tiny sparkline built from the ticks seen while the page is open. */
function Spark({ price, up }: { price: number; up: boolean }) {
  const [pts, setPts] = useState<number[]>([]);
  useEffect(() => { setPts((p) => [...p.slice(-29), price]); }, [price]);
  const d = useMemo(() => {
    if (pts.length < 2) return "";
    const hi = Math.max(...pts), lo = Math.min(...pts), r = hi - lo || 1;
    return pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * 80},${22 - ((v - lo) / r) * 20}`).join(" ");
  }, [pts]);
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20">
      <path d={d} fill="none" stroke={up ? "var(--profit)" : "var(--loss)"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function Markets() {
  const quotes = useQuotes();
  const rows = assets;
  return (
    <section id="markets" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5">
        <SectionHead
          label="Simulated Markets"
          title={<>Practice on <span className="text-gold">Global Markets</span></>}
        />

        <Reveal className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-white/[0.08]">
                  {["Instrument", "Price", "Change", "Trend", "Spread", ""].map((h) => <th key={h} className="px-5 py-4 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const q = getQuote(quotes, a.symbol);
                  return (
                    <tr key={a.symbol} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <AssetIcon a={a} />
                          <div>
                            <p className="font-display font-semibold">{a.symbol}</p>
                            <p className="text-xs text-muted-foreground">{a.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium"><FlashPrice symbol={a.symbol} q={q} /></td>
                      <td className="px-5 py-3.5"><Change q={q} className="text-xs" /></td>
                      <td className="px-5 py-3.5"><Spark price={q.price} up={changePct(q) >= 0} /></td>
                      <td className="px-5 py-3.5 text-muted-foreground">{a.spread}</td>
                      <td className="px-5 py-3.5 text-right">
                        <a href="#challenges" className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium transition hover:border-primary/50 hover:text-primary">Trade</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal className="mt-12 flex justify-center">
          <CtaButton href="#challenges">Start Your Evaluation</CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
