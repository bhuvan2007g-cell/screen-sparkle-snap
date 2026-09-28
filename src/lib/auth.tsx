import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AccountType = "adopter" | "owner" | "organization";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  role: AccountType;
  suspended: boolean;
  created_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function ensureProfile(user: User): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) return data as Profile;

  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      full_name: meta['full_name'] ?? user.email?.split("@")[0] ?? "New member",
      email: user.email ?? "",
      phone: meta['phone'] ?? null,
      city: meta['city'] ?? null,
      role: (meta['role'] as AccountType) ?? "adopter",
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Could not create profile", error);
    return null;
  }
  return created as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [p, roles] = await Promise.all([
      ensureProfile(user),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    setProfile(p);
    setIsAdmin((roles.data ?? []).some((r) => r.role === "admin"));
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setTimeout(() => {
        void loadUserData(newSession?.user ?? null).finally(() => setLoading(false));
      }, 0);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadUserData(data.session?.user ?? null).finally(() => setLoading(false));
    });

    return () => sub.subscription.unsubscribe();
  }, [loadUserData]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    await loadUserData(data.user ?? null);
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin,
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function canListPets(profile: Profile | null) {
  return !!profile && !profile.suspended && (profile.role === "owner" || profile.role === "organization");
}
