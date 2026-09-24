import { Link, useNavigate } from "@tanstack/react-router";
import {
  Home,
  Puzzle,
  BarChart3,
  Trophy,
  Rss,
  MessageSquare,
  Swords,
  Sparkles,
  GraduationCap,
  Target,
  BookOpen,
  Crown,
  Video,
  Users,
  Activity,
  Code2,
  Eye,
  CalendarClock,
  LogOut,
  Castle,
  MessagesSquare,
  Tv,
  Newspaper,
  Gift,

} from "lucide-react";
import { useAuth, signOut } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// Desktop sidebar (md+). Mobile uses BottomNav.
export function Sidebar() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  const topItems = [
    { to: "/", label: "Home", Icon: Home },
    { to: "/puzzles", label: "Puzzles", Icon: Puzzle },
    { to: "/tactics", label: "Tactics", Icon: Target },
    { to: "/learn", label: "Learn", Icon: GraduationCap },
    { to: "/openings", label: "Openings", Icon: BookOpen },
    { to: "/endgame", label: "Endgame", Icon: Crown },
    { to: "/lessons", label: "Lessons", Icon: Video },
    { to: "/coaches", label: "Coaches", Icon: Users },
    { to: "/analysis", label: "Analysis", Icon: BarChart3 },
    { to: "/spectate", label: "Watch Live", Icon: Eye },
    { to: "/study", label: "Study Boards", Icon: BookOpen },
    { to: "/tournaments", label: "Tournaments", Icon: Trophy },
    { to: "/clubs", label: "Clubs", Icon: Castle },
    { to: "/forums", label: "Forums", Icon: MessagesSquare },
    { to: "/tv", label: "HamdukChess TV", Icon: Tv },
    { to: "/news", label: "News", Icon: Newspaper },
    { to: "/invite", label: "Invite friends", Icon: Gift },
    { to: "/leaderboard", label: "Leaderboard", Icon: Trophy },
    ...(user
      ? [
          { to: "/assistant", label: "AI Coach", Icon: Sparkles },
          { to: "/insights", label: "My Weaknesses", Icon: Activity },
          { to: "/correspondence", label: "Correspondence", Icon: CalendarClock },
          { to: "/feed", label: "Feed", Icon: Rss },
          { to: "/messages", label: "Messages", Icon: MessageSquare },
          { to: "/api-dashboard", label: "Developer API", Icon: Code2 },
        ]
      : []),
    { to: "/billing", label: "Upgrade", Icon: Sparkles },

  ] as const;

  return (
    <aside
      aria-label="Primary"
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-background/95 backdrop-blur md:flex"
    >
      <div className="flex items-center justify-between py-2 pl-5 pr-2">
        <Link to="/" className="py-2 font-serif text-xl font-bold tracking-tight text-foreground">
          Hamduk <span className="text-primary">Chess</span>
        </Link>
        {user && <NotificationBell />}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {topItems.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "bg-accent text-primary" }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        <div className="mt-auto flex flex-col gap-2 pb-3 pt-4">
          <Link
            to="/play"
            className="mx-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            activeProps={{ className: "ring-2 ring-primary/40" }}
          >
            <Swords className="h-4 w-4" />
            Play
          </Link>

          <div className="flex items-center justify-between gap-2 px-2">
            <ThemeToggle />
            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground hover:bg-secondary/80"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Sign in
              </Link>
            )}
          </div>
          {user && isGuest && (
            <span className="mx-2 rounded-full bg-accent/20 px-2 py-0.5 text-center text-[10px] font-semibold text-accent">
              Guest account
            </span>
          )}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 text-[11px] text-muted-foreground">
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
            <Link to="/support" className="hover:text-foreground">
              Help
            </Link>
            <Link to="/fair-play" className="hover:text-foreground">
              Fair play
            </Link>
            {user && (
              <Link to="/settings" className="hover:text-foreground">
                Settings
              </Link>
            )}
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </nav>
    </aside>
  );
}
