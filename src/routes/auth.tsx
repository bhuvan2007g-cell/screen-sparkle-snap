import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AccountType } from "@/lib/auth";

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in or join PawMatch" },
      {
        name: "description",
        content: "Create a PawMatch account as an adopter, pet owner or rescue organization.",
      },
      { property: "og:title", content: "Sign in or join PawMatch" },
      { property: "og:description", content: "Create your PawMatch account in under a minute." },
    ],
  }),
  component: AuthPage,
});

const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(100).optional(),
  role: z.enum(["adopter", "owner", "organization"]),
  organization_name: z.string().trim().max(120).optional(),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    city: "",
    role: "adopter" as AccountType,
    organization_name: "",
  });

  useEffect(() => {
    if (user) void navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    void navigate({ to: "/dashboard" });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    if (form.role === "organization" && form.organization_name.trim().length < 2) {
      toast.error("Please enter your organization name");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          role: form.role,
          organization_name: form.organization_name.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Account created — check your email to confirm it, then sign in.");
      void navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    toast.success("Account created!");
    void navigate({ to: "/dashboard" });
  }

  const isRegister = mode === "register";

  return (
    <div className="flex min-h-screen">
      <div className="hero-gradient hidden w-1/2 flex-col justify-between p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <PawPrint className="size-6" />
          <span className="font-display text-2xl font-semibold">PawMatch</span>
        </Link>
        <div className="space-y-4">
          <h2 className="text-4xl leading-tight text-primary-foreground">
            Every adoption starts with one good decision.
          </h2>
          <p className="max-w-md text-primary-foreground/80">
            Join thousands of adopters, owners and rescue organizations matching pets with the right
            homes.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">Adopt responsibly.</p>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl">{isRegister ? "Create your account" : "Welcome back"}</h1>
            <p className="text-sm text-muted-foreground">
              {isRegister
                ? "Tell us who you are so we can set up the right dashboard."
                : "Sign in to manage your pets and applications."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={isRegister ? handleRegister : handleLogin}>
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => set("full_name")(e.target.value)}
                  placeholder="Alex Morgan"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            {isRegister && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => set("phone")(e.target.value)}
                      placeholder="+1 555 0100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => set("city")(e.target.value)}
                      placeholder="Lisbon"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>I am joining as</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm((f) => ({ ...f, role: v as AccountType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adopter">Adopter — I want to adopt a pet</SelectItem>
                      <SelectItem value="owner">Pet owner — I want to rehome pets</SelectItem>
                      <SelectItem value="organization">Organization / shelter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.role === "organization" && (
                  <div className="space-y-2">
                    <Label htmlFor="organization_name">Organization name</Label>
                    <Input
                      id="organization_name"
                      value={form.organization_name}
                      onChange={(e) => set("organization_name")(e.target.value)}
                      placeholder="Happy Tails Rescue"
                    />
                  </div>
                )}
              </>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account?" : "New to PawMatch?"}{" "}
            <Link
              to="/auth"
              search={{ mode: isRegister ? "login" : "register" }}
              className="font-semibold text-primary hover:underline"
            >
              {isRegister ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
