import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlusCircle } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, ErrorNote, Loading, Modal, PageHeader, Pager, useApi, usePaged } from "@/components/portal/ui";
import { PayOrder } from "@/components/portal/Checkout";
import { propApi, type Order } from "@/lib/propApi";
import { fmtDate, money } from "@/lib/portal";

export const Route = createFileRoute("/dashboard/orders")({ component: Orders });

function Orders() {
  const { data, error, loading, reload } = useApi(async () => (await propApi.orders.list()).orders);
  const [paying, setPaying] = useState<Order | null>(null);
  const rows = [...(data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const { slice, ...pager } = usePaged(rows);

  // Deep link from the overview: /dashboard/orders?pay=<orderId>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("pay");
    const o = data?.find((x) => x.id === id && x.status === "Pending");
    if (o) setPaying(o);
  }, [data]);

  return (
    <>
      <PageHeader title="Orders" subtitle="Every challenge you have purchased and its payment status." actions={<Button variant="primary" href="/dashboard/new-challenge"><PlusCircle className="h-4 w-4" />New Challenge</Button>} />
      {error && <ErrorNote message={error} onRetry={reload} />}
      <Card>
        {loading && !data ? (
          <Loading label="Loading orders…" />
        ) : (
          <>
            <DataTable
              rows={slice}
              rowKey={(o) => o.id}
              mobileTitle={(o) => o.planName || o.planId}
              empty={<EmptyState title="No orders yet" body="Your purchases will show up here." action={<Button variant="primary" href="/dashboard/new-challenge">Start Challenge</Button>} />}
              columns={[
                { key: "id", label: "Order", render: (o) => <span className="font-mono text-xs">{o.id}</span> },
                { key: "plan", label: "Challenge", render: (o) => <span className="font-medium">{o.planName || o.planId}</span> },
                { key: "date", label: "Date", render: (o) => <span className="text-muted-foreground">{fmtDate(o.createdAt)}</span> },
                { key: "method", label: "Payment", render: (o) => <span className="text-muted-foreground">{o.paymentMethod}{o.couponUsed ? ` · ${o.couponUsed}` : ""}</span> },
                { key: "amount", label: "Amount", render: (o) => <span className="font-semibold tabular-nums">{money(o.amountPaid)}</span> },
                { key: "status", label: "Status", render: (o) => <Badge>{o.status}</Badge> },
                {
                  key: "act", label: "", className: "text-right",
                  render: (o) => (o.status === "Pending" ? <Button size="sm" variant="primary" onClick={() => setPaying(o)}>Complete payment</Button> : null),
                },
              ]}
            />
            <Pager {...pager} />
          </>
        )}
      </Card>

      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Pay order ${paying?.id ?? ""}`}>
        {paying && <PayOrder orderId={paying.id} amount={paying.amountPaid} paymentMethod={paying.paymentMethod} onDone={() => { setPaying(null); void reload(); }} />}
      </Modal>
    </>
  );
}
