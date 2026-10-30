import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, AlertCircle } from "lucide-react";
import { Logo } from "@/components/site/primitives";
import { propApi } from "@/lib/propApi";
import { trackPixel } from "@/lib/metaPixel";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Register Trader Account — Bullish4ex Prop Firm Evaluation" },
      {
        name: "description",
        content: "Create your Bullish4ex account and start your simulated trading challenge. Pass our skill-based evaluation to gain access to a funded account with up to 90% profit splits.",
      },
      { property: "og:title", content: "Create Your Trader Account — Bullish4ex Evaluation" },
      {
        property: "og:description",
        content: "Join Bullish4ex today. Complete your trading evaluation on simulated accounts for educational purposes and earn access to a funded account.",
      },
      { property: "og:url", content: "https://bullish4ex.com/signup" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bullish4ex.com/signup" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("United States");
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [refCode, setRefCode] = useState<string | undefined>();
  const [collabCode, setCollabCode] = useState<string | undefined>();

  useEffect(() => {
    trackPixel("PageView");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      const collab = params.get("collab");
      if (ref) setRefCode(ref);
      if (collab) setCollabCode(collab);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;
    setErrorMsg("");
    setIsLoading(true);

    try {
      const signupPayload: {
        name: string;
        email: string;
        password: string;
        country?: string;
        referralCode?: string;
        collaboratorCode?: string;
      } = {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        country,
      };
      if (refCode) signupPayload.referralCode = refCode;
      if (collabCode) signupPayload.collaboratorCode = collabCode;

      await propApi.auth.signup(signupPayload);

      // Meta Pixel: Track successful registration and lead
      trackPixel("CompleteRegistration", {
        content_name: "Trader Signup",
        status: "success",
        currency: "USD",
        value: 0,
      });
      trackPixel("Lead", {
        content_name: "New Trader Lead",
        currency: "USD",
      });

      // Auto login right after signup
      try {
        await propApi.auth.signin(email.trim().toLowerCase(), password);
        window.location.href = "/dashboard";
      } catch {
        window.location.href = "/login";
      }
    } catch (err: any) {
      console.error("Signup failed:", err);
      setErrorMsg(err?.message || "Failed to create account. Please check your details.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8"
      >
        <div>
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Logo />
            </div>
            <h1 className="text-silver font-display text-2xl font-bold tracking-tight">
              Create account
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-loss/30 bg-loss/10 p-3 text-xs text-loss">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-foreground/80">Full name</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alexander Vance"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pr-4 pl-10 text-sm text-foreground placeholder:text-muted-foreground/50 transition focus:border-primary focus:bg-white/[0.05] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground/80">Email address</label>
              <div className="relative mt-1">
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
              <label className="block text-xs font-medium text-foreground/80">Country of residence</label>
              <div className="relative mt-1">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#1f1b27] py-2.5 px-3.5 text-sm text-foreground transition focus:border-primary focus:outline-none"
                >
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Germany">Germany</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="Spain">Spain</option>
                  <option value="Nigeria">Nigeria</option>
                  <option value="Japan">Japan</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground/80">Password</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
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

            <div className="pt-2">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 accent-primary"
                />
                <span className="text-[11px] leading-relaxed text-muted-foreground">
                  I agree to the{" "}
                  <a href="#" className="text-primary hover:underline">Terms of Service</a>,{" "}
                  <a href="#" className="text-primary hover:underline">Risk Disclosure</a> and acknowledge simulated trading rules.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !agreed}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-semibold text-primary-foreground shadow-gold transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {isLoading ? "Creating Account..." : "Create Account & Continue"}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Switch to login */}
          <div className="mt-6 border-t border-white/[0.06] pt-4 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary transition hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
