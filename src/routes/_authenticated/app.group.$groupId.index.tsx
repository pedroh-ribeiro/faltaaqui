import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Share2, History, Copy, Check, X } from "lucide-react";
import { CATEGORIES, categoryMeta, type CategoryId } from "@/lib/categories";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/app/group/$groupId/")({
  component: GroupView,
});

type Item = {
  id: string;
  name: string;
  quantity: string;
  category: string;
  status: "pending" | "purchased";
  created_by: string;
  created_at: string;
};

type Group = { id: string; name: string; owner_id: string };
type Profile = { id: string; name: string };

function GroupView() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [me, setMe] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const isOwner = !!(group && me && group.owner_id === me);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setMe(u.user.id);
      const { data: g, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
      if (!mounted) return;
      if (error || !g) { toast.error("Grupo não encontrado"); navigate({ to: "/app" }); return; }
      setGroup(g);
      const { data: its } = await supabase.from("items").select("*").eq("group_id", groupId).order("created_at", { ascending: false });
      setItems((its ?? []) as Item[]);
      const { data: members } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length > 0) {
        const { data: ps } = await supabase.from("profiles").select("id, name").in("id", ids);
        const map: Record<string, string> = {};
        (ps ?? []).forEach((p: Profile) => { map[p.id] = p.name; });
        setProfiles(map);
      }
    })();
    return () => { mounted = false; };
  }, [groupId, navigate]);

  // realtime
  useEffect(() => {
    const channel = supabase
      .channel(`items-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `group_id=eq.${groupId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [payload.new as Item, ...prev.filter((i) => i.id !== (payload.new as Item).id)]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) => prev.map((i) => i.id === (payload.new as Item).id ? payload.new as Item : i));
          } else if (payload.eventType === "DELETE") {
            setItems((prev) => prev.filter((i) => i.id !== (payload.old as Item).id));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const grouped = useMemo(() => {
    const m: Record<string, Item[]> = {};
    pending.forEach((i) => { (m[i.category] ??= []).push(i); });
    return m;
  }, [pending]);

  async function toggle(item: Item) {
    const next = item.status === "pending" ? "purchased" : "pending";
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: next } : i));
    const patch = next === "purchased"
      ? { status: next, purchased_by: me, purchased_at: new Date().toISOString() }
      : { status: next, purchased_by: null, purchased_at: null };
    const { error } = await supabase.from("items").update(patch).eq("id", item.id);
    if (error) toast.error("Falha ao atualizar");
  }

  async function remove(item: Item) {
    setItems((p) => p.filter((i) => i.id !== item.id));
    await supabase.from("items").delete().eq("id", item.id);
  }

  async function loadInviteCode() {
    if (!isOwner || inviteCode) return;
    const { data, error } = await supabase.rpc("get_group_invite_code", { _group_id: groupId });
    if (error) { toast.error("Não foi possível carregar o código"); return; }
    setInviteCode(data as string);
  }

  async function copyCode() {
    if (!inviteCode) return;
    const url = `${window.location.origin}/join/${inviteCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!group) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
          <Link to="/app" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold truncate">{group.name}</h1>
            <p className="text-xs text-muted-foreground">{pending.length} pendente{pending.length !== 1 ? "s" : ""}</p>
          </div>
          <Link to="/app/group/$groupId/history" params={{ groupId }}>
            <Button variant="ghost" size="icon" aria-label="Histórico"><History className="h-5 w-5"/></Button>
          </Link>
          {isOwner && (
            <Sheet open={shareOpen} onOpenChange={(o) => { setShareOpen(o); if (o) loadInviteCode(); }}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Compartilhar"><Share2 className="h-5 w-5"/></Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl">
                <SheetHeader><SheetTitle>Convidar para "{group.name}"</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl bg-accent p-5 text-center">
                    <div className="text-xs uppercase tracking-wide text-accent-foreground/70">Código do grupo</div>
                    <div className="mt-2 text-4xl font-mono font-bold tracking-[0.3em]">{inviteCode ?? "..."}</div>
                  </div>
                  <Button onClick={copyCode} disabled={!inviteCode} variant="outline" className="w-full h-12 rounded-xl">
                    {copied ? <><Check className="h-4 w-4 mr-2"/>Copiado!</> : <><Copy className="h-4 w-4 mr-2"/>Copiar link de convite</>}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">Somente o dono do grupo pode ver e compartilhar o código.</p>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-4">
        {pending.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="text-5xl">✨</div>
            <h3 className="mt-3 font-semibold">Lista vazia</h3>
            <p className="text-sm text-muted-foreground mt-1">Toque em "Adicionar item" para começar.</p>
          </div>
        ) : (
          CATEGORIES.filter((c) => grouped[c.id]).map((c) => (
            <section key={c.id} className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {c.emoji} {c.label}
              </h2>
              <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
                {grouped[c.id].map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-3">
                    <button
                      onClick={() => toggle(item)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-muted-foreground/30 hover:border-primary"
                      aria-label="Marcar como comprado"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.quantity} · {profiles[item.created_by] ?? "—"}
                      </div>
                    </div>
                    <button onClick={() => remove(item)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive" aria-label="Remover">
                      <X className="h-4 w-4"/>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground h-14 px-6 shadow-lg shadow-primary/30"
            aria-label="Adicionar item"
          >
            <Plus className="h-5 w-5" /> <span className="font-semibold">Adicionar item</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>Novo item</SheetTitle></SheetHeader>
          <AddItemForm groupId={groupId} me={me!} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddItemForm({ groupId, me, onDone }: { groupId: string; me: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState<CategoryId>("Mercado");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("items").insert({
      group_id: groupId, name: name.trim(), quantity: quantity.trim() || "1",
      category, created_by: me,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div>
        <label className="text-sm font-medium">Nome do item</label>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Ex: Leite" className="h-12 rounded-xl mt-1"/>
      </div>
      <div>
        <label className="text-sm font-medium">Quantidade</label>
        <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} maxLength={20} placeholder="2 unidades, 1kg..." className="h-12 rounded-xl mt-1"/>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Categoria</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(c.id)}
              className={`rounded-xl border p-3 text-sm text-center transition ${category === c.id ? "border-primary bg-accent" : "bg-card"}`}>
              <div className="text-xl">{c.emoji}</div>
              <div className="text-xs mt-0.5">{c.label}</div>
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={loading || !name.trim()} className="w-full h-12 rounded-xl text-base">
        {loading ? "Adicionando..." : "Adicionar à lista"}
      </Button>
    </form>
  );
}
