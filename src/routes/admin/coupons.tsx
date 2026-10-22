import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, ErrorNote, Field, Loading, Modal, Note, PageHeader, inputCls, useAction, useApi } from "@/components/portal/ui";
import { propApi, type Coupon } from "@/lib/propApi";
import { fmtDate } from "@/lib/portal";

export const Route = createFileRoute("/admin/coupons")({ component: AdminCoupons });

function AdminCoupons() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.catalog.coupons()).coupons, [], "/admin");
  const [edit, setEdit] = useState<Partial<Coupon> | null>(null);
  return (
    <>
      <PageHeader title="Coupons" subtitle="Discount codes traders can use at checkout." actions={<Button variant="primary" onClick={() => setEdit({ status: "active" })}><Plus className="h-4 w-4" />New coupon</Button>} />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? <Loading /> : (
          <DataTable
            rows={data ?? []}
            rowKey={(c) => c.code}
            mobileTitle={(c) => c.code}
            empty={<EmptyState title="No coupons yet" />}
            columns={[
              { key: "code", label: "Code", render: (c) => <span className="font-mono font-semibold">{c.code}</span> },
              { key: "off", label: "Discount", render: (c) => <span className="font-semibold text-primary">{c.discountPercent}% off</span> },
              { key: "exp", label: "Expires", render: (c) => <span className="text-muted-foreground">{c.expiresAt ? fmtDate(c.expiresAt) : "Never"}</span> },
              { key: "status", label: "Status", render: (c) => <Badge>{c.isExpired ? "expired" : c.status}</Badge> },
              { key: "act", label: "", className: "text-right", render: (c) => <Button size="sm" onClick={() => setEdit(c)}>Edit</Button> },
            ]}
          />
        )}
      </Card>
      {edit && <EditCoupon coupon={edit} onClose={() => setEdit(null)} onChanged={reload} />}
    </>
  );
}

function EditCoupon({ coupon, onClose, onChanged }: { coupon: Partial<Coupon>; onClose: () => void; onChanged: () => void }) {
  const [form, setForm] = useState({ code: coupon.code ?? "", discountPercent: String(coupon.discountPercent ?? ""), status: coupon.status === "expired" ? "inactive" : (coupon.status ?? "active"), expiresAt: coupon.expiresAt?.slice(0, 10) ?? "" });
  const { busy, note, run } = useAction();
  const save = async () => {
    if (await run("save", () => propApi.catalog.saveCoupon({ code: form.code.trim().toUpperCase(), discountPercent: Number(form.discountPercent), status: form.status, ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}) }), "Coupon saved.")) onChanged();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={coupon.code ? `Edit ${coupon.code}` : "New coupon"}
      footer={
        <>
          {coupon.code && <Button variant="danger" className="mr-auto" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.catalog.deleteCoupon(coupon.code!))) { onChanged(); onClose(); } }}><Trash2 className="h-4 w-4" />Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy === "save"} disabled={!form.code || !Number(form.discountPercent)} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code"><input value={form.code} disabled={!!coupon.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={`${inputCls} uppercase`} /></Field>
        <Field label="Discount (%)"><input type="number" min={1} max={100} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className={inputCls} /></Field>
        <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}><option>active</option><option>inactive</option></select></Field>
        <Field label="Expires on" hint="Optional"><input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inputCls} /></Field>
        {note && <div className="sm:col-span-2"><Note tone={note.tone}>{note.text}</Note></div>}
      </div>
    </Modal>
  );
}
