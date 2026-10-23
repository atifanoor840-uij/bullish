import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { Logo, Candle } from "@/components/site/primitives";
import { propApi } from "@/lib/propApi";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Trader Portal Login — Bullish 4ex" },
      { name: "description", content: "Access your Bullish 4ex trading dashboard, monitor challenge metrics, and request payouts." },
    ],
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

        {/* Quick social / SSO buttons */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-foreground/90 transition hover:border-primary/40 hover:bg-white/[0.06]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Google
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-foreground/90 transition hover:border-primary/40 hover:bg-white/[0.06]"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 7.05c.66-.82 1.11-1.96.99-3.05-.97.04-2.14.65-2.84 1.47-.61.71-1.15 1.86-1.01 2.96 1.08.08 2.2-.56 2.86-1.38z" />
            </svg>
            Apple
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="hairline w-full" />
          <span className="absolute bg-background px-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            Or continue with email
          </span>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
