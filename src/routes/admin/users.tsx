import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Mail } from "lucide-react";
import { Badge, Button, Card, DataTable, ErrorNote, Field, Loading, Modal, Note, PageHeader, Pager, SearchInput, Tabs, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { propApi, type Role, type User } from "@/lib/propApi";
import { loginAsUser } from "@/lib/impersonation";
import { fmtDate } from "@/lib/portal";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

type F = "all" | "trader" | "staff" | "collaborator" | "blocked";
type EmailLog = { id: string; subject: string; status: string; sentAt: string; error?: string };

function AdminUsers() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.admin.users()).users, [], "/admin");
  const [filter, setFilter] = useState<F>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<User | null>(null);
  const [loginAs, setLoginAs] = useState<User | null>(null);
  const all = data ?? [];
  const rows = all.filter(
    (u) =>
      (filter === "all" || (filter === "staff" ? ["admin", "support"].includes(u.role) : filter === "blocked" ? u.status !== "active" : u.role === filter)) &&
      (!q || [u.name, u.email, u.id, u.country].some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
  );
  const { slice, ...pager } = usePaged(rows);

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone with an account — traders, partners and staff." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<F> value={filter} onChange={setFilter} tabs={[
          { id: "all", label: "All", count: all.length },
          { id: "trader", label: "Traders" },
          { id: "staff", label: "Staff" },
          { id: "collaborator", label: "Partners" },
          { id: "blocked", label: "Suspended", count: all.filter((u) => u.status !== "active").length },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email, country…" />
      </div>
      <Card>
        {loading && !data ? <Loading /> : (
          <>
            <DataTable
              rows={slice}
              rowKey={(u) => u.id}
              mobileTitle={(u) => u.name}
              columns={[
                {
                  key: "name", label: "User",
                  render: (u) => (
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold">{u.name.slice(0, 1).toUpperCase()}</span>
                      <div><p className="font-medium">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                    </div>
                  ),
                },
                { key: "role", label: "Role", render: (u) => <Badge tone={u.role === "admin" || u.role === "support" ? "info" : "neutral"} dot={false}>{u.role}</Badge> },
                { key: "country", label: "Country", render: (u) => u.country || "—" },
                { key: "verified", label: "Email", render: (u) => (u.emailVerified === false ? <Badge tone="warning">Unverified</Badge> : <Badge tone="success">Verified</Badge>) },
                { key: "joined", label: "Joined", render: (u) => <span className="text-xs text-muted-foreground">{fmtDate(u.createdAt)}</span> },
                { key: "status", label: "Status", render: (u) => <Badge>{u.status}</Badge> },
                { key: "act", label: "", className: "text-right", render: (u) => (
                    <div className="flex justify-end gap-2">
                      {canLoginAs(u) && <Button size="sm" variant="ghost" onClick={() => setLoginAs(u)}><LogIn className="h-3.5 w-3.5" />Login as</Button>}
                      <Button size="sm" onClick={() => setSel(u)}>Manage</Button>
                    </div>
                  ),
                },
              ]}
            />
            <Pager {...pager} />
          </>
        )}
      </Card>
      {sel && <EditUser user={sel} onClose={() => setSel(null)} onChanged={reload} onLoginAs={() => { setLoginAs(sel); setSel(null); }} />}
      {loginAs && <LoginAsDialog user={loginAs} onClose={() => setLoginAs(null)} />}
    </>
  );
}

/** Staff accounts can't be impersonated; the trader dashboard is for everyone else. */
const canLoginAs = (u: User) => u.role !== "admin" && u.role !== "support" && u.status === "active";

function LoginAsDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { user: admin } = usePortal();
  const { busy, note, run } = useAction();
  return (
    <Modal
      open
      onClose={onClose}
      title={`Log in as ${user.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy === "go"} onClick={() => run("go", () => loginAsUser(user, admin.name))}><LogIn className="h-4 w-4" />Open their dashboard</Button></>}
    >
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3 rounded-xl bg-background p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold font-bold text-primary-foreground">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><p className="font-semibold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email} · {user.role}</p></div>
        </div>
        <p className="text-muted-foreground">You will see the trader dashboard exactly as this user does, and any action you take is done as them. This is recorded in the audit log.</p>
        <Note tone="warning">Your admin session ends while you are logged in as this user. Use <strong>Back to CRM</strong> in the dashboard banner and sign in again to return.</Note>
        {note && <Note tone={note.tone}>{note.text}</Note>}
      </div>
    </Modal>
  );
}

function EditUser({ user, onClose, onChanged, onLoginAs }: { user: User; onClose: () => void; onChanged: () => void; onLoginAs: () => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone || "", country: user.country || "", role: user.role, status: user.status, newPassword: "" });
  const [logs, setLogs] = useState<EmailLog[] | null>(null);
  const { busy, note, run } = useAction();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    const { newPassword, ...rest } = form;
    if (await run("save", () => propApi.admin.updateUser({ userId: user.id, ...rest, ...(newPassword ? { newPassword } : {}) }), "User updated.")) onChanged();
  };

  return (
    <Modal open onClose={onClose} wide title={user.name} footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" busy={busy === "save"} onClick={save}>Save changes</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input value={form.name} onChange={set("name")} className={inputCls} /></Field>
          <Field label="Email"><input value={form.email} onChange={set("email")} className={inputCls} /></Field>
          <Field label="Phone"><input value={form.phone} onChange={set("phone")} className={inputCls} /></Field>
          <Field label="Country"><input value={form.country} onChange={set("country")} className={inputCls} /></Field>
          <Field label="Role">
            <select value={form.role} onChange={set("role")} className={inputCls}>{(["trader", "affiliate", "collaborator", "support", "admin"] as Role[]).map((r) => <option key={r}>{r}</option>)}</select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set("status")} className={inputCls}>{["active", "suspended", "banned"].map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Reset password" hint="Leave empty to keep the current password. Minimum 8 characters." className="sm:col-span-2">
            <input type="password" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} className={inputCls} />
          </Field>
        </div>
        {note && <Note tone={note.tone}>{note.text}</Note>}
        <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {canLoginAs(user) && <Button size="sm" onClick={onLoginAs}><LogIn className="h-3.5 w-3.5" />Log in as user</Button>}
          <Button size="sm" busy={busy === "logs"} onClick={() => run("logs", async () => setLogs(((await propApi.admin.emailLogs(user.id)) as { emailLogs: EmailLog[] }).emailLogs))}><Mail className="h-3.5 w-3.5" />Email history</Button>
        </div>
        {logs && (
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {!logs.length && <p className="text-sm text-muted-foreground">No emails sent to this user.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] px-3 py-2 text-xs">
                <div className="min-w-0"><p className="truncate font-medium">{l.subject}</p><p className="text-muted-foreground">{fmtDate(l.sentAt, true)}{l.error ? ` · ${l.error}` : ""}</p></div>
                <Badge>{l.status}</Badge>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">User ID {user.id} · joined {fmtDate(user.createdAt)}</p>
      </div>
    </Modal>
  );
}
