import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check } from "lucide-react";
import { categoryMeta } from "@/lib/categories";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/group/$groupId/history")({
  component: HistoryPage,
});

type Item = {
  id: string; name: string; quantity: string; category: string;
  purchased_by: string | null; purchased_at: string | null;
};

function HistoryPage() {
  const { groupId } = Route.useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("items").select("id, name, quantity, category, purchased_by, purchased_at")
        .eq("group_id", groupId).eq("status", "purchased")
        .order("purchased_at", { ascending: false }).limit(100);
      setItems((data ?? []) as Item[]);
      const ids = Array.from(new Set((data ?? []).map((d) => d.purchased_by).filter(Boolean) as string[]));
      if (ids.length > 0) {
        const { data: ps } = await supabase.from("profiles").select("id, name").in("id", ids);
        const m: Record<string, string> = {};
        (ps ?? []).forEach((p) => { m[p.id] = p.name; });
        setProfiles(m);
      }
      setLoading(false);
    })();
  }, [groupId]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
          <Link to="/app/group/$groupId" params={{ groupId }} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display font-bold">Histórico</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 pt-4">
        {loading ? <div className="text-sm text-muted-foreground">Carregando...</div>
         : items.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">Nenhum item comprado ainda.</div>
        ) : (
          <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
            {items.map((i) => {
              const c = categoryMeta(i.category);
              return (
                <li key={i.id} className="flex items-center gap-3 p-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                    <Check className="h-4 w-4"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate"><span className="mr-1">{c.emoji}</span>{i.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {i.quantity}
                      {i.purchased_by && profiles[i.purchased_by] ? ` · por ${profiles[i.purchased_by]}` : ""}
                      {i.purchased_at ? ` · ${format(new Date(i.purchased_at), "d MMM, HH:mm", { locale: ptBR })}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
