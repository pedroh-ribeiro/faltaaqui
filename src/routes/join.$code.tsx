import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$code")({
  component: JoinByLink,
});

function JoinByLink() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Entrando no grupo...");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        sessionStorage.setItem("pending_join_code", code);
        navigate({ to: "/auth" });
        return;
      }
      const { data, error } = await supabase.rpc("join_group_by_code", { _code: code });
      if (error) {
        const msg = error.message.includes("invalid_code") ? "Código inválido"
          : error.message.includes("free_plan_member_limit") ? "Grupo cheio (plano gratuito)"
          : error.message;
        toast.error(msg);
        setStatus(msg);
        setTimeout(() => navigate({ to: "/app" }), 1500);
        return;
      }
      toast.success("Você entrou no grupo!");
      navigate({ to: "/app/group/$groupId", params: { groupId: data as string } });
    })();
  }, [code, navigate]);

  return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">{status}</div>;
}
