import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/group/new")({
  component: NewGroup,
});

function NewGroup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("groups").insert({ name, owner_id: u.user.id, invite_code: "" })
      .select().single();
    setLoading(false);
    if (error) {
      if (error.message.includes("free_plan_group_limit")) {
        toast.error("Plano gratuito permite apenas 1 grupo. Faça upgrade para Premium.");
      } else { toast.error(error.message); }
      return;
    }
    toast.success("Grupo criado!");
    navigate({ to: "/app/group/$groupId", params: { groupId: data.id } });
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/> Voltar</Link>
      <div className="mx-auto max-w-md mt-6">
        <h1 className="text-2xl font-bold">Novo grupo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dê um nome ao seu grupo. Ex: "Casa Silva".</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Nome do grupo</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} className="h-12 rounded-xl mt-1" />
          </div>
          <Button type="submit" disabled={loading || !name.trim()} className="w-full h-12 rounded-xl text-base">
            {loading ? "Criando..." : "Criar grupo"}
          </Button>
        </form>
      </div>
    </div>
  );
}
