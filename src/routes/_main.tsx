import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useAuth, isOnboarded } from "@/hooks/use-auth";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_main")({
  component: AuthGate,
});

function AuthGate() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Trophy className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (!isOnboarded(profile)) return <Navigate to="/onboarding" />;
  return <AppLayout />;
}