'use client';

import { useState } from 'react';

export type TabItem = { id: string; label: string; content: React.ReactNode };

// Onglets réutilisables. Les contenus (ReactNode, éventuellement rendus côté serveur)
// sont passés en props ; seul l'onglet actif est affiché.
export default function Tabs({ items, defaultId }: { items: TabItem[]; defaultId?: string }) {
  const [active, setActive] = useState(defaultId ?? items[0]?.id);
  const current = items.find((i) => i.id === active) ?? items[0];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-0.5 border-b border-border-default">
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => setActive(i.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active === i.id
                ? 'border-[color:var(--accent)] text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
