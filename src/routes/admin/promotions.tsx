import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, ErrorNote, Field, Loading, Note, PageHeader, Tabs, inputCls, useAction, useApi } from "@/components/portal/ui";
import { propApi, type User } from "@/lib/propApi";
import { fmtDate } from "@/lib/portal";

export const Route = createFileRoute("/admin/promotions")({ component: AdminPromotions });

type Template = { id: string; name: string; subject: string; html: string; updatedAt?: string };
type Subscriber = { id: number; email: string; source: string; status: string; createdAt: string };
type Audience = "traders" | "subscribers" | "custom";

function AdminPromotions() {
  const { data, error, loading, reload } = useApi(async () => {
    const [p, n, u] = await Promise.all([
      propApi.admin.promotions() as Promise<{ templates: Template[] }>,
      propApi.admin.newsletterSubscribers().catch(() => ({ subscribers: [] })) as Promise<{ subscribers: Subscriber[] }>,
      propApi.admin.users(),
    ]);
    return { templates: p.templates, subscribers: n.subscribers, users: u.users };
  }, [], "/admin");
  const [tab, setTab] = useState<"compose" | "subscribers">("compose");
  const [tpl, setTpl] = useState<Template>({ id: "", name: "", subject: "", html: "" });
  const [audience, setAudience] = useState<Audience>("traders");
  const [custom, setCustom] = useState("");
  const { busy, note, setNote, run } = useAction();

  const recipients = !data ? [] : audience === "traders"
    ? data.users.filter((u: User) => u.role === "trader" && u.status === "active").map((u) => u.email)
    : audience === "subscribers"
      ? data.subscribers.filter((s) => s.status === "active").map((s) => s.email)
      : custom.split(/[\s,;]+/).filter((e) => e.includes("@"));

  const saveTemplate = async () => {
    if (await run("save", () => propApi.admin.savePromotionTemplate({ ...(tpl.id ? { id: tpl.id } : {}), name: tpl.name, subject: tpl.subject, html: tpl.html }), "Template saved.")) void reload();
  };
  const send = async () => {
    let res: { sentCount?: number; failedCount?: number } = {};
    const batch = recipients.slice(0, 100);
    if (await run("send", async () => { res = (await propApi.admin.sendPromotion({ subject: tpl.subject, html: tpl.html, recipients: batch })) as typeof res; })) {
      setNote({ tone: "success", text: `Sent to ${res.sentCount ?? batch.length}${res.failedCount ? `, ${res.failedCount} failed` : ""}.${recipients.length > 100 ? " Only the first 100 recipients are sent per batch." : ""}` });
    }
  };

  return (
    <>
      <PageHeader title="Promotions" subtitle="Email campaigns to traders and newsletter subscribers." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "compose", label: "Campaigns" }, { id: "subscribers", label: "Subscribers", count: data?.subscribers.length ?? 0 }]} />
      </div>
      {loading && !data ? <Card><Loading /></Card> : tab === "subscribers" ? (
        <Card>
          <DataTable
            rows={data?.subscribers ?? []}
            rowKey={(s) => String(s.id)}
            mobileTitle={(s) => s.email}
            empty={<EmptyState title="No subscribers yet" />}
            columns={[
              { key: "email", label: "Email", render: (s) => s.email },
              { key: "src", label: "Source", render: (s) => <span className="capitalize text-muted-foreground">{s.source}</span> },
              { key: "date", label: "Subscribed", render: (s) => <span className="text-xs text-muted-foreground">{fmtDate(s.createdAt)}</span> },
              { key: "status", label: "Status", render: (s) => <Badge>{s.status}</Badge> },
            ]}
          />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="xl:self-start">
            <CardHeader title="Templates" actions={<Button size="sm" variant="ghost" onClick={() => setTpl({ id: "", name: "", subject: "", html: "" })}><Plus className="h-3.5 w-3.5" />New</Button>} />
            <div className="divide-y divide-white/[0.05]">
              {!data?.templates.length && <p className="p-5 text-sm text-muted-foreground">No saved templates.</p>}
              {data?.templates.map((t) => (
                <button key={t.id} onClick={() => setTpl(t)} className={`block w-full px-5 py-3 text-left text-sm transition hover:bg-white/[0.02] ${tpl.id === t.id ? "bg-primary/[0.06]" : ""}`}>
                  <p className="font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader title={tpl.id ? `Edit · ${tpl.name}` : "New campaign"} />
            <div className="grid gap-5 p-5 2xl:grid-cols-2">
              <div className="space-y-4">
                <Field label="Template name"><input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} className={inputCls} /></Field>
                <Field label="Subject"><input value={tpl.subject} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} className={inputCls} /></Field>
                <Field label="HTML body" hint="Use {{email}} to insert the recipient's email."><textarea rows={10} value={tpl.html} onChange={(e) => setTpl({ ...tpl, html: e.target.value })} className={`${inputCls} font-mono text-xs`} /></Field>
                <div className="flex flex-wrap gap-2">
                  <Button busy={busy === "save"} disabled={!tpl.name || !tpl.subject || !tpl.html} onClick={saveTemplate}>Save template</Button>
                  {tpl.id && <Button variant="danger" busy={busy === "del"} onClick={async () => { if (await run("del", () => propApi.admin.deletePromotionTemplate(tpl.id))) { setTpl({ id: "", name: "", subject: "", html: "" }); void reload(); } }}><Trash2 className="h-4 w-4" />Delete</Button>}
                </div>
              </div>
              <div className="space-y-4">
                <Field label="Preview">
                  <iframe title="Email preview" sandbox="" srcDoc={tpl.html || "<p style='font-family:sans-serif;color:#888'>Preview appears here</p>"} className="h-56 w-full rounded-lg border border-white/10 bg-white" />
                </Field>
                <Field label="Audience">
                  <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className={inputCls}>
                    <option value="traders">All active traders</option>
                    <option value="subscribers">Newsletter subscribers</option>
                    <option value="custom">Custom list</option>
                  </select>
                </Field>
                {audience === "custom" && <Field label="Emails" hint="Comma or newline separated"><textarea rows={3} value={custom} onChange={(e) => setCustom(e.target.value)} className={inputCls} /></Field>}
                <Button variant="primary" className="w-full" busy={busy === "send"} disabled={!tpl.subject || !tpl.html || !recipients.length} onClick={send}>
                  <Send className="h-4 w-4" />Send to {recipients.length} recipients
                </Button>
                {note && <Note tone={note.tone}>{note.text}</Note>}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
