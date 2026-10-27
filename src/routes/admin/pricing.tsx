import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, inputCls, useAction, useApi } from "@/components/portal/ui";
import { propApi, type PricingPlan } from "@/lib/propApi";
import { price, sizeLabel } from "@/lib/portal";

export const Route = createFileRoute("/admin/pricing")({ component: AdminPricing });

const MODELS: PricingPlan["model"][] = ["One Step", "Two Step", "Instant", "Flex"];
const SIZES = [3000, 5000, 10000, 25000, 50000, 100000, 200000];
const DEFAULT_REAL_PRICE: Record<number, number> = {
  3000: 35,
  5000: 49,
  10000: 89,
  25000: 179,
  50000: 299,
  100000: 529,
  200000: 999,
};

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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className="font-semibold tabular-nums">{price(p.price)}</span>
                            <Badge>{p.status}</Badge>
                          </div>
                          {p.model === "Flex" && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              Real: {price(p.realPrice ?? DEFAULT_REAL_PRICE[p.size] ?? p.price)} · Rem: {price(Math.max(0, (p.realPrice ?? DEFAULT_REAL_PRICE[p.size] ?? p.price) - p.price))}
                            </p>
                          )}
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
  const availableSizes = plan.size && !SIZES.includes(plan.size) ? [...SIZES, plan.size].sort((a, b) => a - b) : SIZES;
  const initialModel = plan.model ?? "Two Step";
  const initialSize = plan.size ?? 100000;
  const isFlexInitial = initialModel === "Flex";

  const [form, setForm] = useState({
    model: initialModel,
    size: String(initialSize),
    price: String(plan.price !== undefined ? plan.price : isFlexInitial ? 9 : ""),
    realPrice: String(plan.realPrice !== undefined ? plan.realPrice : isFlexInitial ? (DEFAULT_REAL_PRICE[initialSize] ?? 529) : ""),
    status: plan.status ?? "active",
  });
  const { busy, note, run } = useAction();

  const isFlex = form.model === "Flex";

  const handleModelChange = (m: PricingPlan["model"]) => {
    const nextIsFlex = m === "Flex";
    const currentSize = Number(form.size) || 100000;
    setForm((prev) => ({
      ...prev,
      model: m,
      price: nextIsFlex && (!prev.price || prev.price === "0") ? "9" : prev.price,
      realPrice: nextIsFlex && !prev.realPrice ? String(DEFAULT_REAL_PRICE[currentSize] ?? 529) : prev.realPrice,
    }));
  };

  const handleSizeChange = (s: string) => {
    const numSize = Number(s);
    setForm((prev) => ({
      ...prev,
      size: s,
      realPrice: isFlex && (!prev.realPrice || prev.realPrice === String(DEFAULT_REAL_PRICE[Number(prev.size)]))
        ? String(DEFAULT_REAL_PRICE[numSize] ?? prev.realPrice)
        : prev.realPrice,
    }));
  };

  const save = async () => {
    if (
      await run(
        "save",
        () =>
          propApi.catalog.savePricingPlan({
            model: form.model as PricingPlan["model"],
            size: Number(form.size),
            price: Number(form.price),
            realPrice: isFlex ? Number(form.realPrice) || undefined : undefined,
            status: form.status,
          }),
        "Plan saved.",
      )
    )
      onChanged();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={plan.id ? `Edit ${plan.model} ${sizeLabel(plan.size ?? 0)}` : "Add plan"}
      footer={
        <>
          {plan.id && (
            <Button
              variant="danger"
              className="mr-auto"
              busy={busy === "del"}
              onClick={async () => {
                if (await run("del", () => propApi.catalog.deletePricingPlan(plan.id!))) {
                  onChanged();
                  onClose();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            busy={busy === "save"}
            disabled={!Number(form.size) || (!isFlex && !Number(form.price))}
            onClick={save}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Model">
          <select
            value={form.model}
            disabled={!!plan.id}
            onChange={(e) => handleModelChange(e.target.value as PricingPlan["model"])}
            className={inputCls}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account size">
          <select
            value={form.size}
            disabled={!!plan.id}
            onChange={(e) => handleSizeChange(e.target.value)}
            className={inputCls}
          >
            {availableSizes.map((s) => (
              <option key={s} value={s}>
                {sizeLabel(s)} (${s.toLocaleString()})
              </option>
            ))}
          </select>
        </Field>
        {isFlex ? (
          <>
            <Field label="Initial Entry Fee ($)" hint="Upfront challenge fee to start evaluation (e.g. $9)">
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={inputCls}
                placeholder="9"
              />
            </Field>
            <Field label="Real / Funded Price ($)" hint="Full account cost paid after passing evaluation">
              <input
                type="number"
                value={form.realPrice}
                onChange={(e) => setForm({ ...form, realPrice: e.target.value })}
                className={inputCls}
                placeholder="179"
              />
            </Field>
            <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-xs text-muted-foreground sm:col-span-2">
              <p className="font-semibold text-foreground">Flex 2-Phase Fee Structure:</p>
              <p className="mt-1">
                • <strong>Initial payment (Today):</strong> Trader pays <span className="font-semibold text-primary">${form.price || "0"}</span> to start the evaluation challenge.
              </p>
              <p className="mt-0.5">
                • <strong>On Phase Pass (Funded):</strong> Trader pays the remaining <span className="font-semibold text-primary">${Math.max(0, Number(form.realPrice || 0) - Number(form.price || 0))}</span> (Real ${form.realPrice || "0"} − Initial ${form.price || "0"}) to receive the funded account.
              </p>
            </div>
          </>
        ) : (
          <Field label="Price ($)">
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={inputCls}
            />
          </Field>
        )}
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className={inputCls}
          >
            <option>active</option>
            <option>inactive</option>
          </select>
        </Field>
        <p className="text-[11px] text-muted-foreground sm:col-span-2">
          Model + size identify a plan — saving the same pair again updates it.
        </p>
        {note && (
          <div className="sm:col-span-2">
            <Note tone={note.tone}>{note.text}</Note>
          </div>
        )}
      </div>
    </Modal>
  );
}
