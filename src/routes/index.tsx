import { createFileRoute } from "@tanstack/react-router";
import { Navbar, Hero, Stats } from "@/components/site/top";
import { HowItWorks, Pricing } from "@/components/site/pricing";
import { Comparison } from "@/components/site/comparison";
import { Markets } from "@/components/site/markets";
import { FaqSection, FinalCta, Footer } from "@/components/site/bottom";

import { faqs } from "@/lib/site-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bullish4ex — Skill-Based Trading Evaluations" },
      {
        name: "description",
        content: "Join Bullish4ex skill-based programs. Complete a trading challenge on simulated accounts for educational purposes and build disciplined risk-management skills.",
      },
      {
        name: "keywords",
        content: "trading challenge, prop firm evaluation, simulated accounts, skill-based programs, educational purposes, bullish4ex",
      },
      { property: "og:title", content: "Bullish4ex — Prop Firm Evaluation & Forex Trading Challenges" },
      {
        property: "og:description",
        content: "Skill-based trading evaluations on simulated accounts. Practice disciplined risk management with virtual funds.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bullish4ex.com/" },
      { property: "og:image", content: "https://bullish4ex.com/hero-candle.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Bullish4ex — Skill-Based Trading Evaluations" },
      {
        name: "twitter:description",
        content: "Skill-based programs and prop firm evaluations on simulated accounts. Learn and practice with clear risk-management rules.",
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
        <Stats />
        <HowItWorks />
        <Pricing />
        <Markets />
        <Comparison />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
