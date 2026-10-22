import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Note, PageHeader, inputCls, useAction } from "@/components/portal/ui";
import { usePortal } from "@/components/portal/context";
import { propApi } from "@/lib/propApi";
import { fmtDate } from "@/lib/portal";

export const Route = createFileRoute("/dashboard/settings")({ component: Settings });

function Settings() {
  const { user, refreshUser } = usePortal();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "", country: user.country || "" });
  const { busy, note, run } = useAction();

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile and account." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Profile" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Full name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Email" hint="Contact support to change your email."><input value={user.email} disabled className={`${inputCls} opacity-60`} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
            <Field label="Country"><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputCls} /></Field>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button variant="primary" busy={busy === "save"} onClick={async () => (await run("save", () => propApi.auth.updateProfile(form), "Profile updated.")) && refreshUser()}>Save changes</Button>
              {note && <Note tone={note.tone}>{note.text}</Note>}
            </div>
          </div>
        </Card>
        <Card className="xl:self-start">
          <CardHeader title="Account" />
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">User ID</dt><dd className="font-mono text-xs">{user.id}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{user.emailVerified === false ? <Badge tone="warning">Unverified</Badge> : <Badge tone="success">Verified</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd><Badge>{user.status}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Member since</dt><dd>{fmtDate(user.createdAt)}</dd></div>
          </dl>
          <div className="border-t border-white/[0.06] p-5">
            <Button variant="danger" className="w-full" onClick={async () => { await propApi.auth.signout().catch(() => {}); window.location.href = "/login"; }}>
              <LogOut className="h-4 w-4" />Sign out
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
