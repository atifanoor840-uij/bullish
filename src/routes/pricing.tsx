import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/top";
import { Pricing } from "@/components/site/pricing";
import { Footer } from "@/components/site/bottom";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & Evaluation Plans — Bullish4ex" },
      {
        name: "description",
        content: "Compare Bullish4ex evaluation plans: 1-Step, 2-Step, Instant and Flex challenges on simulated accounts. Clear rules, transparent pricing.",
      },
      { property: "og:title", content: "Pricing & Evaluation Plans — Bullish4ex" },
      {
        property: "og:description",
        content: "Pick a skill-based trading evaluation that fits you. Transparent pricing on simulated accounts.",
      },
      { property: "og:url", content: "https://bullish4ex.com/pricing" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="pt-16 md:pt-20">
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
