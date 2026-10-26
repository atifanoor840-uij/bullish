import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wallet, Clock, Percent, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, ErrorNote, Field, Loading, Note, PageHeader, Pager, StatCard, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { propApi, type Kyc } from "@/lib/propApi";
import { fmtDate, money, num, signed } from "@/lib/portal";

export const Route = createFileRoute("/dashboard/payouts")({ component: Payouts });

const METHODS = [
  { id: "USDT (TRC20)", fields: [["address", "Wallet address (TRC20)"]] },
  { id: "Rise", fields: [["email", "Rise account email"]] },
  { id: "Bank transfer", fields: [["accountName", "Account holder"], ["bankName", "Bank name"], ["iban", "IBAN / account number"]] },
] as const;

function Payouts() {
  const { data, error, loading, reload } = useApi(async () => {
    const [payouts, accounts, kyc] = await Promise.all([propApi.payouts.list(), propApi.accounts.list(), propApi.kyc.get().catch(() => ({ kyc: undefined }))]);
    return { payouts: payouts.payouts, accounts: accounts.accounts, kyc: kyc.kyc as Kyc | undefined };
  });
  const funded = (data?.accounts ?? []).filter((a) => a.status === "Funded" && a.deliveryStatus === "delivered");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("USDT (TRC20)");
  const [details, setDetails] = useState<Record<string, string>>({});
  const { busy, note, setNote, run } = useAction();

  const rows = [...(data?.payouts ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const { slice, ...pager } = usePaged(rows, 10);
  const paid = rows.filter((p) => p.status === "paid").reduce((s, p) => s + num(p.profitSplitAmount), 0);
  const pending = rows.filter((p) => ["pending", "approved", "processing"].includes(p.status)).reduce((s, p) => s + num(p.amount), 0);
  const paidCount = rows.filter((p) => p.status === "paid").length;
  // Official Bullish4ex profit split: 1st: 70%, 2nd: 80%, 3rd: 90%, 4th+: up to 100%. Flex is 85% (90% with add-on)
  const SPLITS = [70, 80, 90, 100];
  const split = SPLITS[Math.min(SPLITS.length - 1, paidCount)]!;
  const nextSplit = SPLITS[Math.min(SPLITS.length - 1, paidCount + 1)]!;
  const kycOk = data?.kyc?.status === "approved";
  const selected = funded.find((a) => a.id === (accountId || funded[0]?.id));
  const m = METHODS.find((x) => x.id === method)!;

  const submit = async () => {
    if (!selected) return;
    let result: Awaited<ReturnType<typeof propApi.payouts.request>> | null = null;
    const ok = await run("req", async () => {
      result = await propApi.payouts.request({ accountId: selected.id, amount: Number(amount), paymentMethod: method, paymentDetails: details });
    });
    if (ok && result) {
      const w = (result as Awaited<ReturnType<typeof propApi.payouts.request>>).withdrawal;
      setNote({ tone: "success", text: w.wasAdjusted ? `Request submitted. Amount adjusted to ${money(w.adjustedAmount)} (period cap ${money(w.withdrawalCap)}).` : "Payout requested. All open trades must remain closed until processed." });
      setAmount("");
      void reload();
    }
  };

  return (
    <>
      <PageHeader title="Payouts" subtitle="Withdraw your profits from funded accounts under official Bullish4ex rules." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <Card><Loading label="Loading payouts…" /></Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard highlight label="Total paid out" value={money(paid)} icon={<Wallet className="h-4 w-4" />} sub={`${paidCount} completed payouts`} />
            <StatCard label="In review" value={money(pending)} icon={<Clock className="h-4 w-4" />} sub="Pending, approved or processing" />
            <StatCard label="Your current split" value={`${split}%`} icon={<Percent className="h-4 w-4" />} sub={paidCount >= 3 ? "Maximum 100% tier unlocked" : `Increases to ${nextSplit}% on next payout`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <Card className="xl:self-start">
              <CardHeader title="Request payout" />
              <div className="space-y-4 p-5">
                {!kycOk ? (
                  <EmptyState icon={<ShieldAlert className="h-5 w-5" />} title="Verify your identity first" body="Payouts unlock once your KYC verification is approved and Trader Agreement is signed." action={<Button variant="primary" href="/dashboard/kyc">Go to verification</Button>} />
                ) : !funded.length ? (
                  <EmptyState title="No funded accounts yet" body="Pass your evaluation to request payouts." />
                ) : (
                  <>
                    <Field label="Funded account">
                      <select value={selected?.id} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
                        {funded.map((a) => <option key={a.id} value={a.id}>#{a.login} · {money(a.balance, 0)} · P/L {signed(a.totalPl, 0)}</option>)}
                      </select>
                    </Field>
                    <Field label="Amount (USD)" hint="Min 1% of initial balance ($100 min for Flex). Capped at 6% of initial balance per 14-day cycle. Requires 5 Winning Days.">
                      <input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0.00" />
                    </Field>
                    <Field label="Payout method">
                      <select value={method} onChange={(e) => { setMethod(e.target.value as typeof method); setDetails({}); }} className={inputCls}>
                        {METHODS.map((x) => <option key={x.id}>{x.id}</option>)}
                      </select>
                    </Field>
                    {m.fields.map(([k, label]) => (
                      <Field key={k} label={label}><input value={details[k] ?? ""} onChange={(e) => setDetails({ ...details, [k]: e.target.value })} className={inputCls} /></Field>
                    ))}
                    {Number(amount) > 0 && <p className="text-xs text-muted-foreground">You receive ≈ <span className="font-semibold text-profit">{money((Number(amount) * (split ?? 70)) / 100)}</span> ({split}% trader split)</p>}
                    <Button variant="primary" className="w-full" busy={busy === "req"} disabled={Number(amount) < 100 || m.fields.some(([k]) => !details[k])} onClick={submit}>Request payout</Button>
                    <p className="text-[11px] text-muted-foreground text-center">Bi-weekly payouts · All trades must be closed when requesting</p>
                  </>
                )}
                {note && <Note tone={note.tone}>{note.text}</Note>}
              </div>
            </Card>

            <Card className="min-w-0">
              <CardHeader title="Payout history" />
              <DataTable
                rows={slice}
                rowKey={(p) => p.id}
                mobileTitle={(p) => money(p.amount)}
                empty={<EmptyState title="No payouts yet" body="Your withdrawals will appear here." />}
                columns={[
                  { key: "id", label: "ID", render: (p) => <span className="font-mono text-xs">{p.id}</span> },
                  { key: "date", label: "Requested", render: (p) => <span className="text-muted-foreground">{fmtDate(p.createdAt)}</span> },
                  { key: "acc", label: "Account", render: (p) => `#${p.accountId}` },
                  { key: "amount", label: "Gross", render: (p) => <span className="tabular-nums">{money(p.amount)}</span> },
                  { key: "share", label: "Your share", render: (p) => <span className="font-semibold text-profit tabular-nums">{money(p.profitSplitAmount)}</span> },
                  { key: "method", label: "Method", render: (p) => <span className="text-muted-foreground">{p.paymentMethod}</span> },
                  { key: "status", label: "Status", render: (p) => <Badge>{p.status}</Badge> },
                ]}
              />
              <Pager {...pager} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
