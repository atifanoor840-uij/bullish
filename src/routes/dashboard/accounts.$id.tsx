import { createFileRoute } from "@tanstack/react-router";
import { AccountDetail } from "@/components/portal/AccountDetail";

export const Route = createFileRoute("/dashboard/accounts/$id")({ component: AccountPage });

function AccountPage() {
  const { id } = Route.useParams();
  return <AccountDetail accountId={id} />;
}
