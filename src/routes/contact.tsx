import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageSquare, Headphones, Clock, Globe, ArrowRight, CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/site/top";
import { Footer } from "@/components/site/bottom";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "24/7 Trader Support & Contact — Bullish 4ex" },
      {
        name: "description",
        content: "Get in touch with the Bullish 4ex trader support team via 24/7 live chat, ticket, email, or community discord. Average response time under 5 minutes.",
      },
      { property: "og:title", content: "24/7 Trader Support — Bullish 4ex" },
      {
        property: "og:description",
        content: "Contact Bullish 4ex trader support for challenge inquiries, payouts, platform setup, and account verification.",
      },
      { property: "og:url", content: "https://bullish4ex.com/contact" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [subject, setSubject] = useState("Evaluation Question");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="mx-auto max-w-5xl px-5">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Headphones className="h-3.5 w-3.5" /> Trader Helpdesk
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              How can our team help you?
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Our support desk is online 24 hours a day, 7 days a week. We typically respond in less than 5 minutes.
            </p>
          </div>

          {/* Quick Support Cards */}
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <div className="glass p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">Live Chat</h3>
              <p className="mt-1 text-xs text-muted-foreground">Available 24/7 via the widget on the bottom right.</p>
              <button className="mt-4 text-xs font-semibold text-primary hover:underline">
                Start Chat →
              </button>
            </div>

            <div className="glass p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">Email Support</h3>
              <p className="mt-1 text-xs text-muted-foreground">Send queries directly to support@bullish4ex.com</p>
              <a href="mailto:support@bullish4ex.com" className="mt-4 inline-block text-xs font-semibold text-primary hover:underline">
                Write Email →
              </a>
            </div>

            <div className="glass p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">Discord Community</h3>
              <p className="mt-1 text-xs text-muted-foreground">Join 15,000+ traders discussing setups and payouts.</p>
              <a href="https://discord.com" target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs font-semibold text-primary hover:underline">
                Join Server →
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="glass mx-auto mt-12 max-w-2xl p-6 sm:p-10">
            {submitted ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-profit" />
                <h3 className="mt-4 font-display text-xl font-bold text-foreground">Message Dispatched</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Our trading operations desk has received your ticket. Expect a reply to your email shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-6 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-foreground">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Marcus Tanaka"
                      className="mt-1.5 w-full rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="trader@gmail.com"
                      className="mt-1.5 w-full rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground">Inquiry Category</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="Evaluation Question">Challenge & Evaluation Question</option>
                    <option value="Billing & Payouts">Billing, Deposits & Payouts</option>
                    <option value="Platform Issue">MT5 / cTrader Technical Issue</option>
                    <option value="Affiliate Inquiry">Affiliate & Partner Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground">Message</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe your inquiry in detail..."
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface-alt p-3.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Submit Ticket
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
