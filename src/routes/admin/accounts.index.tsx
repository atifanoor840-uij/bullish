import { createFileRoute, redirect } from "@tanstack/react-router";

// Accounts are managed inside the unified Orders page now.
export const Route = createFileRoute("/admin/accounts/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/orders" });
  },
});
