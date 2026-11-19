import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CreditCard, Megaphone, Percent, RotateCcw, Send, ShoppingCart, UserPlus } from "lucide-react";
import {
  Badge, Button, Card, CardHeader, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, SearchInput, cx, inputCls, useAction, useApi,
} from "@/components/portal/ui";
import { propApi, type FollowUpData, type FollowUpDraft, type FollowUpRecipient, type FollowUpSegmentId } from "@/lib/propApi";
import { fmtDate } from "@/lib/portal";

export const Route = createFileRoute("/admin/follow-ups")({ component: AdminFollowUps });

const ICONS: Record<FollowUpSegmentId, typeof Send> = {
  unpaid_orders: ShoppingCart,
  unverified: BadgeCheck,
  no_orders: UserPlus,
  failed_challenge: RotateCcw,
  all_traders: Megaphone,
  crypto_extra_5: Percent,
};
const RECENT_MS = 3 * 864e5;
const PLACEHOLDERS = ["{{name}}", "{{plan}}", "{{amount}}", "{{orderId}}", "{{coupon}}", "{{account}}"];
const ACCOUNT_SIZES = ["$5K", "$10K", "$25K", "$50K", "$100K", "$200K"];

const draftFor = (data: FollowUpData, id: FollowUpSegmentId): FollowUpDraft => {
  const p = data.presets[id];
  return { subject: p.subject, title: p.title, message: p.message, ctaLabel: p.ctaLabel, ctaUrl: p.ctaPath, coupon: "", account: id === "crypto_extra_5" ? "$100K" : "" };
};

function AdminFollowUps() {
  const { data, error, loading, reload } = useApi(() => propApi.admin.followUps(), [], "/admin");
  const [segment, setSegment] = useState<FollowUpSegmentId>("unpaid_orders");
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [skipRecent, setSkipRecent] = useState(true);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { busy, note, setNote, run } = useAction();

  const seg = data?.segments.find((s) => s.id === segment);
  const recent = (r: FollowUpRecipient) => !!r.lastFollowUpAt && Date.now() - new Date(r.lastFollowUpAt).getTime() < RECENT_MS;

  // Reset the draft and selection when the audience changes (not when data reloads after a send).
  const [initFor, setInitFor] = useState<FollowUpSegmentId | null>(null);
  useEffect(() => {
    if (!data || !seg || initFor === segment) return;
    setInitFor(segment);
    setDraft(draftFor(data, segment));
    setSelected(new Set(seg.recipients.filter((r) => !skipRecent || !recent(r)).map((r) => r.userId)));
    setNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, segment]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (seg?.recipients ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.orderId?.toLowerCase().includes(q));
  }, [seg, search]);

  const coupon = data?.coupons.find((c) => c.code === draft?.coupon);
  const hasOrder = segment === "unpaid_orders" || segment === "failed_challenge";

  // Debounced server-rendered preview of the exact branded email.
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      propApi.admin.previewFollowUp({ ...draft, withOrder: hasOrder, ...(coupon ? { couponPercent: coupon.discountPercent } : {}) })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [draft, hasOrder, coupon]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = rows.length > 0 && rows.every((r) => selected.has(r.userId));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    rows.forEach((r) => (allShown ? n.delete(r.userId) : n.add(r.userId)));
    return n;
  });
  const applySkipRecent = (on: boolean) => {
    setSkipRecent(on);
    if (on && seg) setSelected((s) => new Set([...s].filter((id) => !recent(seg.recipients.find((r) => r.userId === id)!))));
  };

  const set = (k: keyof FollowUpDraft) => (e: { target: { value: string } }) => draft && setDraft({ ...draft, [k]: e.target.value });
  const count = selected.size;
  const send = async () => {
    if (!draft) return;
    let res = { sentCount: 0, failedCount: 0, failed: [] as string[] };
    setConfirm(false);
    if (await run("send", async () => { res = await propApi.admin.sendFollowUps({ ...draft, segment, userIds: [...selected] }); })) {
      setNote({
        tone: res.failedCount ? "error" : "success",
        text: `Sent ${res.sentCount} email${res.sentCount === 1 ? "" : "s"}${res.failedCount ? `, ${res.failedCount} failed: ${res.failed.join(", ")}` : "."}`,
      });
      void reload();
    }
  };

  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Win back unpaid orders, nudge new sign-ups and send promotions — in the Bullish 4ex email style." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data && !data.emailConfigured && <div className="mb-4"><Note tone="warning">Email delivery is not configured on the server yet (SMTP_PASS). Emails can't be sent until it is set.</Note></div>}

      {loading && !data ? <Card><Loading /></Card> : data && draft && seg ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {data.segments.map((s) => {
              const Icon = ICONS[s.id];
              const active = s.id === segment;
              return (
                <button
                  key={s.id}
                  onClick={() => setSegment(s.id)}
                  className={cx(
                    "rounded-xl border p-4 text-left transition",
                    active ? "border-primary/60 bg-primary/[0.08]" : "border-white/[0.06] bg-card hover:border-white/15",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={cx("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                    <span className={cx("text-xl font-bold tabular-nums", active ? "text-primary" : "")}>{s.recipients.length}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{s.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Recipients */}
            <Card className="min-w-0 xl:self-start">
              <CardHeader title={`Recipients · ${seg.label}`} meta={<span className="text-xs text-muted-foreground">{count} of {seg.recipients.length} selected</span>} />
              <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.05] px-5 py-3">
                <div className="min-w-[12rem] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search name, email or order…" /></div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={skipRecent} onChange={(e) => applySkipRecent(e.target.checked)} className="accent-[#2563eb]" />
                  Skip if emailed in last 3 days
                </label>
              </div>
              {!rows.length ? (
                <EmptyState title="Nobody in this audience" body="When users match this segment they'll show up here." />
              ) : (
                <div className="max-h-[32rem] overflow-y-auto">
                  <label className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-2.5 text-xs font-medium text-muted-foreground">
                    <input type="checkbox" checked={allShown} onChange={toggleAll} className="accent-[#2563eb]" />
                    Select all {rows.length}
                  </label>
                  {rows.map((r) => (
                    <label key={r.userId} className={cx("flex cursor-pointer items-start gap-3 border-b border-white/[0.04] px-5 py-3 transition hover:bg-white/[0.02]", selected.has(r.userId) && "bg-primary/[0.04]")}>
                      <input type="checkbox" checked={selected.has(r.userId)} onChange={() => toggle(r.userId)} className="mt-1 accent-[#2563eb]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{r.name}</p>
                          {recent(r) && <Badge tone="warning">Emailed {fmtDate(r.lastFollowUpAt!)}</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                        {r.orderId && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <CreditCard className="h-3 w-3" />
                            <span className="text-foreground">{r.plan}</span>· ${r.amount?.toFixed(2)} · {r.orderId}{r.orderDate && ` · ${fmtDate(r.orderDate)}`}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </Card>

            {/* Composer + preview */}
            <Card className="min-w-0">
              <CardHeader title="Email" actions={<Button size="sm" variant="ghost" onClick={() => setDraft(draftFor(data, segment))}><RotateCcw className="h-3.5 w-3.5" />Reset</Button>} />
              <div className="space-y-4 p-5">
                {(segment === "crypto_extra_5" || `${draft.subject}${draft.title}${draft.message}`.includes("{{account}}")) && (
                  <Field label="Account size" hint="Fills {{account}} in the subject, heading and message">
                    <input list="followup-account-sizes" value={draft.account ?? ""} onChange={set("account")} className={inputCls} placeholder="e.g. $100K" />
                    <datalist id="followup-account-sizes">{ACCOUNT_SIZES.map((s) => <option key={s} value={s} />)}</datalist>
                  </Field>
                )}
                <Field label="Subject"><input value={draft.subject} onChange={set("subject")} className={inputCls} /></Field>
                <Field label="Heading"><input value={draft.title} onChange={set("title")} className={inputCls} /></Field>
                <Field label="Message"><textarea rows={5} value={draft.message} onChange={set("message")} className={inputCls} /></Field>
                <p className="-mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  Insert:
                  {PLACEHOLDERS.map((p) => (
                    <button key={p} type="button" onClick={() => setDraft({ ...draft, message: `${draft.message}${p}` })} className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono hover:bg-white/10">{p}</button>
                  ))}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Button text"><input value={draft.ctaLabel} onChange={set("ctaLabel")} className={inputCls} /></Field>
                  <Field label="Button link" hint="A path like /pricing or a full URL"><input value={draft.ctaUrl} onChange={set("ctaUrl")} className={inputCls} /></Field>
                </div>
                <Field label="Coupon (optional)">
                  <select value={draft.coupon} onChange={set("coupon")} className={inputCls}>
                    <option value="">No coupon</option>
                    {data.coupons.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.discountPercent}% off</option>)}
                  </select>
                </Field>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Preview{preview?.subject && <span className="ml-2 text-foreground">“{preview.subject}”</span>}</p>
                  <iframe title="Email preview" sandbox="" srcDoc={preview?.html ?? ""} className="h-[26rem] w-full rounded-lg border border-white/10 bg-[#09090b]" />
                </div>

                <Button variant="primary" className="w-full" busy={busy === "send"} disabled={!count || !draft.subject || !draft.title || !draft.message || !data.emailConfigured} onClick={() => setConfirm(true)}>
                  <Send className="h-4 w-4" />Send to {count} {count === 1 ? "person" : "people"}
                </Button>
                {note && <Note tone={note.tone}>{note.text}</Note>}
              </div>
            </Card>
          </div>

          <Modal
            open={confirm}
            onClose={() => setConfirm(false)}
            title="Send follow-up emails?"
            footer={<>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
              <Button variant="primary" onClick={send}><Send className="h-4 w-4" />Send {count}</Button>
            </>}
          >
            <p className="text-sm text-muted-foreground">
              “<span className="text-foreground">{draft.subject}</span>” will be emailed to <b className="text-foreground">{count}</b> {count === 1 ? "person" : "people"} in <b className="text-foreground">{seg.label}</b>
              {draft.coupon && <> with coupon <b className="text-primary">{draft.coupon}</b></>}. This can't be undone.
            </p>
          </Modal>
        </>
      ) : null}
    </>
  );
}
