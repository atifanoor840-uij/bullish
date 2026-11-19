import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Field, Modal, Note, inputCls, useAction } from "@/components/portal/ui";
import { propApi, type InventoryItem, type Order, type TradingAccount } from "@/lib/propApi";
import { describeAccount, fmtDate, sizeLabel } from "@/lib/portal";

/** Deliver credentials to a pending account, or edit a delivered one. */
export function EditAccount({ account: a, ordersById, inventory, onClose, onChanged }: { account: TradingAccount; ordersById: Record<string, Order>; inventory: InventoryItem[]; onClose: () => void; onChanged: () => void }) {
  const deliver = a.deliveryStatus === "pending";
  const info = describeAccount(a, ordersById);
  const matching = inventory.filter((i) => i.status === "available" && i.platform === a.platform && Number(i.size) === info.size);
  const [form, setForm] = useState({
    platform: a.platform,
    login: deliver ? "" : a.login,
    passwordMaster: deliver ? "" : a.passwordMaster,
    passwordInvestor: deliver ? "" : a.passwordInvestor,
    server: deliver ? "" : a.server,
    status: a.status,
    phase: a.phase || "",
    balance: String(a.balance),
    equity: String(a.equity ?? a.balance),
    graphLink: a.graphLink || "",
    externalStatisticsId: a.externalStatisticsId || "",
    inventoryItemId: "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notifyTrader, setNotifyTrader] = useState(false);
  const [releaseOld, setReleaseOld] = useState(false);
  const { busy, note, run } = useAction();
  // Delivered account: did the admin change the login credentials themselves?
  const credsChanged = !deliver && (form.platform !== a.platform || form.server !== a.server || form.login !== a.login);
  const pwdChanged = !deliver && (form.passwordMaster !== a.passwordMaster || form.passwordInvestor !== a.passwordInvestor);
  const reset = () => setForm((f) => ({ ...f, platform: a.platform, login: a.login, passwordMaster: a.passwordMaster, passwordInvestor: a.passwordInvestor, server: a.server, inventoryItemId: "" }));
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const pickInventory = (id: string) => {
    const it = inventory.find((i) => i.id === id);
    setForm((f) => (it ? { ...f, inventoryItemId: id, login: it.login, passwordMaster: it.password, server: it.server, externalStatisticsId: it.externalStatisticsId || f.externalStatisticsId, graphLink: it.graphLink || f.graphLink } : { ...f, inventoryItemId: "" }));
  };

  const save = async () => {
    const { inventoryItemId, balance, equity, graphLink, externalStatisticsId, passwordInvestor, ...rest } = form;
    const ok = await run("save", () =>
      propApi.accounts.save({
        id: a.id, ...rest, status: rest.status as TradingAccount["status"], balance: Number(balance), equity: Number(equity),
        ...(passwordInvestor ? { passwordInvestor } : {}), ...(graphLink ? { graphLink } : {}), ...(externalStatisticsId ? { externalStatisticsId } : {}), ...(inventoryItemId ? { inventoryItemId } : {}),
        ...(!deliver && notifyTrader ? { notifyTrader: true } : {}), ...(!deliver && credsChanged && releaseOld ? { releaseOld: true } : {}),
      }), deliver ? "Credentials delivered and emailed to the trader." : notifyTrader ? "Account updated and new credentials emailed to the trader." : "Account updated.");
    if (ok) onChanged();
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={deliver ? `Deliver credentials · ${info.model} ${sizeLabel(info.size)}` : `Edit delivered account #${a.login}`}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" busy={busy === "save"} disabled={!form.login || !form.passwordMaster || !form.server} onClick={save}>{deliver ? "Deliver" : "Save changes"}</Button></>}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {a.userName} · {a.userEmail} · Order {a.orderId} · {info.phase}
          {!deliver && a.deliveredAt && <> · Delivered {fmtDate(a.deliveredAt, true)}</>}
        </p>
        <Field
          label={deliver ? "Use inventory credentials" : "Replace with inventory account"}
          hint={matching.length ? `${matching.length} available ${a.platform} ${sizeLabel(info.size)} accounts` : deliver ? "No matching inventory — enter credentials manually." : "No matching inventory — edit the credentials below."}
        >
          <select value={form.inventoryItemId} onChange={(e) => pickInventory(e.target.value)} className={inputCls}>
            <option value="">{deliver ? "Enter manually" : "Keep current / edit manually"}</option>
            {matching.map((i) => <option key={i.id} value={i.id}>#{i.login} · {i.server}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform"><select value={form.platform} onChange={set("platform")} className={inputCls}>{["MT5", "MT4", "cTrader"].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Server"><input value={form.server} onChange={set("server")} className={inputCls} /></Field>
          <Field label="Login"><input value={form.login} onChange={set("login")} className={inputCls} /></Field>
          <Field label="Master password"><input value={form.passwordMaster} onChange={set("passwordMaster")} className={inputCls} /></Field>
          <Field label="Investor password"><input value={form.passwordInvestor} onChange={set("passwordInvestor")} className={inputCls} /></Field>
          <Field label="Statistics ID"><input value={form.externalStatisticsId} onChange={set("externalStatisticsId")} className={inputCls} /></Field>
          <Field label="Public stats link" className="sm:col-span-2"><input value={form.graphLink} onChange={set("graphLink")} className={inputCls} placeholder="https://" /></Field>
        </div>
        {!deliver && (
          <div className="grid gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
            <Field label="Status" hint="Passed creates the next stage · Failed also fails the order."><select value={form.status} onChange={set("status")} className={inputCls}>{["Active", "Passed", "Failed", "Funded"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Phase"><select value={form.phase} onChange={set("phase")} className={inputCls}>{["Phase 1 (Evaluation)", "Phase 2 (Verification)", "Funded (Live)"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Balance"><input type="number" value={form.balance} onChange={set("balance")} className={inputCls} /></Field>
            <Field label="Equity"><input type="number" value={form.equity} onChange={set("equity")} className={inputCls} /></Field>
          </div>
        )}
        {!deliver && (
          <div className="space-y-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Delivery options</p>
              {(credsChanged || pwdChanged) && <Button size="sm" variant="ghost" onClick={reset}>Undo credential changes</Button>}
            </div>
            {(credsChanged || pwdChanged) && <p className="text-xs text-amber-500">Credentials changed — the trader will only see the new login after you save.</p>}
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={notifyTrader} onChange={(e) => setNotifyTrader(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              <span>Email the credentials to the trader again <span className="text-muted-foreground">(re-send after saving)</span></span>
            </label>
            {credsChanged && (
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={releaseOld} onChange={(e) => setReleaseOld(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                <span>Return old login <span className="font-mono text-xs">#{a.login}</span> to inventory as available</span>
              </label>
            )}
          </div>
        )}
        {note && <Note tone={note.tone}>{note.text}</Note>}
        <div className="border-t border-white/[0.06] pt-4">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-loss">Delete this account? Inventory credentials are released.</span>
              <Button size="sm" variant="danger" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.accounts.remove(a.id))) { onChanged(); onClose(); } }}>Yes, delete</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Delete account</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
