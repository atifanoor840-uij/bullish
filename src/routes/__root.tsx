import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
      { title: "Bullish 4ex — Forex Prop Trading & Skill Evaluation Platform" },
      {
        name: "description",
        content: "Empowering disciplined forex traders globally with simulated evaluation accounts up to $200K. Choose 1-Step, 2-Step, Instant Funding, or $9 Flex challenge. Keep up to 90% profits with bi-weekly payouts.",
      },
      {
        name: "keywords",
        content: "prop firm, forex prop firm, funded trader, forex trading challenge, simulated trading evaluation, funded account, prop trading, instant funding, 1 step evaluation, 2 step evaluation, flex challenge, forex funding, metatrader 5 prop firm",
      },
      { name: "author", content: "Bullish 4ex" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "theme-color", content: "#0a0a0c" },
      { property: "og:site_name", content: "Bullish 4ex" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Bullish 4ex — Trade Our Simulated Capital, Keep Up to 90%" },
      {
        property: "og:description",
        content: "Educational trader skill development and simulated prop firm. Get funded up to $200K with transparent rules and bi-weekly payouts.",
      },
      { property: "og:url", content: "https://bullish4ex.com" },
      { property: "og:image", content: "https://bullish4ex.com/hero-candle.webp" },
      { property: "og:image:alt", content: "Bullish 4ex Trading Platform" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@bullish4ex" },
      { name: "twitter:title", content: "Bullish 4ex — Forex Prop Firm & Trader Skill Evaluation" },
      {
        name: "twitter:description",
        content: "Simulated forex prop evaluations up to $200K. Fast payouts, refundable fee, and up to 90% profit splits.",
      },
      { name: "twitter:image", content: "https://bullish4ex.com/hero-candle.webp" },
    ],
    links: [
      { rel: "canonical", href: "https://bullish4ex.com" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@500;600;700;800&display=swap" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        {/* Structured Data (Schema.org JSON-LD) for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://bullish4ex.com/#organization",
                  "name": "Bullish 4ex",
                  "url": "https://bullish4ex.com",
                  "logo": "https://bullish4ex.com/logo-mark.png",
                  "description": "Educational platform and trader skill evaluation prop firm offering simulated trading evaluations up to $200,000.",
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "contactType": "Customer Support",
                    "url": "https://bullish4ex.com/contact"
                  }
                },
                {
                  "@type": "WebSite",
                  "@id": "https://bullish4ex.com/#website",
                  "url": "https://bullish4ex.com",
                  "name": "Bullish 4ex",
                  "publisher": { "@id": "https://bullish4ex.com/#organization" }
                },
                {
                  "@type": "EducationalOrganization",
                  "name": "Bullish 4ex Trader Evaluation",
                  "url": "https://bullish4ex.com",
                  "description": "Simulated trading educational platform with structured 1-Step, 2-Step, Instant, and Flex evaluations."
                }
              ]
            }),
          }}
        />
        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1152513827733713');
fbq('track', 'PageView');`,
          }}
        />
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1152513827733713&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}
      </head>
      <body>
        {children}
        <Scripts />
        {/* Zen-try Live Chat Support */}
        <script
          src="https://zen-try.site/widget.js"
          data-workspace-id="ac25e179-9dc5-4bc8-b1d3-8b7648f86a68"
          defer
        />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
