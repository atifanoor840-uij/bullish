import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, CalendarDays, Hash, ShieldX, User, Wallet, Award } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/site/primitives";
import { Card, Loading, useApi } from "@/components/portal/ui";
import { CertificateQR } from "@/components/portal/CertificateQR";
import { propApi } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/certificates/$id")({
  head: () => ({ meta: [{ title: "Certificate verification — Bullish 4ex" }, { name: "robots", content: "noindex" }] }),
  component: VerifyCertificate,
});

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

/** Public page reached by scanning a certificate QR code — confirms the certificate is genuine. */
function VerifyCertificate() {
  const { id } = Route.useParams();
  const { data, error, loading } = useApi(async () => (await propApi.certificates.verify(id)).certificate, [id]);
  const payout = !!data && data.id.startsWith("cert-pay");

  return (
    <div className="hero-bg flex min-h-screen flex-col items-center justify-center px-4 py-16 text-foreground">
      <a href="/"><Logo /></a>
      <Card highlight className="mt-8 w-full max-w-md p-6 sm:p-8">
        {loading ? (
          <Loading label="Verifying certificate…" />
        ) : error || !data ? (
          <div className="text-center">
            <ShieldX className="mx-auto h-12 w-12 text-loss" />
            <p className="mt-4 font-display text-xl font-semibold">Certificate not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't verify the certificate <span className="font-mono break-all">{id}</span>. It may be fake or the link is incorrect.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-profit/15">
                <BadgeCheck className="h-8 w-8 text-profit" />
              </span>
              <p className="mt-3 text-xs font-bold tracking-widest text-profit uppercase">Verified {payout ? "payout" : "certificate"}</p>
              <p className="mt-1 text-xs text-muted-foreground">This certificate was issued by Bullish4ex and is genuine.</p>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">This certifies that</p>
              <p className="font-display text-2xl font-semibold">{data.traderName}</p>
              <p className="mt-2 text-xs text-muted-foreground">{payout ? "has received a payout of" : "has successfully passed"}</p>
              <p className="text-gold font-display text-4xl font-bold">{money(data.accountSize, payout ? 2 : 0)}</p>
            </div>

            <div className="mt-6 space-y-2">
              <Row icon={<User className="h-4 w-4" />} label="Trader" value={data.traderName} />
              <Row icon={payout ? <Wallet className="h-4 w-4" /> : <Award className="h-4 w-4" />} label={payout ? "Payout amount" : "Account size"} value={money(data.accountSize, payout ? 2 : 0)} />
              <Row icon={<CalendarDays className="h-4 w-4" />} label={payout ? "Paid on" : "Passed on"} value={fmtDate(data.datePassed)} />
              {!payout && <Row icon={<Award className="h-4 w-4" />} label="Plan" value={data.planName} />}
              <Row icon={<Hash className="h-4 w-4" />} label="Certificate ID" value={<span className="font-mono text-xs">{data.id}</span>} />
            </div>

            <div className="mt-6 flex items-center gap-4 border-t border-white/[0.06] pt-5">
              <CertificateQR id={data.id} size={76} />
              <p className="text-xs text-muted-foreground">Scan this QR code from any certificate to open this verification page.</p>
            </div>
          </>
        )}
      </Card>
      <p className="mt-6 max-w-md text-center text-[11px] text-muted-foreground">Bullish4ex provides simulated trading evaluations with virtual funds.</p>
    </div>
  );
}
