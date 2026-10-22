import { createFileRoute } from "@tanstack/react-router";
import { Gift, RotateCcw, Sparkles } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorNote, Loading, Note, PageHeader, cx, useAction, useApi } from "@/components/portal/ui";
import { propApi, type Offer } from "@/lib/propApi";
import { fmtDate, sizeLabel } from "@/lib/portal";
import { isLive, offerSummary } from "@/lib/offers";

export const Route = createFileRoute("/dashboard/offers")({ component: Offers });

/** Offer as returned by GET /api/offers/accounts (scoped to this trader). */
type TraderOffer = Partial<Offer> & {
  id: string; name: string; type: Offer["type"]; summary?: string; targeted?: boolean;
  accounts?: { accountId: string; login?: string; platform?: string; kind: string }[];
};
type Retry = { accountId: string; accountSize: number; planName: string; claimedCount: number; offer: { id: string; name: string; retriesRemaining: number } | null };

function Offers() {
  const { data, error, loading, reload } = useApi(async () => {
    const [mine, retry] = await Promise.all([
      propApi.catalog.accountOffers().catch(async () => ({ offers: (await propApi.catalog.offers()).offers.filter((o) => isLive(o)), tags: {} })),
      propApi.catalog.retryEligibility().catch(() => ({ eligibility: [] })),
    ]);
    return { offers: mine.offers as TraderOffer[], retry: retry.eligibility as Retry[] };
  });
  const { busy, note, run } = useAction();

  return (
    <>
      <PageHeader title="Offers" subtitle="Promotions available on your account right now." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {note && <div className="mb-4"><Note tone={note.tone}>{note.text}</Note></div>}
      {loading && !data ? (
        <Card><Loading label="Loading offers…" /></Card>
      ) : !data?.offers.length ? (
        <Card><EmptyState icon={<Gift className="h-5 w-5" />} title="No offers right now" body="New promotions will show up here — keep an eye on your notifications." /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.offers.map((o) => {
            const retries = data.retry.filter((r) => r.offer?.id === o.id);
            const bogo = o.type === "bogo";
            return (
              <Card key={o.id} highlight={!!o.targeted} className="flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">{bogo ? <Gift className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}</span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {o.targeted && <Badge tone="info"><Sparkles className="h-3 w-3" />For you</Badge>}
                    <Badge tone="success">{bogo ? "Buy & get free" : "Free retry"}</Badge>
                  </div>
                </div>
                <h2 className="mt-4 font-display text-lg font-semibold">{o.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{o.description || o.summary || offerSummary(o as Offer)}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{o.accountSizes?.length ? o.accountSizes.map((s) => sizeLabel(Number(s))).join(", ") : "All account sizes"}</span>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1">{o.models?.length ? o.models.join(", ") : "All challenge types"}</span>
                  {o.expiresAt && <span className="rounded-full bg-white/[0.06] px-2.5 py-1">Ends {fmtDate(o.expiresAt)}</span>}
                </div>

                {!!o.accounts?.length && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Applied to your accounts</p>
                    {o.accounts.map((a) => (
                      <div key={a.accountId} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2 text-xs">
                        <span>{a.platform} #{a.login || a.accountId}</span>
                        <Badge tone={a.kind === "granted" || a.kind === "applied" ? "success" : "info"}>{a.kind}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-5">
                  {bogo ? (
                    <Button variant="primary" href="/dashboard/new-challenge">Buy a challenge</Button>
                  ) : retries.length ? (
                    <div className="space-y-2">
                      {retries.map((r) => (
                        <div key={r.accountId} className={cx("flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-4 py-3 text-sm")}>
                          <span>{r.planName} · #{r.accountId} <span className="text-muted-foreground">({r.offer?.retriesRemaining} left)</span></span>
                          <Button size="sm" variant="primary" busy={busy === r.accountId} onClick={async () => (await run(r.accountId, () => propApi.catalog.claimRetry(r.accountId), "Free retry claimed — your new account is being prepared.")) && reload()}>Claim free retry</Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Applies automatically if a covered account breaches a rule.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
