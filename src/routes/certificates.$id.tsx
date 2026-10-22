import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ShieldX } from "lucide-react";
import { Logo } from "@/components/site/primitives";
import { Card, Loading, useApi } from "@/components/portal/ui";
import { propApi } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/certificates/$id")({
  head: () => ({ meta: [{ title: "Certificate verification — Bullish 4ex" }] }),
  component: VerifyCertificate,
});

/** Public page that confirms a certificate id is genuine. */
function VerifyCertificate() {
  const { id } = Route.useParams();
  const { data, error, loading } = useApi(async () => (await propApi.certificates.verify(id)).certificate, [id]);
  return (
    <div className="hero-bg flex min-h-screen flex-col items-center justify-center px-5 py-16 text-foreground">
      <Logo />
      <Card highlight className="mt-8 w-full max-w-md p-8 text-center">
        {loading ? (
          <Loading label="Verifying certificate…" />
        ) : error || !data ? (
          <>
            <ShieldX className="mx-auto h-10 w-10 text-loss" />
            <p className="mt-4 font-display text-xl font-semibold">Certificate not found</p>
            <p className="mt-2 text-sm text-muted-foreground">We couldn't verify the certificate <span className="font-mono">{id}</span>.</p>
          </>
        ) : (
          <>
            <BadgeCheck className="mx-auto h-10 w-10 text-profit" />
            <p className="mt-4 text-xs font-semibold tracking-widest text-profit uppercase">Verified certificate</p>
            <p className="mt-4 font-display text-2xl font-semibold">{data.traderName}</p>
            <p className="text-gold mt-2 font-display text-3xl font-bold">{money(data.accountSize, 0)}</p>
            <p className="mt-1 text-sm">{data.planName}</p>
            <p className="mt-6 text-xs text-muted-foreground">Issued {fmtDate(data.datePassed)} · {data.id}</p>
          </>
        )}
      </Card>
    </div>
  );
}
