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
      { title: "Bullish 4ex — Trade Our Simulated Capital, Keep Up to 90%" },
      {
        name: "description",
        content: "Prove your trading skills with Bullish 4ex. Choose 1-Step, 2-Step, Instant Funding, or $9 Flex challenge. Trade simulated forex & commodities up to $200,000 with bi-weekly payouts and 100% refundable fees.",
      },
      {
        name: "keywords",
        content: "forex prop firm, funded trader program, simulated trading challenge, forex evaluation, instant funding prop firm, 90% profit split, metatrader 5 prop firm",
      },
      { property: "og:title", content: "Bullish 4ex — Leading Forex Prop Trading & Skill Evaluation" },
      {
        property: "og:description",
        content: "Get funded up to $200K on simulated accounts. Keep up to 90% profits. Bi-weekly payouts, 100% refundable fees, and transparent rules.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bullish4ex.com/" },
      { property: "og:image", content: "https://bullish4ex.com/hero-candle.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Bullish 4ex — Trade Our Simulated Capital, Keep Up to 90%" },
      {
        name: "twitter:description",
        content: "Simulated forex prop firm evaluations up to $200K. Bi-weekly payouts, refundable evaluation fee, and up to 90% profit split.",
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
