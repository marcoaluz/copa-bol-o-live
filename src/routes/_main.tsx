import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth, isOnboarded } from "@/hooks/use-auth";
import { Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main")({
  component: AuthGate,
});

function AuthGate() {
  const { user, profile, loading, signOut } = useAuth();

  const { data: autorizado, isLoading: checking } = useQuery({
    queryKey: ["allowlist", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("email_esta_autorizado");
      if (error) throw error;
      return data as boolean;
    },
  });

  useEffect(() => {
    if (user && autorizado === false) {
      toast.error("Seu acesso foi revogado pelo organizador.");
      signOut();
    }
  }, [autorizado, user, signOut]);

  if (loading || (user && checking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Trophy className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (autorizado === false) return <Navigate to="/login" />;
  if (!isOnboarded(profile)) return <Navigate to="/onboarding" />;
  return <AppLayout />;
}