import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Navbar } from "@/components/site/top";
import { Footer } from "@/components/site/bottom";

export const Route = createFileRoute("/payouts")({
  head: () => ({
    meta: [
      { title: "Payout Certificates — Bullish4ex" },
      {
        name: "description",
        content: "Recent Bullish4ex trader payout certificates from around the world.",
      },
      { property: "og:title", content: "Payout Certificates — Bullish4ex" },
      { property: "og:url", content: "https://bullish4ex.com/payouts" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/payouts" }],
  }),
  component: PayoutsPage,
});

type Certificate = {
  name: string;
  country: string;
  flag: string;
  amount: number;
  date: string; // ISO
  image: string;
};

const certificates: Certificate[] = [
  { name: "Oliver Hughes", country: "United Kingdom", flag: "🇬🇧", amount: 2788, date: "2026-11-03", image: "/payouts/oliver-hughes.webp" },
  { name: "Omar Al Falasi", country: "United Arab Emirates", flag: "🇦🇪", amount: 1628, date: "2026-11-15", image: "/payouts/omar-al-falasi.webp" },
  { name: "Felix Wagner", country: "Germany", flag: "🇩🇪", amount: 2094, date: "2026-11-12", image: "/payouts/felix-wagner.webp" },
  { name: "Thiago Santos", country: "Brazil", flag: "🇧🇷", amount: 716, date: "2026-11-09", image: "/payouts/thiago-santos.webp" },
  { name: "Rohan Mehta", country: "India", flag: "🇮🇳", amount: 1356, date: "2026-11-07", image: "/payouts/rohan-mehta.webp" },
  { name: "Ethan Walker", country: "United States", flag: "🇺🇸", amount: 537, date: "2026-11-01", image: "/payouts/ethan-walker.webp" },
  { name: "Khalid Al Mansoori", country: "United Arab Emirates", flag: "🇦🇪", amount: 1903, date: "2026-10-28", image: "/payouts/khalid-al-mansoori.webp" },
  { name: "Lukas Müller", country: "Germany", flag: "🇩🇪", amount: 2415, date: "2026-10-25", image: "/payouts/lukas-muller.webp" },
  { name: "Gabriel Silva", country: "Brazil", flag: "🇧🇷", amount: 862, date: "2026-10-20", image: "/payouts/gabriel-silva.webp" },
  { name: "Aarav Sharma", country: "India", flag: "🇮🇳", amount: 1247, date: "2026-10-18", image: "/payouts/aarav-sharma.webp" },
];

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function PayoutsPage() {
  const [country, setCountry] = useState("All");
  const [active, setActive] = useState<number | null>(null);

  const sorted = useMemo(() => [...certificates].sort((a, b) => b.date.localeCompare(a.date)), []);
  const countries = useMemo(() => ["All", ...Array.from(new Set(sorted.map((c) => c.country)))], [sorted]);
  const list = country === "All" ? sorted : sorted.filter((c) => c.country === country);

  const total = certificates.reduce((s, c) => s + c.amount, 0);
  const largest = Math.max(...certificates.map((c) => c.amount));

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((i) => (i === null ? i : (i + 1) % list.length));
      if (e.key === "ArrowLeft") setActive((i) => (i === null ? i : (i - 1 + list.length) % list.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, list.length]);

  const current = active !== null ? list[active] : null;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="mx-auto max-w-7xl px-5">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Payout Certificates
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Traders Getting <span className="text-gold">Paid</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
              Recent payout certificates issued to Bullish4ex traders around the world.
            </p>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            {[
              { label: "Certificates", value: String(certificates.length) },
              { label: "Total shown", value: usd(total) },
              { label: "Largest payout", value: usd(largest) },
            ].map((s, i) => (
              <div key={s.label} className={`p-5 text-center sm:p-7 ${i > 0 ? "border-l border-white/[0.06]" : ""}`}>
                <p className="text-gold font-display text-xl font-bold sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Country filter */}
          <div className="mt-12 flex flex-wrap justify-center gap-2">
            {countries.map((c) => (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  country === c
                    ? "bg-gold text-primary-foreground font-semibold"
                    : "border border-white/[0.08] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                }`}
              >
                {c === "All" ? "All countries" : `${certificates.find((x) => x.country === c)?.flag} ${c}`}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c, i) => (
              <button
                key={c.image}
                onClick={() => setActive(i)}
                className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] text-left transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-gold"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={c.image}
                    alt={`Payout certificate — ${c.name}, ${c.country}, ${usd(c.amount)}`}
                    loading="lazy"
                    width={2000}
                    height={2000}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.flag} {c.country} · {fmtDate(c.date)}
                    </p>
                  </div>
                  <p className="text-gold shrink-0 font-display text-lg font-bold">{usd(c.amount)}</p>
                </div>
              </button>
            ))}
          </div>

          <p className="mx-auto mt-12 max-w-3xl text-center text-xs text-muted-foreground">
            Bullish4ex provides simulated trading evaluations with virtual funds for educational purposes only. T&amp;C apply.
          </p>
        </div>
      </main>

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Payout certificate — ${current.name}`}
        >
          <div className="relative w-full max-w-[min(90vw,80vh)]" onClick={(e) => e.stopPropagation()}>
            <img src={current.image} alt={`Payout certificate — ${current.name}`} className="w-full rounded-xl shadow-2xl" />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">
                {current.name} · <span className="text-gold font-semibold">{usd(current.amount)}</span>
              </span>
              <a
                href={current.image}
                download
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs hover:bg-white/[0.06]"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </div>
          </div>
          <button aria-label="Close" onClick={() => setActive(null)} className="absolute top-4 right-4 rounded-full bg-white/10 p-2 hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
          {list.length > 1 && (
            <>
              <button
                aria-label="Previous"
                onClick={(e) => { e.stopPropagation(); setActive((i) => (i! - 1 + list.length) % list.length); }}
                className="absolute left-2 rounded-full bg-white/10 p-2 hover:bg-white/20 sm:left-6"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                aria-label="Next"
                onClick={(e) => { e.stopPropagation(); setActive((i) => (i! + 1) % list.length); }}
                className="absolute right-2 rounded-full bg-white/10 p-2 hover:bg-white/20 sm:right-6"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
}
