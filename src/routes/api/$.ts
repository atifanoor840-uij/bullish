import { createFileRoute } from "@tanstack/react-router";
import { handleApi } from "@/server/router";

/** Backend: every /api/* request is handled on the server by src/server/router.ts. */
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: ({ request }) => handleApi(request),
    },
  },
});
