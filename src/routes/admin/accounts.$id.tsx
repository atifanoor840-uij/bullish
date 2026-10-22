import { createFileRoute } from "@tanstack/react-router";
import { AccountDetail } from "@/components/portal/AccountDetail";

export const Route = createFileRoute("/admin/accounts/$id")({ component: AdminAccountPage });

function AdminAccountPage() {
  const { id } = Route.useParams();
  return <AccountDetail accountId={id} admin backHref="/admin/accounts" />;
}
