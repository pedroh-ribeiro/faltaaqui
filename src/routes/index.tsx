import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBasket, Users, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShoppingBasket className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Falta Aqui</span>
        </div>
        <Link to="/auth"><Button variant="ghost" size="sm">Entrar</Button></Link>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="py-12 sm:py-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <Zap className="h-3.5 w-3.5" /> Tempo real, sem complicação
          </span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight">
            A lista de compras<br/>
            <span className="bg-gradient-to-r from-primary to-[oklch(0.65_0.18_200)] bg-clip-text text-transparent">que toda família precisa</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-muted-foreground">
            Acabe com as listas perdidas no WhatsApp. Adicione, marque e veja tudo atualizado entre todos, na hora.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/auth"><Button size="lg" className="w-full sm:w-auto rounded-xl h-12 px-7 text-base">Começar grátis</Button></Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3 pb-16">
          {[
            { icon: Users, title: "Compartilhe com a família", desc: "Crie um grupo e convide com um código." },
            { icon: Zap, title: "Atualização instantânea", desc: "Marcou? Todo mundo vê na mesma hora." },
            { icon: Check, title: "Organizado por categoria", desc: "Mercado, Hortifruti, Limpeza e mais." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
