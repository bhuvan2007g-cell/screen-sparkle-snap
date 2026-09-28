import { Link } from "@tanstack/react-router";
import { Heart, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

export interface PetCardPet {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  age: number | null;
  gender: string | null;
  city: string | null;
  status: string;
}

export function PetCard({
  pet,
  imageUrl,
  isFavorite,
  onToggleFavorite,
}: {
  pet: PetCardPet;
  imageUrl?: string | undefined;
  isFavorite?: boolean | undefined;
  onToggleFavorite?: (() => void) | undefined;
}) {
  return (
    <article className="surface-card lift-on-hover group overflow-hidden">
      <Link to="/pets/$petId" params={{ petId: pet.id }} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={pet.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              No photo yet
            </div>
          )}
          <div className="absolute left-3 top-3">
            <StatusBadge status={pet.status} className="backdrop-blur" />
          </div>
        </div>
      </Link>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link to="/pets/$petId" params={{ petId: pet.id }}>
              <h3 className="text-lg leading-tight font-semibold hover:text-primary">{pet.name}</h3>
            </Link>
            <p className="text-sm text-muted-foreground">
              {[pet.breed || pet.species, pet.gender, pet.age != null ? `${pet.age} yrs` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {onToggleFavorite && (
            <button
              type="button"
              aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
              onClick={onToggleFavorite}
              className="rounded-full border border-border p-2 transition-colors hover:bg-secondary"
            >
              <Heart className={cn("size-4", isFavorite && "fill-accent text-accent")} />
            </button>
          )}
        </div>
        {pet.city && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> {pet.city}
          </p>
        )}
      </div>
    </article>
  );
}
