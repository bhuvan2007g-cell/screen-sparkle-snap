import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Flag, Heart, MapPin, Pencil, Syringe } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSignedImages } from "@/hooks/use-signed-images";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pets/$petId")({
  head: () => ({
    meta: [
      { title: "Pet profile — PawMatch" },
      { name: "description", content: "Meet this pet, read their story and apply to adopt." },
      { property: "og:title", content: "Pet profile — PawMatch" },
      { property: "og:description", content: "Meet this pet and apply to adopt on PawMatch." },
    ],
  }),
  component: PetDetails,
});

const applicationSchema = z.object({
  message: z.string().trim().min(20, "Tell the owner a bit more (at least 20 characters)").max(1500),
  housing_type: z.string().min(1, "Select your housing type"),
  experience: z.string().trim().max(1000).optional(),
  phone: z.string().trim().min(6, "Enter a contact phone").max(30),
});

function PetDetails() {
  const { petId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeImage, setActiveImage] = useState(0);
  const [applyOpen, setApplyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState({
    message: "",
    housing_type: "",
    has_other_pets: false,
    experience: "",
    phone: "",
  });
  const [report, setReport] = useState({ reason: "", description: "" });

  useEffect(() => {
    if (profile?.phone && !application.phone) {
      setApplication((a) => ({ ...a, phone: profile.phone ?? "" }));
    }
  }, [profile, application.phone]);

  const { data: pet, isLoading } = useQuery({
    queryKey: ["pet", petId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, pet_images(id, image_url, is_primary), profiles!pets_owner_id_fkey(id, full_name, city, phone, role)")
        .eq("id", petId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: organization } = useQuery({
    queryKey: ["organization", pet?.owner_id],
    enabled: !!pet?.owner_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("profile_id", pet!.owner_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: myApplication } = useQuery({
    queryKey: ["my-application", petId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("adoption_applications")
        .select("*")
        .eq("pet_id", petId)
        .eq("adopter_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: isFavorite } = useQuery({
    queryKey: ["favorite", petId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("pet_id", petId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  const images = pet?.pet_images ?? [];
  const ordered = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const urls = useSignedImages(ordered.map((i) => i.image_url));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <h1 className="text-2xl">This pet is no longer listed</h1>
          <Button className="mt-6" asChild>
            <Link to="/explore">Back to explore</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === pet.owner_id;

  async function toggleFavorite() {
    if (!user) {
      toast.error("Sign in to save favourites");
      return;
    }
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("pet_id", petId).eq("user_id", user.id);
    } else {
      const { error } = await supabase.from("favorites").insert({ pet_id: petId, user_id: user.id });
      if (error) { toast.error(error.message); return; }
    }
    void queryClient.invalidateQueries({ queryKey: ["favorite", petId] });
    toast.success(isFavorite ? "Removed from favourites" : "Saved to favourites");
  }

  async function submitApplication() {
    if (!user) {
      void navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    const parsed = applicationSchema.safeParse(application);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("adoption_applications").insert({
      pet_id: petId,
      adopter_id: user.id,
      message: application.message.trim(),
      housing_type: application.housing_type,
      has_other_pets: application.has_other_pets,
      experience: application.experience.trim(),
      phone: application.phone.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "You already have an active application for this pet." : error.message,
      );
      return;
    }
    setApplyOpen(false);
    toast.success("Application sent! The owner has been notified.");
    void queryClient.invalidateQueries({ queryKey: ["my-application", petId] });
  }

  async function markAdopted() {
    const { error } = await supabase.from("pets").update({ status: "adopted" }).eq("id", petId);
    if (error) { toast.error(error.message); return; }
    toast.success(`${pet!.name} is now marked as adopted.`);
    void queryClient.invalidateQueries({ queryKey: ["pet", petId] });
  }

  async function submitReport() {
    if (!user) {
      toast.error("Sign in to report a listing");
      return;
    }
    if (report.reason.trim().length < 3) { toast.error("Please give a reason"); return; }
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      pet_id: petId,
      reason: report.reason.trim(),
      description: report.description.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setReportOpen(false);
    setReport({ reason: "", description: "" });
    toast.success("Thanks — our team will review this listing.");
  }

  const owner = pet.profiles;
  const facts = [
    ["Species", pet.species],
    ["Breed", pet.breed],
    ["Age", pet.age != null ? `${pet.age} years` : null],
    ["Gender", pet.gender],
    ["Size", pet.size],
    ["City", pet.city],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-secondary shadow-[var(--shadow-lift)]">
              {ordered[activeImage] && urls[ordered[activeImage]!.image_url] ? (
                <img
                  src={urls[ordered[activeImage]!.image_url]}
                  alt={pet.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  No photos uploaded
                </div>
              )}
            </div>
            {ordered.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {ordered.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImage(i)}
                    className={`size-20 shrink-0 overflow-hidden rounded-xl border-2 ${
                      i === activeImage ? "border-primary" : "border-transparent"
                    }`}
                  >
                    {urls[img.image_url] && (
                      <img src={urls[img.image_url]} alt="" className="size-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl">{pet.name}</h1>
                <StatusBadge status={pet.status} />
              </div>
              <p className="text-muted-foreground">
                {[pet.breed || pet.species, pet.gender, pet.size].filter(Boolean).join(" · ")}
              </p>
              {pet.city && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-4" /> {pet.city}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isOwner ? (
                <>
                  <Button asChild>
                    <Link to="/dashboard" search={{ tab: "pets" }}>
                      <Pencil className="mr-2 size-4" /> Edit pet
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/dashboard" search={{ tab: "applications" }}>
                      Manage applications
                    </Link>
                  </Button>
                  {pet.status !== "adopted" && (
                    <Button variant="secondary" onClick={() => void markAdopted()}>
                      <CheckCircle2 className="mr-2 size-4" /> Mark adopted
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => void toggleFavorite()}>
                    <Heart className={`mr-2 size-4 ${isFavorite ? "fill-accent text-accent" : ""}`} />
                    {isFavorite ? "Saved" : "Favourite"}
                  </Button>
                  {myApplication ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm">
                      Your application: <StatusBadge status={myApplication.status} />
                    </div>
                  ) : pet.status === "available" ? (
                    <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
                      <DialogTrigger asChild>
                        <Button size="lg">Apply for adoption</Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Apply to adopt {pet.name}</DialogTitle>
                          <DialogDescription>
                            The owner will review your details and respond with a decision.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="message">Why are you a good match?</Label>
                            <Textarea
                              id="message"
                              rows={4}
                              maxLength={1500}
                              value={application.message}
                              onChange={(e) =>
                                setApplication((a) => ({ ...a, message: e.target.value }))
                              }
                              placeholder="Tell the owner about your home and daily routine…"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Housing type</Label>
                            <Select
                              value={application.housing_type}
                              onValueChange={(v) =>
                                setApplication((a) => ({ ...a, housing_type: v }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Apartment">Apartment</SelectItem>
                                <SelectItem value="House with garden">House with garden</SelectItem>
                                <SelectItem value="House without garden">House without garden</SelectItem>
                                <SelectItem value="Farm / rural">Farm / rural</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                            <Label htmlFor="other-pets">I already have other pets</Label>
                            <Switch
                              id="other-pets"
                              checked={application.has_other_pets}
                              onCheckedChange={(v) =>
                                setApplication((a) => ({ ...a, has_other_pets: v }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="experience">Previous pet experience</Label>
                            <Textarea
                              id="experience"
                              rows={3}
                              maxLength={1000}
                              value={application.experience}
                              onChange={(e) =>
                                setApplication((a) => ({ ...a, experience: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Contact phone</Label>
                            <Input
                              id="phone"
                              value={application.phone}
                              onChange={(e) =>
                                setApplication((a) => ({ ...a, phone: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={() => void submitApplication()} disabled={submitting}>
                            {submitting ? "Sending…" : "Submit application"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Button size="lg" disabled>
                      Not available
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="surface-card grid grid-cols-2 gap-4 p-5">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-muted-foreground">Neutered / spayed</p>
                <p className="font-medium">{pet.neutered ? "Yes" : "No"}</p>
              </div>
              {pet.vaccination_status && (
                <div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Syringe className="size-3" /> Vaccination
                  </p>
                  <p className="font-medium">{pet.vaccination_status}</p>
                </div>
              )}
            </div>

            <div className="surface-card space-y-1 p-5">
              <p className="text-xs text-muted-foreground">Listed by</p>
              <p className="font-semibold">{organization?.organization_name ?? owner?.full_name}</p>
              {organization?.description && (
                <p className="text-sm text-muted-foreground">{organization.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {[organization?.contact_email, organization?.contact_phone, owner?.city]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {organization && (
                <p className="text-xs text-muted-foreground capitalize">
                  Verification: {organization.verification_status}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <Section title="About" body={pet.description} className="lg:col-span-2" />
          <Section title="Health information" body={pet.health_information} />
          <Section title="Adoption requirements" body={pet.adoption_requirements} className="lg:col-span-3" />
        </div>

        {!isOwner && (
          <div className="mt-8">
            <Dialog open={reportOpen} onOpenChange={setReportOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Flag className="mr-2 size-4" /> Report this listing
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report listing</DialogTitle>
                  <DialogDescription>Our moderation team reviews every report.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Reason"
                    value={report.reason}
                    onChange={(e) => setReport((r) => ({ ...r, reason: e.target.value }))}
                  />
                  <Textarea
                    placeholder="What's wrong with this listing?"
                    value={report.description}
                    onChange={(e) => setReport((r) => ({ ...r, description: e.target.value }))}
                  />
                </div>
                <DialogFooter>
                  <Button onClick={() => void submitReport()}>Send report</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  body,
  className,
}: {
  title: string;
  body: string | null;
  className?: string;
}) {
  return (
    <div className={`surface-card p-6 ${className ?? ""}`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
        {body?.trim() ? body : "Not provided."}
      </p>
    </div>
  );
}
