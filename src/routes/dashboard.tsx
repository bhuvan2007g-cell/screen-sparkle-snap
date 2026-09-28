import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Bell, Heart, PawPrint, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { PetCard } from "@/components/PetCard";
import { PetFormDialog } from "@/components/PetFormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSignedImages } from "@/hooks/use-signed-images";
import { canListPets, useAuth } from "@/lib/auth";

const searchSchema = z.object({
  tab: z.string().optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Your dashboard — PawMatch" },
      { name: "description", content: "Manage your pets, adoption applications, favourites and alerts." },
      { property: "og:title", content: "Your dashboard — PawMatch" },
      { property: "og:description", content: "Manage pets, applications, favourites and alerts." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const isOwner = canListPets(profile);
  const current = tab ?? "overview";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl">Hi {profile.full_name.split(" ")[0]}</h1>
            <p className="text-muted-foreground capitalize">{profile.role} dashboard</p>
          </div>
          {isOwner && (
            <PetFormDialog
              userId={user.id}
              trigger={
                <Button size="lg">
                  <Plus className="mr-2 size-4" /> Add pet
                </Button>
              }
              onSaved={() => void navigate({ to: "/dashboard", search: { tab: "pets" } })}
            />
          )}
        </div>

        <Tabs
          value={current}
          onValueChange={(v) => void navigate({ to: "/dashboard", search: { tab: v } })}
          className="mt-8"
        >
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {isOwner && <TabsTrigger value="pets">My pets</TabsTrigger>}
            <TabsTrigger value="applications">Applications</TabsTrigger>
            {!isOwner && <TabsTrigger value="favorites">Favourites</TabsTrigger>}
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Overview userId={user.id} isOwner={isOwner} />
          </TabsContent>
          {isOwner && (
            <TabsContent value="pets" className="mt-6">
              <MyPets userId={user.id} />
            </TabsContent>
          )}
          <TabsContent value="applications" className="mt-6">
            {isOwner ? <OwnerApplications userId={user.id} /> : <MyApplications userId={user.id} />}
          </TabsContent>
          <TabsContent value="favorites" className="mt-6">
            <Favorites userId={user.id} />
          </TabsContent>
          <TabsContent value="notifications" className="mt-6">
            <Notifications userId={user.id} />
          </TabsContent>
          <TabsContent value="profile" className="mt-6">
            <ProfileForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Overview({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["overview", userId, isOwner],
    queryFn: async () => {
      if (isOwner) {
        const [pets, apps] = await Promise.all([
          supabase.from("pets").select("id, status").eq("owner_id", userId),
          supabase.from("adoption_applications").select("id, status, pets!inner(owner_id)").eq("pets.owner_id", userId),
        ]);
        const list = pets.data ?? [];
        return {
          total: list.length,
          available: list.filter((p) => p.status === "available").length,
          adopted: list.filter((p) => p.status === "adopted").length,
          pending: (apps.data ?? []).filter((a) => a.status === "pending" || a.status === "under_review").length,
        };
      }
      const [apps, favs] = await Promise.all([
        supabase.from("adoption_applications").select("id, status").eq("adopter_id", userId),
        supabase.from("favorites").select("id", { count: "exact", head: true }),
      ]);
      const list = apps.data ?? [];
      return {
        total: list.length,
        available: list.filter((a) => a.status === "approved").length,
        adopted: favs.count ?? 0,
        pending: list.filter((a) => a.status === "pending" || a.status === "under_review").length,
      };
    },
  });

  if (isLoading || !data) return <Skeleton className="h-28" />;

  const labels = isOwner
    ? ["Total pets", "Available", "Adopted", "Pending applications"]
    : ["Applications", "Approved", "Favourites", "Awaiting decision"];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={labels[0]!} value={data.total} />
      <StatCard label={labels[1]!} value={data.available} />
      <StatCard label={labels[2]!} value={data.adopted} />
      <StatCard label={labels[3]!} value={data.pending} />
    </div>
  );
}

function MyPets({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: pets, isLoading } = useQuery({
    queryKey: ["my-pets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, pet_images(image_url, is_primary)")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const urls = useSignedImages(
    (pets ?? []).map((p) => (p.pet_images.find((i) => i.is_primary) ?? p.pet_images[0])?.image_url),
  );

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["my-pets"] });

  async function remove(id: string, name: string) {
    if (!confirm(`Delete the listing for ${name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("pets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
    refresh();
  }

  if (isLoading) return <Skeleton className="h-64" />;
  if (!pets?.length)
    return (
      <EmptyState
        title="No pets listed yet"
        description="Add your first pet and it becomes searchable immediately."
      />
    );

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {pets.map((pet) => {
        const path = (pet.pet_images.find((i) => i.is_primary) ?? pet.pet_images[0])?.image_url;
        return (
          <div key={pet.id} className="space-y-2">
            <PetCard pet={pet} imageUrl={path ? urls[path] : undefined} />
            <div className="flex gap-2">
              <PetFormDialog
                userId={userId}
                pet={pet}
                trigger={
                  <Button variant="outline" size="sm" className="flex-1">
                    Edit
                  </Button>
                }
                onSaved={refresh}
              />
              {pet.status !== "adopted" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const { error } = await supabase.from("pets").update({ status: "adopted" }).eq("id", pet.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Marked as adopted");
                    refresh();
                  }}
                >
                  Mark adopted
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void remove(pet.id, pet.name)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OwnerApplications({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["owner-applications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adoption_applications")
        .select("*, pets!inner(id, name, owner_id, status), profiles!adoption_applications_adopter_id_fkey(full_name, city, email)")
        .eq("pets.owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("owner-apps")
      .on("postgres_changes", { event: "*", schema: "public", table: "adoption_applications" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["owner-applications"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  async function decide(id: string, status: "approved" | "rejected" | "under_review") {
    const { error } = await supabase.from("adoption_applications").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Application ${status.replace("_", " ")}`);
    void queryClient.invalidateQueries();
  }

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length)
    return (
      <EmptyState
        title="No applications yet"
        description="When someone applies for one of your pets, it lands here instantly."
      />
    );

  return (
    <div className="space-y-4">
      {data.map((app) => (
        <div key={app.id} className="surface-card space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {app.profiles?.full_name} · applying for{" "}
                <Link to="/pets/$petId" params={{ petId: app.pet_id }} className="text-primary hover:underline">
                  {app.pets?.name}
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                {[app.profiles?.city, app.phone, app.housing_type].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Applied {new Date(app.created_at).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={app.status} />
          </div>
          <p className="text-sm whitespace-pre-line">{app.message}</p>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Other pets: {app.has_other_pets ? "Yes" : "No"}</p>
            <p>Experience: {app.experience?.trim() || "Not provided"}</p>
          </div>
          {(app.status === "pending" || app.status === "under_review") && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void decide(app.id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => void decide(app.id, "rejected")}>
                Reject
              </Button>
              {app.status === "pending" && (
                <Button size="sm" variant="ghost" onClick={() => void decide(app.id, "under_review")}>
                  Mark under review
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MyApplications({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-applications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adoption_applications")
        .select("*, pets(id, name, city, status, owner_id, profiles!pets_owner_id_fkey(full_name))")
        .eq("adopter_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("adopter-apps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "adoption_applications", filter: `adopter_id=eq.${userId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["my-applications"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length)
    return (
      <EmptyState
        title="No applications yet"
        description="Find a pet you love and send your first adoption application."
        action={
          <Button asChild className="mt-2">
            <Link to="/explore">Explore pets</Link>
          </Button>
        }
      />
    );

  return (
    <div className="space-y-4">
      {data.map((app) => (
        <div key={app.id} className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <Link
              to="/pets/$petId"
              params={{ petId: app.pet_id }}
              className="font-semibold hover:text-primary"
            >
              {app.pets?.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              Listed by {app.pets?.profiles?.full_name} · {app.pets?.city}
            </p>
            <p className="text-xs text-muted-foreground">
              Applied {new Date(app.created_at).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>
      ))}
    </div>
  );
}

function Favorites({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["favorite-pets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("id, pet_id, pets(*, pet_images(image_url, is_primary))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const urls = useSignedImages(
    (data ?? []).map(
      (f) => (f.pets?.pet_images.find((i) => i.is_primary) ?? f.pets?.pet_images[0])?.image_url,
    ),
  );

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length)
    return (
      <EmptyState
        title="No favourites yet"
        description="Tap the heart on any pet to keep track of them here."
        action={
          <Button asChild className="mt-2">
            <Link to="/explore">
              <Heart className="mr-2 size-4" /> Browse pets
            </Link>
          </Button>
        }
      />
    );

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((fav) =>
        fav.pets ? (
          <PetCard
            key={fav.id}
            pet={fav.pets}
            imageUrl={
              (fav.pets.pet_images.find((i) => i.is_primary) ?? fav.pets.pet_images[0])?.image_url
                ? urls[
                    (fav.pets.pet_images.find((i) => i.is_primary) ?? fav.pets.pet_images[0])!
                      .image_url
                  ]
                : undefined
            }
            isFavorite
            onToggleFavorite={async () => {
              await supabase.from("favorites").delete().eq("id", fav.id);
              void queryClient.invalidateQueries({ queryKey: ["favorite-pets"] });
            }}
          />
        ) : null,
      )}
    </div>
  );
}

function Notifications({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  if (isLoading) return <Skeleton className="h-48" />;
  if (!data?.length)
    return <EmptyState title="Nothing new" description="Updates about your pets and applications appear here." />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        >
          Mark all as read
        </Button>
      </div>
      {data.map((n) => (
        <button
          key={n.id}
          className={`surface-card flex w-full items-start gap-3 p-4 text-left ${n.read ? "opacity-70" : ""}`}
          onClick={async () => {
            if (n.read) return;
            await supabase.from("notifications").update({ read: true }).eq("id", n.id);
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        >
          <Bell className={`mt-0.5 size-4 ${n.read ? "text-muted-foreground" : "text-accent"}`} />
          <div>
            <p className="font-medium">{n.title}</p>
            <p className="text-sm text-muted-foreground">{n.message}</p>
            <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function ProfileForm() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    city: profile?.city ?? "",
  });

  const { data: organization, refetch } = useQuery({
    queryKey: ["my-organization", profile?.id],
    enabled: profile?.role === "organization",
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("profile_id", profile!.id)
        .maybeSingle();
      return data;
    },
  });

  const [org, setOrg] = useState({
    organization_name: "",
    description: "",
    contact_email: "",
    contact_phone: "",
    website: "",
  });

  useEffect(() => {
    if (organization) {
      setOrg({
        organization_name: organization.organization_name ?? "",
        description: organization.description ?? "",
        contact_email: organization.contact_email ?? "",
        contact_phone: organization.contact_phone ?? "",
        website: organization.website ?? "",
      });
    }
  }, [organization]);

  async function save() {
    if (!profile) return;
    if (form.full_name.trim().length < 2) { toast.error("Enter your full name"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
      })
      .eq("id", profile.id);

    if (!error && profile.role === "organization") {
      if (org.organization_name.trim().length < 2) {
        setSaving(false);
        { toast.error("Organization name is required"); return; }
      }
      const payload = {
        profile_id: profile.id,
        organization_name: org.organization_name.trim(),
        description: org.description.trim() || null,
        contact_email: org.contact_email.trim() || null,
        contact_phone: org.contact_phone.trim() || null,
        website: org.website.trim() || null,
      };
      const orgResult = organization
        ? await supabase.from("organizations").update(payload).eq("id", organization.id)
        : await supabase.from("organizations").insert(payload);
      if (orgResult.error) {
        setSaving(false);
        { toast.error(orgResult.error.message); return; }
      }
      void refetch();
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success("Profile updated");
  }

  return (
    <div className="surface-card max-w-2xl space-y-4 p-6">
      <div className="space-y-2">
        <Label>Full name</Label>
        <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={profile?.email ?? ""} disabled />
      </div>

      {profile?.role === "organization" && (
        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <PawPrint className="size-4" /> Organization details
          </h3>
          <div className="space-y-2">
            <Label>Organization name</Label>
            <Input
              value={org.organization_name}
              onChange={(e) => setOrg((o) => ({ ...o, organization_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={org.description} onChange={(e) => setOrg((o) => ({ ...o, description: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Contact email</Label>
              <Input
                value={org.contact_email}
                onChange={(e) => setOrg((o) => ({ ...o, contact_email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact phone</Label>
              <Input
                value={org.contact_phone}
                onChange={(e) => setOrg((o) => ({ ...o, contact_phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={org.website} onChange={(e) => setOrg((o) => ({ ...o, website: e.target.value }))} />
          </div>
          {organization && (
            <p className="text-sm text-muted-foreground capitalize">
              Verification status: {organization.verification_status}
            </p>
          )}
        </div>
      )}

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
