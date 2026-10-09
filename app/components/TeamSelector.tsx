'use client';

import { useRouter } from 'next/navigation';

type Team = {
  id: string;
  name: string;
  _count: {
    tickets: number;
  };
};

type TeamSelectorProps = {
  teams: Team[];
  selectedTeamId?: string;
  baseUrl?: string;
};

export default function TeamSelector({ teams, selectedTeamId, baseUrl }: TeamSelectorProps) {
  const router = useRouter();

  const handleTeamChange = (teamId: string) => {
    if (baseUrl) {
      router.push(`${baseUrl}/${teamId}`);
    } else {
      router.push(`?team=${teamId}`);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {teams.map((team) => {
        const isSelected = team.id === selectedTeamId;
        return (
          <button
            key={team.id}
            onClick={() => handleTeamChange(team.id)}
            aria-pressed={isSelected}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-[color:var(--primary)] text-[color:var(--surface)]'
                : 'bg-surface text-foreground border border-border-default hover:border-[color:var(--accent)] hover:bg-surface-alt'
            }`}
          >
            {team.name}
            <span
              className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full tabular-nums ${
                isSelected
                  ? 'bg-[#e8513b]/25 text-[color:var(--accent)]'
                  : 'bg-surface-alt text-muted'
              }`}
            >
              {team._count.tickets}
            </span>
          </button>
        );
      })}
    </div>
  );
}
