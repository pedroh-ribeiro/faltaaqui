import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingBasket, Plus, Users, LogOut, Crown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
});

type GroupRow = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  member_count: number;
  pending_count: number;
};

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string; plan: string } | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase.from("profiles").select("name, plan").eq("id", u.user.id).maybeSingle();
    setProfile(p);

    const { data: memberships } = await supabase
      .from("group_members").select("group_id").eq("user_id", u.user.id);
    const groupIds = (memberships ?? []).map((m) => m.group_id);
    if (groupIds.length === 0) { setGroups([]); setLoading(false); return; }

    const { data: gs } = await supabase
      .from("groups").select("id, name, owner_id, invite_code").in("id", groupIds);
    const { data: items } = await supabase
      .from("items").select("group_id, status").in("group_id", groupIds);
    const { data: members } = await supabase
      .from("group_members").select("group_id").in("group_id", groupIds);

    const rows: GroupRow[] = (gs ?? []).map((g) => ({
      ...g,
      member_count: (members ?? []).filter((m) => m.group_id === g.id).length,
      pending_count: (items ?? []).filter((i) => i.group_id === g.id && i.status === "pending").length,
    }));
    setGroups(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b">
        <div className="mx-auto max-w-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingBasket className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold leading-tight truncate">Olá, {profile?.name ?? "..."}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {profile?.plan === "premium" ? <><Crown className="h-3 w-3"/> Premium</> : "Plano gratuito"}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Meus grupos</h2>
          <Link to="/app/join" className="text-sm text-primary font-medium">Entrar por código</Link>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/app/group/$groupId"
                params={{ groupId: g.id }}
                className="block rounded-2xl border bg-card p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{g.member_count}</span>
                      <span>{g.pending_count} pendente{g.pending_count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <Link to="/app/group/new" className="block mt-4">
          <Button variant="outline" className="w-full h-12 rounded-xl border-dashed">
            <Plus className="h-4 w-4 mr-1" /> Criar novo grupo
          </Button>
        </Link>

        {profile?.plan !== "premium" && (
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent p-5 border border-primary/20">
            <div className="flex items-center gap-2 text-primary"><Crown className="h-4 w-4"/><span className="text-xs font-semibold uppercase tracking-wide">Premium em breve</span></div>
            <p className="mt-2 text-sm">Grupos ilimitados, mais membros e histórico completo. Em desenvolvimento.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent">
        <ShoppingBasket className="h-7 w-7 text-accent-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">Nenhum grupo ainda</h3>
      <p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro grupo para começar a montar a lista.</p>
    </div>
  );
}
