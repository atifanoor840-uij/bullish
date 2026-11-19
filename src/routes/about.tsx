import { createFileRoute } from "@tanstack/react-router";
import { Building2, CalendarDays, FileSignature, MapPin, ShieldCheck, Globe, Download } from "lucide-react";
import { Navbar } from "@/components/site/top";
import { Footer } from "@/components/site/bottom";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Bullish 4ex" },
      {
        name: "description",
        content: "Bullish 4ex is a brand of FOR2FEET LIMITED, registered in England and Wales (Company No. 08382766). Operating since 12 September 2024.",
      },
      { property: "og:title", content: "About Bullish 4ex" },
      { property: "og:description", content: "Company information, operating history and the agreement between Bullish 4ex and FOR2FEET LIMITED." },
      { property: "og:url", content: "https://bullish4ex.com/about" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/about" }],
  }),
  component: AboutPage,
});

const COMPANY = [
  { icon: Building2, label: "Legal entity", value: "FOR2FEET LIMITED" },
  { icon: ShieldCheck, label: "Registration", value: "England and Wales · Company No. 08382766" },
  { icon: CalendarDays, label: "Operating since", value: "12 September 2024" },
  { icon: Globe, label: "Website", value: "bullish4ex.site" },
  { icon: MapPin, label: "Registered office", value: "Christopher Corner, Oakridge Lynch, Stroud, England, GL6 7NZ" },
];

const AGREEMENT = [
  { title: "Brand", body: "Bullish4ex is a trading name and brand of FOR2FEET LIMITED." },
  { title: "Operator", body: "FOR2FEET LIMITED owns and operates the Bullish4ex website, platform and simulated trading services under this agreement." },
  { title: "Effective date", body: "The agreement has been in effect since Bullish4ex began operating on 12 September 2024." },
  { title: "Responsibility", body: "All program fees, customer accounts, support and payouts for Bullish4ex are handled by FOR2FEET LIMITED." },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="mx-auto max-w-5xl px-5">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Building2 className="h-3.5 w-3.5" /> About Us
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">About Bullish 4ex</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
              Bullish 4ex provides simulated trading evaluations for traders worldwide. The brand is owned and operated by FOR2FEET LIMITED and has been operating since 12 September 2024.
            </p>
          </div>

          <section className="mt-12">
            <h2 className="font-display text-xl font-bold">Company information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {COMPANY.map(({ icon: Icon, label, value }) => (
                <div key={label} className="glass flex items-start gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass mt-12 p-6 sm:p-10">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileSignature className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">Under agreement</h2>
                <p className="text-xs text-muted-foreground">Relationship between Bullish4ex and FOR2FEET LIMITED</p>
              </div>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Bullish4ex operates under an agreement with FOR2FEET LIMITED, registered in England and Wales (Company No. 08382766), with its registered office at Christopher Corner, Oakridge Lynch, Stroud, England, GL6 7NZ.
            </p>
            <dl className="mt-6 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
              {AGREEMENT.map((a) => (
                <div key={a.title} className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="text-sm font-semibold">{a.title}</dt>
                  <dd className="text-sm text-muted-foreground">{a.body}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Brand Operating Agreement</p>
                <p className="text-xs text-muted-foreground">Full agreement between Bullish4ex and FOR2FEET LIMITED · PDF</p>
              </div>
              <a
                href="/bullish4ex-brand-operating-agreement.pdf"
                download
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <Download className="h-4 w-4" /> Download agreement
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
