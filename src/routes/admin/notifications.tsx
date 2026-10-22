import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorNote, Field, Loading, Note, PageHeader, Pager, inputCls, useAction, useApi, usePaged } from "@/components/portal/ui";
import { NotificationList } from "@/components/portal/NotificationList";
import { propApi, type Notification, type User } from "@/lib/propApi";

export const Route = createFileRoute("/admin/notifications")({ component: AdminNotifications });

function AdminNotifications() {
  const { data, error, loading, reload } = useApi(async () => {
    const [n, u] = await Promise.all([propApi.notifications.list(), propApi.admin.users()]);
    return { notifications: n.notifications, users: u.users };
  }, [], "/admin");
  const [f, setF] = useState({ title: "", message: "", target: "all", type: "info" as Notification["type"], channel: "in_app" as Notification["channel"] });
  const { busy, note, setNote, run } = useAction();
  const { slice, ...pager } = usePaged(data?.notifications ?? [], 20);
  const traders = (data?.users ?? []).filter((u: User) => u.role === "trader");

  const send = async () => {
    let count = 0;
    const ok = await run("send", async () => {
      count = (await propApi.notifications.send({ title: f.title, message: f.message, targetUserId: f.target, type: f.type, channel: f.channel })).count;
    });
    if (ok) {
      setNote({ tone: "success", text: `Sent to ${count} ${count === 1 ? "user" : "users"}.` });
      setF({ ...f, title: "", message: "" });
      void reload();
    }
  };

  return (
    <>
      <PageHeader title="Notifications" subtitle="Send announcements to one trader or everyone." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="grid gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Card className="xl:self-start">
          <CardHeader title="Compose" />
          <div className="space-y-4 p-5">
            <Field label="Send to">
              <select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} className={inputCls}>
                <option value="all">Everyone (broadcast)</option>
                {traders.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Notification["type"] })} className={inputCls}>{["info", "success", "warning", "error"].map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Channel"><select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as Notification["channel"] })} className={inputCls}><option value="in_app">In-app</option><option value="email">In-app + email</option></select></Field>
            </div>
            <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} /></Field>
            <Field label="Message"><textarea rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={inputCls} /></Field>
            <Button variant="primary" className="w-full" busy={busy === "send"} disabled={!f.title || !f.message} onClick={send}><Send className="h-4 w-4" />Send notification</Button>
            {note && <Note tone={note.tone}>{note.text}</Note>}
          </div>
        </Card>
        <Card className="min-w-0">
          <CardHeader title="Sent notifications" meta={`${data?.notifications.length ?? 0}`} />
          {loading && !data ? <Loading /> : !slice.length ? <EmptyState title="Nothing sent yet" /> : <NotificationList items={slice} />}
          <Pager {...pager} />
        </Card>
      </div>
    </>
  );
}
