import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Trophy, Users, BarChart3, User, Shield, Wallet, ChevronDown, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/NotificationBell";

const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/chaveamento", label: "Chaveamento", icon: Trophy },
  { to: "/grupos", label: "Grupos", icon: Users },
  { to: "/ranking", label: "Ranking", icon: BarChart3 },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

function Logo() {
  return (
    <Link to="/home" className="flex items-center gap-2 group">
      <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow transition-transform group-hover:scale-105">
        <Trophy className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-xl text-foreground tracking-wider">COPA BOLÃO</span>
        <span className="font-display text-sm text-gold tracking-[0.3em]">2026</span>
      </div>
    </Link>
  );
}

function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const nome = profile?.nome_completo || user?.user_metadata?.full_name || "Usuário";
  const email = user?.email ?? "";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = nome
    .split(" ")
    .map((n: string) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-surface-elevated transition-colors">
        <Avatar className="w-8 h-8 border-2 border-primary">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={nome} />}
          <AvatarFallback className="bg-surface-elevated text-foreground text-xs font-semibold">{initials || "U"}</AvatarFallback>
        </Avatar>
        <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card border-border">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold truncate">{nome}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
            {profile?.apelido && (
              <p className="text-xs text-gold">@{profile.apelido}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil" className="cursor-pointer"><User className="w-4 h-4 mr-2" /> Meu perfil</Link>
        </DropdownMenuItem>
        {profile?.is_admin && (
          <DropdownMenuItem asChild>
            <Link to="/admin" className="cursor-pointer"><Settings className="w-4 h-4 mr-2" /> Admin</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
          className="cursor-pointer text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header() {
  const { profile } = useAuth();
  const saldo = ((profile?.saldo_centavos ?? 0) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border">
            <Wallet className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold tabular-nums">R$ {saldo}</span>
          </div>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-surface/40 px-3 py-6 gap-1 sticky top-16 h-[calc(100vh-4rem)]">
      {navItems.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Link>
        );
      })}
      <Link
        to="/admin"
        className={`mt-auto flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          pathname === "/admin"
            ? "bg-gold/15 text-gold"
            : "text-muted-foreground hover:text-gold hover:bg-surface-elevated"
        }`}
      >
        <Shield className="w-5 h-5" />
        Admin
      </Link>
    </aside>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t border-border bg-background/95 backdrop-blur-lg">
      <div className="grid grid-cols-5 h-full">
        {navItems.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex flex-1 w-full">
        <Sidebar />
        <main className="flex-1 pb-20 lg:pb-8 px-4 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}