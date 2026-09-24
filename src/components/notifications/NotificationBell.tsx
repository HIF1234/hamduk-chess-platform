import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useUnreadCount } from "./useUnreadCount";

export function NotificationBell({ className = "" }: { className?: string }) {
  const unread = useUnreadCount();
  return (
    <Link
      to="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className={`relative inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground ${className}`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-[18px] text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
