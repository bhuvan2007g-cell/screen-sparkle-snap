import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { MAX_IMAGES, uploadPetImage, validateImageFile } from "@/lib/pet-images";

export interface EditablePet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  age: number | null;
  gender: string | null;
  size: string | null;
  city: string | null;
  description: string | null;
  health_information: string | null;
  vaccination_status: string | null;
  neutered: boolean;
  adoption_requirements: string | null;
  status: string;
}

const petSchema = z.object({
  name: z.string().trim().min(2, "Pet name is required").max(60),
  species: z.string().min(1, "Choose a species"),
  breed: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2, "City is required").max(80),
  description: z.string().trim().min(20, "Add a short description (20+ characters)").max(2000),
});

const empty = {
  name: "",
  species: "",
  breed: "",
  age: "",
  gender: "",
  size: "",
  city: "",
  description: "",
  health_information: "",
  vaccination_status: "",
  neutered: false,
  adoption_requirements: "",
};

export function PetFormDialog({
  userId,
  pet,
  trigger,
  onSaved,
}: {
  userId: string;
  pet?: EditablePet;
  trigger: ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState(
    pet
      ? {
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? "",
          age: pet.age != null ? String(pet.age) : "",
          gender: pet.gender ?? "",
          size: pet.size ?? "",
          city: pet.city ?? "",
          description: pet.description ?? "",
          health_information: pet.health_information ?? "",
          vaccination_status: pet.vaccination_status ?? "",
          neutered: pet.neutered,
          adoption_requirements: pet.adoption_requirements ?? "",
        }
      : empty,
  );

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const errors = incoming.map(validateImageFile).filter(Boolean) as string[];
    if (errors.length) {
      toast.error(errors[0]!);
      return;
    }
    const next = [...files, ...incoming].slice(0, MAX_IMAGES);
    if (files.length + incoming.length > MAX_IMAGES) {
      toast.error(`You can upload up to ${MAX_IMAGES} photos.`);
    }
    setFiles(next);
  }

  async function save() {
    const parsed = petSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (!pet && files.length === 0) {
      toast.error("Add at least one photo of the pet.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        owner_id: userId,
        name: form.name.trim(),
        species: form.species,
        breed: form.breed.trim() || null,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        size: form.size || null,
        city: form.city.trim(),
        description: form.description.trim(),
        health_information: form.health_information.trim() || null,
        vaccination_status: form.vaccination_status || null,
        neutered: form.neutered,
        adoption_requirements: form.adoption_requirements.trim() || null,
      };

      let petId = pet?.id;
      if (pet) {
        const { error } = await supabase.from("pets").update(payload).eq("id", pet.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("pets").insert(payload).select("id").single();
        if (error) throw error;
        petId = data.id;
      }

      if (files.length && petId) {
        const { count } = await supabase
          .from("pet_images")
          .select("id", { count: "exact", head: true })
          .eq("pet_id", petId);
        const existing = count ?? 0;
        const paths: string[] = [];
        for (const file of files) {
          paths.push(await uploadPetImage(userId, file));
        }
        const { error } = await supabase.from("pet_images").insert(
          paths.map((image_url, i) => ({
            pet_id: petId!,
            image_url,
            is_primary: existing === 0 && i === 0,
          })),
        );
        if (error) throw error;
      }

      toast.success(pet ? "Pet updated" : "Pet published — it's live in search now");
      setFiles([]);
      if (!pet) setForm(empty);
      setOpen(false);
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{pet ? `Edit ${pet.name}` : "Add a pet for adoption"}</DialogTitle>
          <DialogDescription>
            Complete, honest listings get adopted faster. Photos help most.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pet name">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Species">
            <Select value={form.species} onValueChange={(v) => setForm((f) => ({ ...f, species: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {["Dog", "Cat", "Rabbit", "Bird", "Other"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Breed">
            <Input value={form.breed} onChange={(e) => setForm((f) => ({ ...f, breed: e.target.value }))} />
          </Field>
          <Field label="Age (years)">
            <Input
              type="number"
              min="0"
              max="40"
              step="0.5"
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
            />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Size">
            <Select value={form.size} onValueChange={(v) => setForm((f) => ({ ...f, size: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {["Small", "Medium", "Large"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="Vaccination status">
            <Select
              value={form.vaccination_status}
              onValueChange={(v) => setForm((f) => ({ ...f, vaccination_status: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fully vaccinated">Fully vaccinated</SelectItem>
                <SelectItem value="Partially vaccinated">Partially vaccinated</SelectItem>
                <SelectItem value="Not vaccinated">Not vaccinated</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea
                rows={4}
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Personality, energy level, how they are with kids or other animals…"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Health information">
              <Textarea
                rows={3}
                maxLength={1000}
                value={form.health_information}
                onChange={(e) => setForm((f) => ({ ...f, health_information: e.target.value }))}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Adoption requirements">
              <Textarea
                rows={3}
                maxLength={1000}
                value={form.adoption_requirements}
                onChange={(e) => setForm((f) => ({ ...f, adoption_requirements: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3 sm:col-span-2">
            <Label htmlFor="neutered">Neutered / spayed</Label>
            <Switch
              id="neutered"
              checked={form.neutered}
              onCheckedChange={(v) => setForm((f) => ({ ...f, neutered: v }))}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Photos {pet && <span className="text-muted-foreground">(adds to existing)</span>}</Label>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:bg-secondary">
              <ImagePlus className="size-4" />
              Choose images — JPG, PNG or WebP, max 5 MB each, up to {MAX_IMAGES}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="hidden"
                onChange={(e) => pickFiles(e.target.files)}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <span
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs"
                  >
                    {file.name}
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving} size="lg">
            {saving ? "Saving…" : pet ? "Save changes" : "Publish pet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
