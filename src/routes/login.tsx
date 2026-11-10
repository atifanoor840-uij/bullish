import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Logo, Candle } from "@/components/site/primitives";
import { propApi } from "@/lib/propApi";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Trader Portal Login — Bullish4ex Prop Firm" },
      {
        name: "description",
        content: "Sign in to the Bullish4ex trader portal to monitor simulated trading challenge metrics, review evaluation objectives, and track performance payouts.",
      },
      { property: "og:title", content: "Trader Portal Login — Bullish4ex" },
      {
        property: "og:description",
        content: "Sign in to your Bullish4ex trader portal to manage your simulated trading challenges and track evaluation progress.",
      },
      { property: "og:url", content: "https://bullish4ex.com/login" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      await propApi.auth.signin(email.trim().toLowerCase(), password);
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Login failed:", err);
      setErrorMsg(err?.message || "Invalid email or password. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Background Ambience */}
      <div className="hero-beams pointer-events-none absolute inset-0 opacity-40" />
      <div className="spotlight pointer-events-none absolute top-1/4 left-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 opacity-30" />
      <div className="dot-map pointer-events-none absolute inset-0 opacity-20" />

      {/* Floating 3D Candle Decoration */}
      <Candle className="-top-8 -left-8 w-36 opacity-70 sm:w-48 lg:left-12 lg:top-16" delay={0} drift={14} rotate={-10} />
      <Candle className="-bottom-10 -right-8 w-32 opacity-70 sm:w-44 lg:right-16 lg:bottom-12" delay={0.2} drift={12} rotate={8} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-gold relative z-10 w-full max-w-md p-6 sm:p-8"
      >
        {/* Brand header */}
        <div className="flex flex-col items-center text-center">
          <div className="transition hover:opacity-90">
            <Logo />
          </div>
          <h1 className="text-silver mt-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your trading metrics & evaluation dashboard
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-loss/30 bg-loss/10 p-3 text-xs text-loss">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-foreground/80">Email address</label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@bullish4ex.com"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pr-4 pl-10 text-sm text-foreground placeholder:text-muted-foreground/50 transition focus:border-primary focus:bg-white/[0.05] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-foreground/80">Password</label>
              <a href="#" className="text-xs text-primary transition hover:underline">
                Forgot password?
              </a>
            </div>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pr-10 pl-10 text-sm text-foreground placeholder:text-muted-foreground/50 transition focus:border-primary focus:bg-white/[0.05] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-muted-foreground transition hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-primary"
              />
              <span className="text-xs text-muted-foreground">Remember this device</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Sign In to Portal"}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {/* Security badge footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span>256-bit bank-grade encryption</span>
        </div>

        {/* Switch to Signup */}
        <div className="mt-6 border-t border-white/[0.06] pt-5 text-center text-xs text-muted-foreground">
          Don't have an account yet?{" "}
          <Link to="/signup" className="font-semibold text-primary transition hover:underline">
            Register Challenge
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
