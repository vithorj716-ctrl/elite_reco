import { useState } from "react";

export function CookieNotice() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <aside aria-label="Aviso de cookies" className="animate-cookie-in fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-4 border border-border bg-background px-5 py-3.5 text-[11px] leading-5 md:inset-x-auto md:left-6 md:max-w-sm">
      <p>Ao navegar por este site você aceita o uso de <strong className="font-medium">cookies</strong>.</p>
      <button type="button" onClick={() => setVisible(false)} className="link-line shrink-0 py-2 text-[10px] uppercase tracking-[0.2em]">Entendi</button>
    </aside>
  );
}
