import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/join")({
  component: JoinGroup,
});

function JoinGroup() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanedCode = code.trim().toUpperCase();
      const { data, error } = await supabase.rpc("join_group_by_code", { _code: cleanedCode });
      if (error) {
        const msg = error.message.includes("invalid_code") ? "Código inválido"
          : error.message.includes("free_plan_member_limit") ? "Grupo cheio (plano gratuito)"
          : error.message;
        toast.error(msg); return;
      }
      toast.success("Entrou no grupo!");
      navigate({ to: "/app/group/$groupId", params: { groupId: data as string } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar no grupo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/> Voltar</Link>
      <div className="mx-auto max-w-md mt-6">
        <h1 className="text-2xl font-bold">Entrar em um grupo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Digite o código de 6 caracteres que você recebeu.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="code">Código do grupo</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              required maxLength={6} placeholder="ABC123"
              className="h-14 rounded-xl mt-1 text-center text-2xl font-mono tracking-[0.4em] uppercase" />
          </div>
          <Button type="submit" disabled={loading || code.length < 4} className="w-full h-12 rounded-xl text-base">
            {loading ? "Entrando..." : "Entrar no grupo"}
          </Button>
        </form>
      </div>
    </div>
  );
}
