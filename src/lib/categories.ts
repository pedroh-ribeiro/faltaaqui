export const CATEGORIES = [
  { id: "Mercado", label: "Mercado", emoji: "🛒" },
  { id: "Hortifruti", label: "Hortifruti", emoji: "🥬" },
  { id: "Limpeza", label: "Limpeza", emoji: "🧽" },
  { id: "Bebidas", label: "Bebidas", emoji: "🥤" },
  { id: "Farmácia", label: "Farmácia", emoji: "💊" },
  { id: "Outros", label: "Outros", emoji: "📦" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function categoryMeta(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
