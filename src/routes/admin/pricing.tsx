import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, inputCls, useAction, useApi } from "@/components/portal/ui";
import { propApi, type PricingPlan } from "@/lib/propApi";
import { price, sizeLabel } from "@/lib/portal";

export const Route = createFileRoute("/admin/pricing")({ component: AdminPricing });

const MODELS: PricingPlan["model"][] = ["One Step", "Two Step", "Instant"];

function AdminPricing() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.catalog.pricingPlans()).plans, [], "/admin");
  const [edit, setEdit] = useState<Partial<PricingPlan> | null>(null);

  return (
    <>
      <PageHeader
        title="Pricing"
        subtitle="The live buy catalog. Only active plans can be purchased."
        actions={<Button variant="primary" onClick={() => setEdit({ model: "Two Step", size: 100000, price: 0, status: "active" })}><Plus className="h-4 w-4" />Add plan</Button>}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <Card><Loading /></Card> : (
        <div className="grid gap-5 xl:grid-cols-3">
          {MODELS.map((m) => {
            const plans = (data ?? []).filter((p) => p.model === m).sort((a, b) => a.size - b.size);
            return (
              <Card key={m}>
                <CardHeader title={m} meta={`${plans.filter((p) => p.status === "active").length} active`} />
                {!plans.length ? <EmptyState title="No plans" /> : (
                  <div className="divide-y divide-white/[0.05]">
                    {plans.map((p) => (
                      <button key={p.id} onClick={() => setEdit(p)} className="flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:bg-white/[0.02]">
                        <div>
                          <p className="font-display font-semibold">{sizeLabel(p.size)}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{p.id}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums">{price(p.price)}</span>
                          <Badge>{p.status}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {edit && <EditPlan plan={edit} onClose={() => setEdit(null)} onChanged={reload} />}
    </>
  );
}

function EditPlan({ plan, onClose, onChanged }: { plan: Partial<PricingPlan>; onClose: () => void; onChanged: () => void }) {
  const [form, setForm] = useState({ model: plan.model ?? "Two Step", size: String(plan.size ?? ""), price: String(plan.price ?? ""), status: plan.status ?? "active" });
  const { busy, note, run } = useAction();
  const save = async () => {
    if (await run("save", () => propApi.catalog.savePricingPlan({ model: form.model as PricingPlan["model"], size: Number(form.size), price: Number(form.price), status: form.status }), "Plan saved.")) onChanged();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={plan.id ? `Edit ${plan.model} ${sizeLabel(plan.size ?? 0)}` : "Add plan"}
      footer={
        <>
          {plan.id && <Button variant="danger" className="mr-auto" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.catalog.deletePricingPlan(plan.id!))) { onChanged(); onClose(); } }}><Trash2 className="h-4 w-4" />Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy === "save"} disabled={!Number(form.size) || !Number(form.price)} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Model"><select value={form.model} disabled={!!plan.id} onChange={(e) => setForm({ ...form, model: e.target.value as PricingPlan["model"] })} className={inputCls}>{MODELS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Account size ($)"><input type="number" value={form.size} disabled={!!plan.id} onChange={(e) => setForm({ ...form, size: e.target.value })} className={inputCls} /></Field>
        <Field label="Price ($)"><input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} /></Field>
        <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}><option>active</option><option>inactive</option></select></Field>
        <p className="text-[11px] text-muted-foreground sm:col-span-2">Model + size identify a plan — saving the same pair again updates it.</p>
        {note && <div className="sm:col-span-2"><Note tone={note.tone}>{note.text}</Note></div>}
      </div>
    </Modal>
  );
}
