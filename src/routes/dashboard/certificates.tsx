import { createFileRoute } from "@tanstack/react-router";
import { Award, ExternalLink } from "lucide-react";
import { Logo } from "@/components/site/primitives";
import { Button, Card, EmptyState, ErrorNote, Loading, PageHeader, useApi } from "@/components/portal/ui";
import { propApi } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/dashboard/certificates")({ component: Certificates });

function Certificates() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.certificates.mine()).certificates);
  return (
    <>
      <PageHeader title="Certificates" subtitle="Proof of your achievements — share them anywhere." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <Card><Loading /></Card>
      ) : !data?.length ? (
        <Card><EmptyState icon={<Award className="h-5 w-5" />} title="No certificates yet" body="Pass an evaluation or receive a payout to earn your first certificate." /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((c) => {
            const payout = c.id.startsWith("cert-pay");
            return (
              <Card key={c.id} highlight={!payout} className="relative overflow-hidden p-6">
                <Award className="pointer-events-none absolute -right-4 -bottom-4 h-28 w-28 text-white/[0.04]" />
                <div className="flex items-center justify-between">
                  <Logo />
                  <span className="text-[10px] font-semibold tracking-widest text-primary uppercase">{payout ? "Payout" : "Funded"}</span>
                </div>
                <p className="mt-8 text-xs text-muted-foreground">This certifies that</p>
                <p className="font-display text-2xl font-semibold">{c.traderName}</p>
                <p className="mt-3 text-sm text-muted-foreground">{payout ? "received a payout of" : "successfully passed"}</p>
                <p className="text-gold font-display text-3xl font-bold">{money(c.accountSize, payout ? 2 : 0)}</p>
                <p className="mt-1 text-sm">{c.planName}</p>
                <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-muted-foreground">
                  <span>{fmtDate(c.datePassed)} · {c.id}</span>
                  <Button size="sm" variant="ghost" href={`/certificates/${c.id}`}><ExternalLink className="h-3.5 w-3.5" />Verify</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
