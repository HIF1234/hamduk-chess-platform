import { Link } from "@tanstack/react-router";
import { Swords, Puzzle, BarChart3, Rss, Bell, GraduationCap, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/components/notifications/useUnreadCount";

// Mobile-only bottom navigation. Hidden on >= md. Desktop uses Sidebar, which has its own
// sign-in/account footer -- this is the only persistent nav on mobile, so a logged-out
// visitor's last slot must be a way to sign in, not just another content page. Previously it
// was "Ranks" (leaderboard), which left no reachable sign-in control anywhere once a guest
// navigated off the homepage (its hero CTA was the only entry point).
export function BottomNav() {
  const { user } = useAuth();
  const unread = useUnreadCount();
  const items = [
    { to: "/play", label: "Play", Icon: Swords },
    { to: "/puzzles", label: "Puzzles", Icon: Puzzle },
    { to: "/analysis", label: "Analyze", Icon: BarChart3 },
    user
      ? { to: "/feed", label: "Feed", Icon: Rss }
      : { to: "/learn", label: "Learn", Icon: GraduationCap },
    user
      ? { to: "/notifications", label: "Alerts", Icon: Bell }
      : { to: "/login", label: "Sign in", Icon: LogIn },
  ] as const;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      {items.map(({ to, label, Icon }) => (
        <Link
          key={`${to}-${label}`}
          to={to}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-primary" }}
        >
          <span className="relative">
            <Icon className="h-5 w-5" />
            {to === "/notifications" && unread > 0 && (
              <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-destructive px-1 text-center text-[9px] font-bold leading-4 text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
