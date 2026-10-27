import { createFileRoute } from "@tanstack/react-router";
import { Navbar, Hero, TrustBar, Stats } from "@/components/site/top";
import { HowItWorks, Pricing } from "@/components/site/pricing";
import { Comparison, ScalingPlan } from "@/components/site/comparison";
import { LiveTicker, Markets } from "@/components/site/markets";
import { PayoutShowcase } from "@/components/site/payout-showcase";
import { StoriesSection } from "@/components/site/stories";
import { FaqSection, FinalCta, Footer } from "@/components/site/bottom";

import { faqs } from "@/lib/site-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bullish4ex — Trading Challenges & Forex Evaluation Program | Get Funded as a Trader" },
      {
        name: "description",
        content: "Join Bullish4ex skill-based programs. Complete a trading challenge on simulated accounts for educational purposes to earn access to a funded account upon successful evaluation with up to 90% profit splits.",
      },
      {
        name: "keywords",
        content: "trading challenge, prop firm evaluation, get funded as a trader, forex evaluation program, simulated accounts, skill-based programs, educational purposes, funded account upon successful evaluation, bullish4ex",
      },
      { property: "og:title", content: "Bullish4ex — Prop Firm Evaluation & Forex Trading Challenges" },
      {
        property: "og:description",
        content: "Skill-based trading evaluations on simulated accounts. Pass the trading challenge to earn access to a funded account upon successful evaluation with up to 90% performance rewards.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bullish4ex.com/" },
      { property: "og:image", content: "https://bullish4ex.com/hero-candle.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Bullish4ex — Trading Challenges & Forex Evaluation Program" },
      {
        name: "twitter:description",
        content: "Skill-based programs and prop firm evaluations on simulated accounts. Get funded as a trader upon successful evaluation with bi-weekly reward payouts.",
      },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map(([q, a]) => ({
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": a,
            },
          })),
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main>
        <Hero />
        <LiveTicker />
        <TrustBar />
        <Stats />
        <HowItWorks />
        <Pricing />
        <ScalingPlan />
        <Markets />
        <Comparison />
        <PayoutShowcase />
        <StoriesSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
