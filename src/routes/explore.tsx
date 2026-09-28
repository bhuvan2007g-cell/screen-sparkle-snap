import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { PetCard } from "@/components/PetCard";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSignedImages } from "@/hooks/use-signed-images";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore pets for adoption — PawMatch" },
      {
        name: "description",
        content: "Search and filter adoptable dogs, cats and more by species, city, age and size.",
      },
      { property: "og:title", content: "Explore pets for adoption — PawMatch" },
      { property: "og:description", content: "Search adoptable pets by species, city, age and size." },
    ],
  }),
  component: Explore,
});

const ANY = "any";

function Explore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState(ANY);
  const [gender, setGender] = useState(ANY);
  const [size, setSize] = useState(ANY);
  const [status, setStatus] = useState("available");
  const [ageBand, setAgeBand] = useState(ANY);
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const { data: pets, isLoading } = useQuery({
    queryKey: ["pets", { species, gender, size, status, sort }],
    queryFn: async () => {
      let q = supabase.from("pets").select("*, pet_images(image_url, is_primary)").neq("status", "removed");
      if (species !== ANY) q = q.eq("species", species);
      if (gender !== ANY) q = q.eq("gender", gender);
      if (size !== ANY) q = q.eq("size", size);
      if (status !== ANY) q = q.eq("status", status as "available" | "pending" | "adopted");
      q = q.order("created_at", { ascending: sort === "oldest" });
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: favorites } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("pet_id");
      if (error) throw error;
      return data.map((f) => f.pet_id);
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (pets ?? []).filter((p) => {
      const matchesTerm =
        !term ||
        [p.name, p.breed, p.city].some((v) => (v ?? "").toLowerCase().includes(term));
      const age = p.age ?? null;
      const matchesAge =
        ageBand === ANY ||
        (age != null &&
          ((ageBand === "baby" && age < 1) ||
            (ageBand === "young" && age >= 1 && age < 3) ||
            (ageBand === "adult" && age >= 3 && age < 8) ||
            (ageBand === "senior" && age >= 8)));
      return matchesTerm && matchesAge;
    });
  }, [pets, search, ageBand]);

  const urls = useSignedImages(
    filtered.map((p) => (p.pet_images.find((i) => i.is_primary) ?? p.pet_images[0])?.image_url),
  );

  async function toggleFavorite(petId: string) {
    if (!user) {
      toast.error("Sign in to save favourites");
      return;
    }
    const isFav = favorites?.includes(petId);
    if (isFav) {
      const { error } = await supabase.from("favorites").delete().eq("pet_id", petId).eq("user_id", user.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("favorites").insert({ pet_id: petId, user_id: user.id });
      if (error) { toast.error(error.message); return; }
    }
    void queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl sm:text-4xl">Explore pets</h1>
        <p className="mt-1 text-muted-foreground">
          {isLoading ? "Loading pets…" : `${filtered.length} pets match your search`}
        </p>

        <div className="surface-card mt-6 space-y-4 p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, breed or city"
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters((s) => !s)}>
              <SlidersHorizontal className="size-4" />
              <span className="ml-2 hidden sm:inline">Filters</span>
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <FilterSelect label="Species" value={species} onChange={setSpecies} options={["Dog", "Cat", "Rabbit", "Bird", "Other"]} />
              <FilterSelect label="Gender" value={gender} onChange={setGender} options={["Male", "Female"]} />
              <FilterSelect label="Size" value={size} onChange={setSize} options={["Small", "Medium", "Large"]} />
              <FilterSelect
                label="Age"
                value={ageBand}
                onChange={setAgeBand}
                options={[
                  { value: "baby", label: "Under 1 yr" },
                  { value: "young", label: "1–3 yrs" },
                  { value: "adult", label: "3–8 yrs" },
                  { value: "senior", label: "8+ yrs" },
                ]}
              />
              <FilterSelect
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "available", label: "Available" },
                  { value: "pending", label: "Pending" },
                  { value: "adopted", label: "Adopted" },
                ]}
              />
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Sort</span>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No pets match those filters"
              description="Try widening your search — clear a filter or search a different city."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((pet) => {
                const path = (pet.pet_images.find((i) => i.is_primary) ?? pet.pet_images[0])?.image_url;
                return (
                  <PetCard
                    key={pet.id}
                    pet={pet}
                    imageUrl={path ? urls[path] : undefined}
                    isFavorite={favorites?.includes(pet.id)}
                    onToggleFavorite={() => void toggleFavorite(pet.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any</SelectItem>
          {options.map((o) => {
            const val = typeof o === "string" ? o : o.value;
            const lbl = typeof o === "string" ? o : o.label;
            return (
              <SelectItem key={val} value={val}>
                {lbl}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
