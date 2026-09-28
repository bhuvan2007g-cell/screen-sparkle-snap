import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, LogOut, PawPrint, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnread(count ?? 0);
    };
    void load();

    const channel = supabase
      .channel("header-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <header className="glass-panel sticky top-0 z-50 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="hero-gradient flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <PawPrint className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">PawMatch</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" asChild>
            <Link to="/explore">Explore pets</Link>
          </Button>
          {user && (
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          )}
          {isAdmin && (
            <Button variant="ghost" asChild>
              <Link to="/admin">Admin</Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="icon" asChild className="relative">
                <Link to="/dashboard" search={{ tab: "notifications" }} aria-label="Notifications">
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Account menu">
                    <UserIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium">{profile?.full_name ?? "Member"}</p>
                    <p className="truncate text-xs text-muted-foreground capitalize">
                      {profile?.role ?? "adopter"}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void navigate({ to: "/dashboard" })}>
                    Dashboard
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => void navigate({ to: "/admin" })}>
                      <Shield className="mr-2 size-4" /> Admin console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      void navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth" search={{ mode: "login" }}>
                  Log in
                </Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ mode: "register" }}>
                  Get started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
