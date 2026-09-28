import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  available: "bg-success/12 text-success border-success/25",
  pending: "bg-warning/15 text-warning-foreground border-warning/35",
  under_review: "bg-warning/15 text-warning-foreground border-warning/35",
  approved: "bg-success/12 text-success border-success/25",
  adopted: "bg-primary/10 text-primary border-primary/25",
  rejected: "bg-destructive/10 text-destructive border-destructive/25",
  removed: "bg-muted text-muted-foreground border-border",
};

const labels: Record<string, string> = {
  available: "Available",
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  adopted: "Adopted",
  rejected: "Rejected",
  removed: "Removed",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        styles[status] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
