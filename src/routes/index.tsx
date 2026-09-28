import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PetCard } from "@/components/PetCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSignedImages } from "@/hooks/use-signed-images";
import heroImage from "@/assets/hero-pets.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PawMatch — Adopt a pet, change two lives" },
      {
        name: "description",
        content:
          "Browse pets from trusted owners and rescue organizations, apply to adopt, and track every application in one place.",
      },
      { property: "og:title", content: "PawMatch — Adopt a pet, change two lives" },
      {
        property: "og:description",
        content: "Browse pets from trusted owners and rescues and apply to adopt in minutes.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: pets, isLoading } = useQuery({
    queryKey: ["featured-pets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, pet_images(image_url, is_primary)")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const paths = (pets ?? []).map(
    (p) => (p.pet_images.find((i) => i.is_primary) ?? p.pet_images[0])?.image_url,
  );
  const urls = useSignedImages(paths);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              <Sparkles className="size-3.5" /> Verified owners & rescue organizations
            </span>
            <h1 className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
              Adopt a pet.
              <br />
              <span className="text-gradient-warm">Change two lives.</span>
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              PawMatch connects people looking for a companion with owners and shelters who need to
              find loving homes — with real applications, real reviews and real updates.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/explore">
                  Explore pets <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth" search={{ mode: "register" }}>
                  List a pet for adoption
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="hero-gradient absolute -inset-4 rounded-4xl opacity-20 blur-2xl" />
            <img
              src={heroImage}
              alt="A golden retriever and a tabby cat sitting together"
              width={1600}
              height={1200}
              className="relative aspect-[4/3] w-full rounded-3xl object-cover shadow-[var(--shadow-lift)]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 sm:px-6 md:grid-cols-3">
        {[
          {
            icon: HeartHandshake,
            title: "Real adoption workflow",
            body: "Apply, get reviewed and receive a decision — every step stored and tracked.",
          },
          {
            icon: ShieldCheck,
            title: "Protected by design",
            body: "Role-based access means owners only see applications for their own pets.",
          },
          {
            icon: Sparkles,
            title: "Live updates",
            body: "Owners see new applications instantly; adopters get notified on decisions.",
          },
        ].map((f) => (
          <div key={f.title} className="surface-card p-6">
            <f.icon className="size-6 text-primary" />
            <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl">Recently listed</h2>
            <p className="text-sm text-muted-foreground">Pets waiting for a home right now.</p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/explore">
              See all <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : pets && pets.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((pet) => {
              const path = (pet.pet_images.find((i) => i.is_primary) ?? pet.pet_images[0])
                ?.image_url;
              return <PetCard key={pet.id} pet={pet} imageUrl={path ? urls[path] : undefined} />;
            })}
          </div>
        ) : (
          <div className="surface-card p-10 text-center">
            <p className="text-muted-foreground">
              No pets listed yet — be the first to add one and it will show up here instantly.
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        PawMatch — adopt responsibly.
      </footer>
    </div>
  );
}
