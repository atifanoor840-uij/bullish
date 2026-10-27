import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pause, Play, Gift, RotateCcw } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, inputCls, useAction, useApi } from "@/components/portal/ui";
import { propApi, type Offer } from "@/lib/propApi";
import { fmtDate, sizeLabel } from "@/lib/portal";

export const Route = createFileRoute("/admin/offers")({ component: AdminOffers });

function AdminOffers() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.catalog.offers()).offers, [], "/admin");
  const [edit, setEdit] = useState<Partial<Offer> | null>(null);
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader title="Offers" subtitle="Buy-one-get-one bundles and free retries, applied automatically." actions={<Button variant="primary" onClick={() => setEdit({ type: "bogo", status: "active", buyQuantity: 1, freeQuantity: 1, retryLimit: 1, maxRedemptions: 0 })}><Plus className="h-4 w-4" />New offer</Button>} />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Card><Loading /></Card> : !data?.length ? (
        <Card><EmptyState icon={<Gift className="h-5 w-5" />} title="No offers yet" body="Create a BOGO bundle or a free-retry offer." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((o) => (
            <Card key={o.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">{o.type === "bogo" ? <Gift className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}</span>
                <Badge>{o.isExpired ? "expired" : o.isScheduled ? "scheduled" : o.status}</Badge>
              </div>
              <p className="mt-4 font-semibold">{o.name}</p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{o.description || (o.type === "bogo" ? `Buy ${o.buyQuantity}, get ${o.freeQuantity} free` : `${o.retryLimit} free retry per failed account`)}</p>
              <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{o.accountSizes.length ? o.accountSizes.map(sizeLabel).join(", ") : "All sizes"}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{o.models.length ? o.models.join(", ") : "All models"}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{o.redeemedCount}{o.maxRedemptions ? ` / ${o.maxRedemptions}` : ""} redeemed</span>
                {o.expiresAt && <span className="rounded-full bg-white/[0.06] px-2 py-0.5">Ends {fmtDate(o.expiresAt)}</span>}
              </div>
              <div className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4">
                <Button size="sm" onClick={() => setEdit(o)}>Edit</Button>
                <Button size="sm" variant="ghost" busy={busy === o.id} onClick={async () => (await run(o.id, () => propApi.catalog.setOfferStatus(o.id, o.status === "active" ? "paused" : "active"))) && reload()}>
                  {o.status === "active" ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Resume</>}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {edit && <EditOffer offer={edit} onClose={() => setEdit(null)} onChanged={reload} />}
    </>
  );
}

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function EditOffer({ offer, onClose, onChanged }: { offer: Partial<Offer>; onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({
    name: offer.name ?? "", type: offer.type ?? "bogo", description: offer.description ?? "", status: offer.status ?? "active",
    startsAt: offer.startsAt?.slice(0, 10) ?? "", expiresAt: offer.expiresAt?.slice(0, 10) ?? "",
    accountSizes: (offer.accountSizes ?? []).join(", "), models: (offer.models ?? []).join(", "),
    buyQuantity: String(offer.buyQuantity ?? 1), freeQuantity: String(offer.freeQuantity ?? 1), retryLimit: String(offer.retryLimit ?? 1), maxRedemptions: String(offer.maxRedemptions ?? 0),
  });
  const { busy, note, run } = useAction();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const body = {
      ...(offer.id ? { id: offer.id } : {}),
      name: f.name, type: f.type as Offer["type"], description: f.description, status: f.status as Offer["status"],
      ...(f.startsAt ? { startsAt: new Date(f.startsAt).toISOString() } : {}),
      ...(f.expiresAt ? { expiresAt: new Date(f.expiresAt).toISOString() } : {}),
      accountSizes: list(f.accountSizes).map(Number), models: list(f.models),
      buyQuantity: Number(f.buyQuantity), freeQuantity: Number(f.freeQuantity), retryLimit: Number(f.retryLimit), maxRedemptions: Number(f.maxRedemptions),
    };
    if (await run("save", () => propApi.catalog.saveOffer(body), "Offer saved.")) onChanged();
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={offer.id ? `Edit ${offer.name}` : "New offer"}
      footer={
        <>
          {offer.id && <Button variant="danger" className="mr-auto" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.catalog.deleteOffer(offer.id!))) { onChanged(); onClose(); } }}><Trash2 className="h-4 w-4" />Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy === "save"} disabled={!f.name} onClick={save}>Save offer</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><input value={f.name} onChange={set("name")} className={inputCls} /></Field>
        <Field label="Type"><select value={f.type} onChange={set("type")} className={inputCls}><option value="bogo">Buy X get Y free</option><option value="free_retry">Free retry</option></select></Field>
        <Field label="Status"><select value={f.status} onChange={set("status")} className={inputCls}><option>active</option><option>paused</option></select></Field>
        <Field label="Description" className="sm:col-span-2"><textarea rows={2} value={f.description} onChange={set("description")} className={inputCls} /></Field>
        {f.type === "bogo" ? (
          <>
            <Field label="Buy quantity"><input type="number" min={1} value={f.buyQuantity} onChange={set("buyQuantity")} className={inputCls} /></Field>
            <Field label="Free quantity"><input type="number" min={1} value={f.freeQuantity} onChange={set("freeQuantity")} className={inputCls} /></Field>
          </>
        ) : (
          <Field label="Retries per account"><input type="number" min={1} value={f.retryLimit} onChange={set("retryLimit")} className={inputCls} /></Field>
        )}
        <Field label="Max redemptions" hint="0 = unlimited"><input type="number" min={0} value={f.maxRedemptions} onChange={set("maxRedemptions")} className={inputCls} /></Field>
        <Field label="Account sizes" hint="Comma separated, e.g. 50000, 100000 — empty = all"><input value={f.accountSizes} onChange={set("accountSizes")} className={inputCls} /></Field>
        <Field label="Models" hint="One Step, Two Step, Instant, Flex — empty = all"><input value={f.models} onChange={set("models")} className={inputCls} /></Field>
        <Field label="Starts"><input type="date" value={f.startsAt} onChange={set("startsAt")} className={inputCls} /></Field>
        <Field label="Ends"><input type="date" value={f.expiresAt} onChange={set("expiresAt")} className={inputCls} /></Field>
        {note && <div className="sm:col-span-2"><Note tone={note.tone}>{note.text}</Note></div>}
      </div>
    </Modal>
  );
}
