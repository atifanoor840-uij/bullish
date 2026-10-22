import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button, Card, EmptyState, ErrorNote, Loading, PageHeader, useApi } from "@/components/portal/ui";
import { NotificationList } from "@/components/portal/NotificationList";
import { usePortal } from "@/components/portal/context";
import { propApi } from "@/lib/propApi";

export const Route = createFileRoute("/dashboard/notifications")({ component: Notifications });

function Notifications() {
  const { refreshUnread } = usePortal();
  const { data, error, loading, reload, setData } = useApi(async () => (await propApi.notifications.list()).notifications);
  const unread = (data ?? []).filter((n) => !n.read);

  const markRead = async (ids: string[]) => {
    setData((d) => d?.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) ?? null);
    await Promise.all(ids.map((id) => propApi.notifications.markRead(id).catch(() => {})));
    refreshUnread();
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread.length ? `${unread.length} unread` : "You're all caught up."}
        actions={unread.length > 0 && <Button onClick={() => markRead(unread.map((n) => n.id))}><CheckCheck className="h-4 w-4" />Mark all read</Button>}
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? <Loading /> : !data?.length ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="No notifications yet" />
        ) : (
          <NotificationList items={data} onRead={(n) => !n.read && markRead([n.id])} />
        )}
      </Card>
    </>
  );
}
