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
  { label: "Global Members", value: 10, suffix: "K+", decimals: 0 },
  { label: "Total simulated rewards paid", value: 18.4, prefix: "$", suffix: "M+", decimals: 1 },
  { label: "Simulated instruments on industry-standard platforms", value: 200, suffix: "+", decimals: 0 },
  { label: "Countries served", value: 140, suffix: "+", decimals: 0 },
];

export const partners = ["MetaTrader 5", "cTrader", "Match-Trader", "TradingView", "Visa", "Mastercard", "USDT · TRC20", "Rise", "Skrill", "Apple Pay"];

export const sizes = [3000, 5000, 10000, 25000, 50000, 100000, 200000];
export type PlanType = "1-Step" | "2-Step" | "Instant" | "Flex";
export const planTypes: PlanType[] = ["1-Step", "2-Step", "Instant", "Flex"];

export const planMeta: Record<PlanType, { tagline: string; phases: string; badge?: string }> = {
  "1-Step": { tagline: "Single-phase evaluation", phases: "1-Phase" },
  "2-Step": { tagline: "Two-phase evaluation", phases: "2-Phase" },
  "Instant": { tagline: "No evaluation phase", phases: "Instant" },
  Flex: { tagline: "Start for $9", phases: "Flex", badge: "NEW" },
};

const baseFee: Record<number, number> = { 3000: 35, 5000: 49, 10000: 89, 25000: 179, 50000: 299, 100000: 529, 200000: 999 };

/** A trading objective. `pct` values can also be shown as dollar amounts of the account size. */
export type Objective = { label: string; pct?: number; text?: string };

// Official Bullish4ex rules: 1-Step: 9% target, 6% max loss; 2-Step: 6%/5% target, 6% max loss; Instant: 6% max loss;
// Flex: 4% target, 4% daily, 8% trailing max loss; no min days in eval, 5 on performance stage.
const rules: Record<PlanType, { objectives: Objective[]; features: string[]; mult: number }> = {
  "1-Step": {
    objectives: [
      { label: "Reward Target", pct: 9 },
      { label: "Min Winning Days", text: "3" },
      { label: "Max Trading Days", text: "None" },
      { label: "Daily Drawdown", pct: 4 },
      { label: "Max Drawdown (Static)", pct: 6 },
      { label: "Reward Share", text: "70–100%" },
      { label: "Rewards", text: "Every 14 days" },
    ],
    features: ["1-phase evaluation", "No time limit", "Refundable fee", "70–100% reward share"],
    mult: 1.1,
  },
  "2-Step": {
    objectives: [
      { label: "Reward Target (Stage 1)", pct: 6 },
      { label: "Reward Target (Stage 2)", pct: 5 },
      { label: "Min Winning Days", text: "3" },
      { label: "Max Trading Days", text: "None" },
      { label: "Daily Drawdown", pct: 4 },
      { label: "Max Drawdown (Static)", pct: 6 },
      { label: "Reward Share", text: "70–100%" },
      { label: "Rewards", text: "Every 14 days" },
    ],
    features: ["2-phase evaluation", "No time limit", "Refundable fee", "70–100% reward share"],
    mult: 1,
  },
  "Instant": {
    objectives: [
      { label: "Min Winning Days", text: "5" },
      { label: "Daily Drawdown", pct: 3 },
      { label: "Max Drawdown (Static)", pct: 6 },
      { label: "Reward Share", text: "70–100%" },
      { label: "Rewards", text: "Every 14 days" },
      { label: "No Evaluation Phase", text: "Direct access" },
    ],
    features: ["No evaluation phase", "No time limit", "Rewards every 14 days", "70–100% reward share"],
    mult: 2.6,
  },
  Flex: {
    objectives: [
      { label: "Reward Target", pct: 4 },
      { label: "Min Winning Days", text: "None" },
      { label: "Max Trading Days", text: "None" },
      { label: "Daily Drawdown", pct: 4 },
      { label: "Max Drawdown (Trailing)", pct: 8 },
      { label: "Reward Share", text: "85%" },
      { label: "Rewards", text: "Every 14 days" },
    ],
    features: ["Pay $9 now, rest on pass", "No min days to pass", "No time limit", "85% reward share"],
    mult: 1,
  },
};

export function getPlan(type: PlanType, size: number) {
  const r = rules[type];
  return { objectives: r.objectives, features: r.features, fee: Math.round((baseFee[size] ?? 0) * r.mult) };
}
export const popular = { type: "2-Step" as PlanType, size: 100000 };

export const compareTypes: { label: string; values: Record<PlanType, string | boolean> }[] = [
  { label: "Evaluation phases", values: { "1-Step": "1", "2-Step": "2", "Instant": "None", Flex: "1" } },
  { label: "Profit target", values: { "1-Step": "9%", "2-Step": "6% / 5%", "Instant": "—", Flex: "4%" } },
  { label: "Max daily loss", values: { "1-Step": "4%", "2-Step": "4%", "Instant": "3%", Flex: "4%" } },
  { label: "Max overall loss", values: { "1-Step": "6% (static)", "2-Step": "6% (static)", "Instant": "6% (static)", Flex: "8% (trailing)" } },
  { label: "Profit split", values: { "1-Step": "70% up to 100%", "2-Step": "70% up to 100%", "Instant": "70% up to 100%", Flex: "85% (90% w/ add-on)" } },
  { label: "News trading", values: { "1-Step": "Free in challenge; ±5m on performance stage", "2-Step": "Free in challenge; ±5m on performance stage", "Instant": "10-min window (±5m)", Flex: "Free in challenge; ±5m on performance stage" } },
  { label: "Refundable fee", values: { "1-Step": true, "2-Step": true, "Instant": false, Flex: false } },
  { label: "Scaling plan (+25% every 4 payouts)", values: { "1-Step": true, "2-Step": true, "Instant": true, Flex: true } },
];

export const scaling = [
  { step: "Starting balance", size: "$100K", split: "70%", req: "Initial performance stage" },
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
 * Trader stories carousel. Only add real, verifiable traders (with their consent) — the section is hidden from the homepage while empty.
 * `image`: thumbnail path (e.g. "/stories/booker.jpg" in /public); without it a styled placeholder is shown.
 * `video`: embeddable URL (e.g. "https://www.youtube.com/embed/<id>"); the play button is disabled without it.
 */
export type Story = { name: string; country: string; total: string; quote: string; image?: string; video?: string };
export const stories: Story[] = [];

export const faqs = [
  ["What is Flex, and how does the $9 work?", "Flex is a one-phase evaluation you start for $9. Hit the 4% reward target and you pass. You then pay the remaining fee to move to the performance stage. If you don't pass, you pay nothing beyond the $9."],
  ["What are the Flex drawdown rules?", "4% daily and 8% maximum. The 8% maximum is trailing: it is measured from your highest closed balance. The same 4% and 8% limits apply at the performance stage."],
  ["What is the Flex reward share?", "85% by default. You can upgrade to 90% with the reward share add-on."],
  ["Which platforms do you support?", "MetaTrader 5, cTrader and Match-Trader on desktop, web and mobile. Your login details are issued from your dashboard after purchase."],
  ["Is there a time limit to pass a challenge?", "No. There is no maximum number of trading days or calendar deadline to hit your reward target on any program."],
  ["Do you use a consistency rule?", "Not on evaluations. On Flex performance accounts, no single trading day may make up more than 20% of your total profit when you request a reward."],
  ["What drawdown limits apply to each program?", "1-Step and 2-Step: 4% daily and 6% maximum (static). Instant: 3% daily and 6% maximum (static). Flex: 4% daily and 8% maximum (trailing). The daily limit is measured from your starting balance and resets at 00:00 UTC."],
  ["What is Instant?", "Instant gives you a simulated account without an evaluation phase. It uses a 3% daily drawdown and a 6% static maximum drawdown, and you need 5 winning days before requesting a reward."],
  ["What reward targets apply to each program?", "1-Step: 9%. 2-Step: 6% in stage one and 5% in stage two. Flex: 4%. Instant has no reward target because there is no evaluation phase."],
  ["What are minimum winning days?", "A winning day is a day that closes at least 0.5% in profit. 1-Step and each stage of 2-Step need 3 winning days. Flex has no minimum during the evaluation. At the performance stage, you need 5 winning days before requesting a reward."],
  ["How often are rewards processed?", "Rewards follow a bi-weekly cycle. Your first request opens 14 days after you receive your performance account, and each request can be up to 6% of the account balance."],
  ["What account sizes can I buy?", "Accounts are available from $3,000 up to $200,000. The exact sizes for each program are shown in the pricing section above."],
  ["What payment options are available?", "You can pay by card, cryptocurrency or bank transfer. See checkout for the current methods."],
  ["What are BOGO and weekend holding?", "BOGO (buy one, get one) gives you an extra account on the listed promotion. Weekend holding is an optional add-on (+20%) that lets you keep positions open over the weekend when you select it at checkout."],
  ["Where can I read the full rules and policies?", "Read the full rules on our Rules page. The risk disclosure and legal policies are linked in the footer. For account-specific help, contact support from your dashboard."],
];
