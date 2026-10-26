// Placeholder content — edit freely.
export const navLinks = [
  { label: "Pricing", href: "/#challenges" },
  { label: "Markets", href: "/#markets" },
  { label: "Rules", href: "/rules" },
  { label: "How It Works", href: "/#how" },
  { label: "Support", href: "/contact" },
  { label: "Dashboard", href: "/dashboard" },
];

export const stats = [
  { label: "Total paid to traders", value: 18.4, prefix: "$", suffix: "M+", decimals: 1, note: "Since 2023" },
  { label: "Funded traders", value: 12500, suffix: "+", decimals: 0, note: "Across all plans" },
  { label: "Countries served", value: 140, suffix: "+", decimals: 0, note: "Worldwide access" },
  { label: "Average payout time", value: 8, suffix: "h", decimals: 0, note: "From request to wallet" },
];

export const partners = ["MetaTrader 5", "cTrader", "Match-Trader", "TradingView", "Visa", "Mastercard", "USDT · TRC20", "Rise", "Skrill", "Apple Pay"];

export const sizes = [5000, 10000, 25000, 50000, 100000, 200000];
export type PlanType = "1-Step" | "2-Step" | "Instant Funding";
export const planTypes: PlanType[] = ["1-Step", "2-Step", "Instant Funding"];

export const planMeta: Record<PlanType, { tagline: string; phases: string }> = {
  "1-Step": { tagline: "One phase. Hit the target, get funded.", phases: "1 phase" },
  "2-Step": { tagline: "Our most balanced evaluation with relaxed limits.", phases: "2 phases" },
  "Instant Funding": { tagline: "Skip the evaluation and trade a funded account today.", phases: "No evaluation" },
};

const baseFee: Record<number, number> = { 5000: 49, 10000: 89, 25000: 179, 50000: 299, 100000: 529, 200000: 999 };

type Rules = {
  target: string; daily: string; overall: string; days: string; leverage: string; split: string;
  payout: string; time: string; mult: number;
};
const rules: Record<PlanType, Rules> = {
  // Official Bullish4ex rules: 1-Step: 9% target, 6% max loss; 2-Step: 6%/5% target, 6% max loss; Instant: 6% max loss.
  "1-Step": { target: "9%", daily: "4%", overall: "6%", days: "3 Winning Days", leverage: "1:100", split: "70% → 100%", payout: "Every 14 days", time: "Unlimited", mult: 1.1 },
  "2-Step": { target: "6% / 5%", daily: "4%", overall: "6%", days: "3 Winning Days / phase", leverage: "1:100", split: "70% → 100%", payout: "Every 14 days", time: "Unlimited", mult: 1 },
  "Instant Funding": { target: "None", daily: "3%", overall: "6%", days: "5 Winning Days", leverage: "1:100", split: "70% → 100%", payout: "Every 14 days", time: "Unlimited", mult: 2.6 },
};

export function getPlan(type: PlanType, size: number) {
  const r = rules[type];
  return {
    rows: [
      ["Profit target", r.target, "Profit you need to reach to pass"],
      ["Max daily loss", r.daily, "Static, from initial balance. Resets 00:00 UTC"],
      ["Max overall loss", r.overall, "Static, from initial balance"],
      ["Min trading days", r.days, "Winning Days reach at least +0.5% on equity basis"],
      ["Trading period", r.time, "No deadline to pass"],
      ["Leverage", r.leverage, "1:100 across all asset classes"],
      ["Profit split", r.split, "70% → 80% → 90% → up to 100%"],
      ["Payout cycle", r.payout, "Bi-weekly, up to 6% of balance per cycle"],
    ] as [string, string, string][],
    fee: Math.round((baseFee[size] ?? 0) * r.mult),
  };
}
export const popular = { type: "2-Step" as PlanType, size: 100000 };

export const planIncludes = [
  "Fee refunded with first payout",
  "Weekend holding with add-on (+20%)",
  "EAs and bots allowed (no HFT)",
  "1:100 leverage on all asset classes",
  "Scaling plan: +25% balance every 4 payouts",
];

export const compareTypes: { label: string; values: Record<PlanType, string | boolean> }[] = [
  { label: "Evaluation phases", values: { "1-Step": "1", "2-Step": "2", "Instant Funding": "None" } },
  { label: "Profit target", values: { "1-Step": "9%", "2-Step": "6% / 5%", "Instant Funding": "—" } },
  { label: "Max daily loss", values: { "1-Step": "4%", "2-Step": "4%", "Instant Funding": "3%" } },
  { label: "Max overall loss", values: { "1-Step": "6% (static)", "2-Step": "6% (static)", "Instant Funding": "6% (static)" } },
  { label: "Profit split", values: { "1-Step": "70% up to 100%", "2-Step": "70% up to 100%", "Instant Funding": "70% up to 100%" } },
  { label: "News trading", values: { "1-Step": "Free in challenge; ±5m on funded", "2-Step": "Free in challenge; ±5m on funded", "Instant Funding": "10-min window (±5m)" } },
  { label: "Refundable fee", values: { "1-Step": true, "2-Step": true, "Instant Funding": false } },
  { label: "Scaling plan (+25% every 4 payouts)", values: { "1-Step": true, "2-Step": true, "Instant Funding": true } },
];

export const scaling = [
  { step: "Starting balance", size: "$100K", split: "70%", req: "Initial funded account" },
  { step: "Cycle 1 (4 payouts)", size: "$125K", split: "100%", req: "4 clean payouts (+25% balance)" },
  { step: "Cycle 2 (8 payouts)", size: "$150K", split: "100%", req: "8 clean payouts (+25% balance)" },
  { step: "Cycle 3 (12 payouts)", size: "$175K", split: "100%", req: "12 clean payouts (+25% balance)" },
  { step: "Cycle 4 (16 payouts)", size: "$200K", split: "100%", req: "16 clean payouts (+25% balance)" },
];

export const payouts = [
  { name: "M. Khan", flag: "🇵🇰", amount: 12480, date: "Oct 18, 2026", plan: "$100K 2-Step", method: "USDT" },
  { name: "L. Rossi", flag: "🇮🇹", amount: 8920, date: "Oct 17, 2026", plan: "$50K 1-Step", method: "Rise" },
  { name: "D. Okafor", flag: "🇳🇬", amount: 21350, date: "Oct 16, 2026", plan: "$200K 2-Step", method: "USDT" },
  { name: "S. Müller", flag: "🇩🇪", amount: 5640, date: "Oct 15, 2026", plan: "$25K 2-Step", method: "Bank" },
  { name: "A. García", flag: "🇪🇸", amount: 15200, date: "Oct 14, 2026", plan: "$100K 1-Step", method: "Rise" },
  { name: "J. Smith", flag: "🇬🇧", amount: 9875, date: "Oct 13, 2026", plan: "$50K 2-Step", method: "Bank" },
  { name: "R. Tanaka", flag: "🇯🇵", amount: 31020, date: "Oct 12, 2026", plan: "$200K 2-Step", method: "USDT" },
];

export const comparison: { label: string; us: string | boolean; them: string | boolean }[] = [
  { label: "Profit split", us: "Up to 90%", them: "70–80%" },
  { label: "Average payout time", us: "8 hours", them: "5–14 days" },
  { label: "Time limit to pass", us: "Unlimited", them: "30–60 days" },
  { label: "Weekend holding add-on", us: true, them: false },
  { label: "EAs & copy trading", us: true, them: false },
  { label: "Refundable fee", us: true, them: false },
  { label: "Scaling up to $2M", us: true, them: false },
];

/**
 * Trader stories carousel. Placeholder content — swap in real traders.
 * `image`: thumbnail path (e.g. "/stories/booker.jpg" in /public); without it a styled placeholder is shown.
 * `video`: embeddable URL (e.g. "https://www.youtube.com/embed/<id>"); the play button is disabled without it.
 */
export type Story = { name: string; country: string; total: string; quote: string; image?: string; video?: string };
export const stories: Story[] = [
  { name: "Hamza", country: "PK", total: "$52,431", quote: "Bullish 4ex gave me the structure and confidence to scale consistently." },
  { name: "Jonathan", country: "US", total: "$24,186", quote: "The rules are clear, the support is real, and the payouts are fast." },
  { name: "Stephen", country: "GB", total: "$201,095", quote: "Hitting six figures changed my life. Bullish 4ex made it possible." },
  { name: "Elena", country: "ES", total: "$15,845", quote: "This firm gave me the leverage to actually start earning in the game." },
  { name: "Omar", country: "AE", total: "$86,320", quote: "I never thought I would get paid this fast — fee refunded on my first payout." },
  { name: "Yuki", country: "JP", total: "$31,760", quote: "Clean dashboard, clear drawdown. I always know exactly where I stand." },
];

export const faqs = [
  ["What are the trading rules?", "Respect the max daily and overall loss limits, hit the profit target, and trade the minimum days. No time limits."],
  ["How fast are payouts?", "Most payouts are processed within 24 hours, with an average of 8 hours."],
  ["Is the challenge fee refundable?", "Yes. Your fee is refunded with your first payout as a funded trader."],
  ["Do I need to complete KYC?", "KYC is required only once you pass the evaluation and before your funded account is issued."],
  ["Which platforms can I use?", "MetaTrader 5, cTrader and Match-Trader on desktop, web and mobile."],
  ["Can I trade news and weekends?", "News trading is allowed, except opening or closing trades within 5 minutes of high-impact releases. Holding over the weekend needs the weekend holding add-on (+20%) at checkout."],
  ["Is there a scaling plan?", "Consistent traders can scale their account up to $2,000,000."],
];
