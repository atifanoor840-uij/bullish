import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ShieldAlert, ShieldX, Clock, Lock, RefreshCw } from "lucide-react";
import { Badge, Button, Card, ErrorNote, Loading, Note, PageHeader, useAction, useApi } from "@/components/portal/ui";
import { propApi, type Kyc } from "@/lib/propApi";
import { fmtDate } from "@/lib/portal";

export const Route = createFileRoute("/dashboard/kyc")({ component: KycPage });

function KycPage() {
  const { data, error, loading, reload } = useApi(async () => {
    const r = await propApi.kyc.get();
    return { kyc: r.kyc as Kyc | undefined, eligible: !!r.isEligible };
  });
  const { busy, note, run } = useAction();

  const start = () =>
    run("start", async () => {
      const { kyc } = await propApi.kyc.startDidit();
      if (kyc.backUrl?.startsWith("http")) window.open(kyc.backUrl, "_blank", "noopener,noreferrer");
      await reload();
    });

  const status = data?.kyc?.status;
  const view = !data?.eligible && !data?.kyc
    ? { icon: <Lock className="h-6 w-6" />, cls: "bg-white/[0.05] text-muted-foreground", title: "Verification unlocks after you get funded", body: "Once you have a funded account, verify your identity here to enable payouts." }
    : status === "approved"
      ? { icon: <ShieldCheck className="h-6 w-6" />, cls: "bg-profit/15 text-profit", title: "You're verified", body: "Your identity has been confirmed. Payouts are enabled." }
      : status === "rejected"
        ? { icon: <ShieldX className="h-6 w-6" />, cls: "bg-loss/15 text-loss", title: "Verification was declined", body: data?.kyc?.rejectReason || "Please try again with clear, valid documents." }
        : status === "pending" || status === "needs_review"
          ? { icon: <Clock className="h-6 w-6" />, cls: "bg-amber-500/15 text-amber-500", title: "Verification in review", body: "This usually takes a few minutes. We'll notify you when it's done." }
          : { icon: <ShieldAlert className="h-6 w-6" />, cls: "bg-primary/15 text-primary", title: "Verify your identity", body: "Takes about 2 minutes — you'll need a valid ID and your phone camera." };

  return (
    <>
      <PageHeader title="Verification" subtitle="Identity verification (KYC) is required before your first payout." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <Card><Loading /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="p-8">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${view.cls}`}>{view.icon}</span>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-xl font-semibold">{view.title}</h2>
              {status && <Badge>{status === "needs_review" ? "In review" : status}</Badge>}
            </div>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">{view.body}</p>
            {data?.kyc?.updatedAt && <p className="mt-2 text-xs text-muted-foreground">Last updated {fmtDate(data.kyc.updatedAt, true)}</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              {data?.eligible && status !== "approved" && status !== "pending" && (
                <Button variant="primary" busy={busy === "start"} onClick={start}>{status === "rejected" ? "Try again" : "Start verification"}</Button>
              )}
              {data?.kyc && status !== "approved" && (
                <Button busy={busy === "sync"} onClick={() => run("sync", async () => { await propApi.kyc.syncDidit(); await reload(); }, "Status refreshed.")}>
                  <RefreshCw className="h-4 w-4" />Refresh status
                </Button>
              )}
            </div>
            {note && <div className="mt-4"><Note tone={note.tone}>{note.text}</Note></div>}
          </Card>
          <Card className="p-6">
            <p className="text-sm font-semibold">What you'll need</p>
            <ol className="mt-4 space-y-4 text-sm">
              {["A valid passport, national ID or driver's licence", "A device with a camera for a quick selfie", "Good lighting and a steady connection"].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </>
  );
}
