import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ShieldCheck, HelpCircle, AlertTriangle, ArrowRight, BookOpen } from "lucide-react";
import { Navbar } from "@/components/site/top";
import { Footer } from "@/components/site/bottom";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Trading Rules, Drawdown & Guidelines — Bullish4ex" },
      {
        name: "description",
        content: "Transparent breakdown of Bullish4ex simulated trading rules: daily loss limits, static & trailing drawdown, profit targets, news guidelines, and performance payout terms.",
      },
      { property: "og:title", content: "Trading Rules & Guidelines — Bullish4ex" },
      {
        property: "og:description",
        content: "Learn the transparent evaluation rules, drawdown metrics, and performance payout guidelines for Bullish4ex simulated trading challenges.",
      },
      { property: "og:url", content: "https://bullish4ex.com/rules" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/rules" }],
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
              Straightforward and transparent guidelines for our skill-based programs. We want you to succeed, pass your evaluation on simulated accounts, and earn access to a funded account without hidden surprises.
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
                    <h3 className="font-display text-lg font-bold text-foreground">Maximum Daily Drawdown</h3>
                    <span className="rounded bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">4% (1-Step / 2-Step / Flex) · 3% Instant</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    The Maximum Daily Drawdown is the maximum loss permitted within a single trading day (00:00 to 23:59 UTC). It includes closed trades and unrealized floating losses on open positions. It resets every day at strictly 00:00 UTC based on the dashboard countdown timer. Breaching this limit results in immediate, permanent account termination.
                  </p>
                  <div className="mt-4 rounded-lg bg-surface-alt p-4 text-xs font-mono text-muted-foreground">
                    Calculation: Initial Balance × 4% (3% on Instant).<br />
                    Example on a $100,000 account: maximum daily loss is $4,000 ($3,000 on Instant).
                  </div>
                </div>

                <div className="glass p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-foreground">Maximum Loss (Overall)</h3>
                    <span className="rounded bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">6% Static (1-Step, 2-Step, Instant) · 8% Trailing (Flex)</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    On 1-Step, 2-Step, and Instant accounts, the Maximum Loss is <strong>6% static</strong> calculated from the initial balance. It never trails upward with profits and never resets ($94,000 floor on a $100K account). On Flex accounts, it is <strong>8% trailing</strong> from your highest closed balance, locking at your starting balance once 8% in profit.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "trading" && (
              <div className="space-y-6">
                <div className="glass p-6 sm:p-8">
                  <h3 className="font-display text-lg font-bold text-foreground">Allowed Trading Styles & Conditions</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["News Trading", "Unrestricted in Challenge & Flex Eval. On Funded & Instant, 10-minute restricted window applies (±5 min around high-impact news)."],
                      ["Weekend Holding", "Allowed with Weekend Holding Add-on on 1-Step/2-Step/Instant. Flex accounts allow weekend and overnight holding by default."],
                      ["Overnight Holding", "Prohibited on 1-Step, 2-Step, and Instant: all trades must close before 00:00 UTC daily reset. Allowed on Flex."],
                      ["Trade Layering", "Funded & Instant: new trade may only open ≥ 10 minutes after previous trade's open. Instant: max 2 concurrent layers."],
                      ["1% Per-Trade Risk", "Funded & Instant: floating loss on any single open position must never exceed 1% of the initial account balance."],
                      ["Minimum Holding Time", "Every trade must be held for at least 3 minutes (180s) before closing. Hard breach if under 3 min."],
                      ["Winning Days (≥0.5%)", "3 Winning Days for Challenge (Phase 1 & 2); 5 Winning Days before each payout for Funded & Instant."],
                      ["Expert Advisors & Bots", "Allowed if compliant with all risk rules. HFT bots, latency exploits, and tick scalping are prohibited."],
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
                    <h3 className="font-display text-lg font-bold text-foreground">Prohibited Trading Practices</h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-xs text-muted-foreground list-disc list-inside">
                    <li>Tick scalping: closing 3 or more trades held under 10 seconds within a 1-hour window.</li>
                    <li>Closing any trade in under 3 minutes (Minimum Holding Time breach).</li>
                    <li>Latency arbitrage, reverse arbitrage, and platform feed exploitation.</li>
                    <li>Opening 3rd concurrent layer on Instant accounts, or opening new trades inside 10 minutes of previous open on Funded accounts.</li>
                    <li>Exceeding 1% floating loss on a single position on Funded and Instant accounts.</li>
                    <li>Holding overnight past 00:00 UTC or over the weekend without add-on on 1-Step, 2-Step, and Instant.</li>
                    <li>Inactivity: no executed trade for 30 consecutive calendar days.</li>
                    <li>Account sharing, pass services, commercial copiers, or opposite hedging between multiple accounts.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "instruments" && (
              <div className="glass p-6 sm:p-8">
                <h3 className="font-display text-lg font-bold text-foreground">Trading Leverage</h3>
                <p className="mt-2 text-xs text-muted-foreground">Bullish4ex offers uniform 1:100 leverage across all accounts and asset classes:</p>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-3 font-medium">Asset Class</th>
                        <th className="pb-3 font-medium">Maximum Leverage</th>
                        <th className="pb-3 font-medium">Platforms</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Forex Majors & Minors</td>
                        <td className="py-3 text-muted-foreground">1:100</td>
                        <td className="py-3 text-muted-foreground">MT4 / MT5</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Commodities (Gold, Silver, Oil)</td>
                        <td className="py-3 text-muted-foreground">1:100</td>
                        <td className="py-3 text-muted-foreground">MT4 / MT5</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Indices (NAS100, US30, GER40)</td>
                        <td className="py-3 text-muted-foreground">1:100</td>
                        <td className="py-3 text-muted-foreground">MT4 / MT5</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-semibold text-foreground">Cryptocurrency</td>
                        <td className="py-3 text-muted-foreground">1:100</td>
                        <td className="py-3 text-muted-foreground">MT4 / MT5</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "payouts" && (
              <div className="glass p-6 sm:p-8">
                <h3 className="font-display text-lg font-bold text-foreground">Payout Terms & Profit Split Schedule</h3>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    • <strong>Eligibility:</strong> At least 14 days since funded, approved KYC, signed Trader Agreement, zero rule violations, all open positions closed, and at least 5 Winning Days (each reaching ≥0.5% profit on starting balance).
                  </p>
                  <p>
                    • <strong>Profit Split Schedule:</strong> 1st payout: 70% · 2nd payout: 80% · 3rd payout: 90% · 4th and subsequent: up to 100%. Flex accounts have a fixed 85% split (90% with add-on).
                  </p>
                  <p>
                    • <strong>Withdrawal Cap:</strong> Capped at 6% of initial balance per 14-day cycle on 1-Step, 2-Step, and Instant. Flex accounts have NO withdrawal cap.
                  </p>
                  <p>
                    • <strong>Minimum Withdrawal:</strong> 1% of initial account balance in realized profit ($100 on $10K, $250 on $25K, $500 on $50K, $1,000 on $100K, $2,000 on $200K; $100 for Flex).
                  </p>
                  <p>
                    • <strong>Fee Return:</strong> Full account fee refunded with your first successful withdrawal on 1-Step and 2-Step accounts.
                  </p>
                  <p>
                    • <strong>Scaling Plan:</strong> After every 4 successful payouts with no rule violations, account balance is increased by 25% of the original account size (1-Step, 2-Step, Instant).
                  </p>
                  <p>
                    • <strong>Payout Channels:</strong> Cryptocurrency (USDT) and Bank Transfer.
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
