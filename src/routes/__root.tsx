import { useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  useRouterState,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { initTheme } from "@/lib/theme";
import { setLocalPreferences } from "@/lib/preferences";
import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";
import { NotificationListener } from "@/components/notifications/NotificationListener";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hamduk Chess" },
      { name: "description", content: "Play, learn and compete in chess. Africa-first: Nigerian bots, puzzles, tournaments, clubs and coaching." },
      { name: "author", content: "Hamduk Chess Club" },
      { property: "og:title", content: "Hamduk Chess" },
      { property: "og:description", content: "Play, learn and compete in chess. Africa-first: Nigerian bots, puzzles, tournaments, clubs and coaching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Hamduk Chess" },
      { name: "twitter:description", content: "Play, learn and compete in chess. Africa-first: Nigerian bots, puzzles, tournaments, clubs and coaching." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
    scripts: [
      {
        children:
          "(function(){try{var t=localStorage.getItem('hamduk:theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthAwareShell />
    </QueryClientProvider>
  );
}

function AuthAwareShell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    initTheme();
    // Remember an invite code from ?ref=… until the visitor has a real account.
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z2-9]{8}$/.test(ref)) localStorage.setItem("hamduk:ref", ref.toUpperCase());
    } catch {
      /* storage unavailable */
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      router.invalidate();
      queryClient.invalidateQueries();
      // Pull the account's saved preferences so boards match on every device.
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void import("@/lib/preferences.functions")
          .then(({ getMySettings }) => getMySettings())
          .then((s) => setLocalPreferences(s.preferences))
          .catch(() => {});
        if (event === "SIGNED_IN") {
          void import("@/lib/achievements.functions")
            .then(({ checkMyAchievements }) => checkMyAchievements())
            .catch(() => {});
        }
      }
      // Link a new (non-guest) account to the friend whose invite link brought it here.
      // Includes USER_UPDATED so guests who upgrade to a real account are covered.
      if (session && !(session.user as { is_anonymous?: boolean }).is_anonymous) {
        let pendingRef: string | null = null;
        try {
          pendingRef = localStorage.getItem("hamduk:ref");
        } catch {
          /* storage unavailable */
        }
        if (pendingRef) {
          void import("@/lib/referrals.functions")
            .then(({ claimReferral }) => claimReferral({ data: { code: pendingRef! } }))
            .then(() => localStorage.removeItem("hamduk:ref"))
            .catch(() => {});
        }
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Embedded widgets render chrome-free inside third-party iframes.
  if (pathname.startsWith("/embed/")) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        <Outlet />
      </div>
      <BottomNav />
      <NotificationListener />
      <Toaster position="top-right" richColors closeButton theme="system" />
    </div>
  );
}
