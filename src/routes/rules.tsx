import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ShieldCheck, HelpCircle, AlertTriangle, ArrowRight, BookOpen } from "lucide-react";
import { Navbar } from "@/components/site/top";
import { Footer } from "@/components/site/bottom";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Trading Rules & Guidelines — Bullish 4ex" },
      { name: "description", content: "Complete breakdown of Bullish 4ex trading rules: drawdown calculations, daily limits, news trading, overnight holding, and prohibited strategies." },
    ],
  }),
  component: RulesPage,
});

const categories = [
  { id: "drawdown", label: "Drawdown & Limits" },
  { id: "trading", label: "Trading Styles & News" },
  { id: "instruments", label: "Leverage & Instruments" },
  { id: "payouts", label: "Payout Eligibility" },
];

function RulesPage() {
  const [activeTab, setActiveTab] = useState("drawdown");

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="mx-auto max-w-5xl px-5">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <BookOpen className="h-3.5 w-3.5" /> Official Rulebook
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Trading Rules & Risk Parameters
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
              Straightforward and transparent guidelines. We want you to succeed, pass your evaluation, and get funded without hidden surprises.
            </p>
          </div>

          {/* Quick Category Tabs */}
          <div className="mt-12 flex flex-wrap justify-center gap-2 border-b border-border pb-4">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveTab(c.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === c.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="mt-10 space-y-8">
            {activeTab === "drawdown" && (
              <div className="space-y-6">
                <div className="glass p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-foreground">Maximum Daily Loss</h3>
                    <span className="rounded bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">4% Daily · 3% Instant</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    The maximum daily loss is how much your account can lose in a single trading day — closed losses plus open floating loss. It is static, measured from your initial balance, and resets every day at 00:00 UTC. Funded accounts on every model use 3%.
                  </p>
                  <div className="mt-4 rounded-lg bg-surface-alt p-4 text-xs font-mono text-muted-foreground">
                    Calculation: Initial Balance × 4% = Daily Loss Limit (3% on Instant and funded accounts).<br />
                    Example on a $100,000 2-Step account: losing more than $4,000 in one day breaches the rule.
                  </div>
                </div>

                <div className="glass p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-foreground">Maximum Overall Loss (Static)</h3>
                    <span className="rounded bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">10% Overall · 5% Instant</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Our overall loss is <strong>static</strong>, meaning it does not trail your high-water mark profits. On a $100K 1-Step or 2-Step challenge your equity can never drop below $90,000. Instant Funding and all funded accounts use a 5% limit ($95,000 on $100K).
                  </p>
                </div>
              </div>
            )}

            {activeTab === "trading" && (
              <div className="space-y-6">
                <div className="glass p-6 sm:p-8">
                  <h3 className="font-display text-lg font-bold text-foreground">Allowed Trading Styles</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["News Trading", "Allowed, except opening or closing trades within 5 minutes before or after high-impact news."],
                      ["Weekend Holding", "Available with the weekend holding add-on (+20% at checkout)."],
                      ["Expert Advisors (EAs)", "Allowed as long as they don't exploit system latency."],
                      ["Scalping", "Allowed — every trade must be held for at least 3 minutes."],
                    ].map(([title, desc]) => (
                      <div key={title} className="rounded-lg border border-border bg-surface-alt p-4">
                        <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <Check className="h-4 w-4 text-profit" /> {title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass p-6 sm:p-8 border-loss/20">
                  <div className="flex items-center gap-2 text-loss">
                    <AlertTriangle className="h-5 w-5" />
                    <h3 className="font-display text-lg font-bold text-foreground">Prohibited Practices</h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-muted-foreground list-disc list-inside">
                    <li>Latency arbitrage, high-frequency quoting exploit bots, and server delay abuse.</li>
                    <li>Tick scalping: 3 or more trades held under 10 seconds within one hour.</li>
                    <li>Trade layering: opening a new trade within 5 minutes of the previous one.</li>
                    <li>Losing more than 1% of the initial balance on a single trade.</li>
                    <li>Inactivity: no trade for 30 days.</li>
                    <li>Account sharing or passing evaluations through 3rd party commercial pass services.</li>
                    <li>Reverse arbitrage or opposite hedging between multiple Bullish 4ex accounts.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "instruments" && (
              <div className="glass p-6 sm:p-8">
                <h3 className="font-display text-lg font-bold text-foreground">Trading Leverage</h3>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-3 font-medium">Asset Class</th>
                        <th className="pb-3 font-medium">All accounts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Forex Majors & Minors</td>
                        <td className="py-3 text-muted-foreground">1:100</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Gold & Silver (Commodities)</td>
                        <td className="py-3 text-muted-foreground">1:50</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Indices (NAS100, US30, GER40)</td>
                        <td className="py-3 text-muted-foreground">1:20</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Cryptocurrency</td>
                        <td className="py-3 text-muted-foreground">1:2</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "payouts" && (
              <div className="glass p-6 sm:p-8">
                <h3 className="font-display text-lg font-bold text-foreground">Payout Terms & Profit Split</h3>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    • <strong>Eligibility:</strong> Approved KYC, a funded account, and at least 3 profitable days (each closing +0.5% or more). Instant Funding needs 5 qualifying days.
                  </p>
                  <p>
                    • <strong>Payout Cycle:</strong> Request once every 14 days, up to 6% of your initial balance per cycle. Minimum withdrawal is $100.
                  </p>
                  <p>
                    • <strong>Profit Split:</strong> 80% on your first payout, 85% on the second and 90% from the third onwards.<br />
                    • <strong>Fee Refund:</strong> Your full challenge registration fee is returned with your very first payout.
                  </p>
                  <p>
                    • <strong>Payout Channels:</strong> Crypto (USDT TRC20 / ERC20, BTC), Rise, and Direct Bank Wire.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CTA Box */}
          <div className="mt-16 rounded-xl border border-border bg-surface-alt p-8 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
            <div>
              <h4 className="font-display text-xl font-bold text-foreground">Ready to prove your skills?</h4>
              <p className="mt-1 text-sm text-muted-foreground">Select an account size and start trading today.</p>
            </div>
            <a
              href="/#challenges"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 sm:mt-0"
            >
              Start Challenge <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
