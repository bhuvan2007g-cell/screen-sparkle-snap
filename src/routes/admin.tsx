import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — PawMatch" },
      { name: "description", content: "Platform statistics, user management, listings and reports." },
      { property: "og:title", content: "Admin console — PawMatch" },
      { property: "og:description", content: "Platform statistics, users, listings and reports." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl">Admins only</h1>
          <p className="mt-2 text-muted-foreground">
            This area is restricted. Your account doesn't have the admin role.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl sm:text-4xl">Admin console</h1>
        <p className="text-muted-foreground">Platform health, people, listings and reports.</p>

        <Stats />

        <Tabs defaultValue="users" className="mt-8">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="pets">Pets</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6">
            <Users />
          </TabsContent>
          <TabsContent value="pets" className="mt-6">
            <Pets />
          </TabsContent>
          <TabsContent value="applications" className="mt-6">
            <Applications />
          </TabsContent>
          <TabsContent value="reports" className="mt-6">
            <Reports />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Stats() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profiles, pets, apps] = await Promise.all([
        supabase.from("profiles").select("id, role"),
        supabase.from("pets").select("id, status"),
        supabase.from("adoption_applications").select("id, status"),
      ]);
      const p = profiles.data ?? [];
      const pl = pets.data ?? [];
      const al = apps.data ?? [];
      return {
        users: p.length,
        adopters: p.filter((x) => x.role === "adopter").length,
        owners: p.filter((x) => x.role === "owner").length,
        organizations: p.filter((x) => x.role === "organization").length,
        pets: pl.length,
        available: pl.filter((x) => x.status === "available").length,
        adopted: pl.filter((x) => x.status === "adopted").length,
        applications: al.length,
        pending: al.filter((x) => x.status === "pending" || x.status === "under_review").length,
      };
    },
  });

  if (isLoading || !data) return <Skeleton className="mt-6 h-28" />;

  const cards: [string, number][] = [
    ["Total users", data.users],
    ["Adopters", data.adopters],
    ["Owners", data.owners],
    ["Organizations", data.organizations],
    ["Total pets", data.pets],
    ["Available", data.available],
    ["Adopted", data.adopted],
    ["Applications", data.applications],
    ["Pending applications", data.pending],
  ];

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(([label, value]) => (
        <div key={label} className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Users() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function toggleSuspend(id: string, suspended: boolean) {
    const { error } = await supabase.from("profiles").update({ suspended: !suspended }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(suspended ? "User reinstated" : "User suspended");
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length) return <EmptyState title="No users" description="No accounts have been created yet." />;

  return (
    <div className="space-y-3">
      {data.map((u) => (
        <div key={u.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">
              {u.full_name} {u.suspended && <span className="text-destructive">(suspended)</span>}
            </p>
            <p className="text-sm text-muted-foreground">
              {[u.email, u.city, u.role].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button size="sm" variant={u.suspended ? "secondary" : "outline"} onClick={() => void toggleSuspend(u.id, u.suspended)}>
            {u.suspended ? "Reinstate" : "Suspend"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function Pets() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-pets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, profiles!pets_owner_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function removeListing(id: string) {
    const { error } = await supabase.from("pets").update({ status: "removed" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing removed from search");
    void queryClient.invalidateQueries({ queryKey: ["admin-pets"] });
  }

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length) return <EmptyState title="No pets" description="No listings have been created yet." />;

  return (
    <div className="space-y-3">
      {data.map((p) => (
        <div key={p.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <Link to="/pets/$petId" params={{ petId: p.id }} className="font-medium hover:text-primary">
              {p.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              {[p.species, p.city, `by ${p.profiles?.full_name}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status} />
            {p.status !== "removed" && (
              <Button size="sm" variant="outline" onClick={() => void removeListing(p.id)}>
                Remove
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Applications() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adoption_applications")
        .select("*, pets(name), profiles!adoption_applications_adopter_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length) return <EmptyState title="No applications" description="Nothing has been submitted yet." />;

  return (
    <div className="space-y-3">
      {data.map((a) => (
        <div key={a.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">
              {a.profiles?.full_name} → {a.pets?.name}
            </p>
            <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
          </div>
          <StatusBadge status={a.status} />
        </div>
      ))}
    </div>
  );
}

function Reports() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, pets(name), profiles!reports_reporter_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function setStatus(id: string, status: "reviewing" | "resolved" | "dismissed") {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length) return <EmptyState title="No reports" description="Nothing has been reported." />;

  return (
    <div className="space-y-3">
      {data.map((r) => (
        <div key={r.id} className="surface-card space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              {r.reason} — {r.pets?.name ?? "deleted listing"}
            </p>
            <StatusBadge status={r.status === "open" ? "pending" : r.status === "resolved" ? "approved" : "removed"} />
          </div>
          <p className="text-sm text-muted-foreground">{r.description}</p>
          <p className="text-xs text-muted-foreground">Reported by {r.profiles?.full_name}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void setStatus(r.id, "reviewing")}>
              Reviewing
            </Button>
            <Button size="sm" onClick={() => void setStatus(r.id, "resolved")}>
              Resolve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void setStatus(r.id, "dismissed")}>
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
