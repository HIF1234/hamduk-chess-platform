import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getMyAdminRole } from "@/lib/admin.functions";

/** Visible only to staff. Display only — every admin action is checked server-side. */
export function StaffLink({ className = "" }: { className?: string }) {
  const { user, isGuest } = useAuth();
  const q = useQuery({
    queryKey: ["my-admin-role", user?.id],
    enabled: !!user && !isGuest,
    staleTime: 5 * 60_000,
    queryFn: () => getMyAdminRole(),
  });
  if (!q.data?.role) return null;
  return (
    <Link to="/admin" className={`inline-flex items-center gap-2 ${className}`}>
      <ShieldCheck className="h-4 w-4" /> Staff dashboard
    </Link>
  );
}
