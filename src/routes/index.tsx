import { createFileRoute } from "@tanstack/react-router";
import { Navbar, Hero, TrustBar, Stats } from "@/components/site/top";
import { HowItWorks, Pricing } from "@/components/site/pricing";
import { Comparison, ScalingPlan } from "@/components/site/comparison";
import { LiveTicker, Markets } from "@/components/site/markets";
import { PayoutShowcase } from "@/components/site/payout-showcase";
import { StoriesSection } from "@/components/site/stories";
import { FaqSection, FinalCta, Footer } from "@/components/site/bottom";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bullish 4ex — Trade Our Capital, Keep Up to 90%" },
      { name: "description", content: "Prove your skills, get funded up to $200,000 and get paid in 24h with Bullish 4ex." },
      { property: "og:title", content: "Bullish 4ex — Forex Prop Trading Firm" },
      { property: "og:description", content: "Get funded up to $200K. 90% profit split. Payouts in 24h." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
