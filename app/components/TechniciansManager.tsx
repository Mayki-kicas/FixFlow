'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSkill, deleteSkill, setUserSkills } from '@/lib/actions/technicians';
import { formatMinutes } from '@/lib/costs-core';

type Skill = { id: string; name: string; _count: { users: number } };
type Technician = { id: string; displayName: string; role: string; skills: { skillId: string }[] };
type TimesheetRow = { userId: string; displayName: string; minutes: number };

const roleLabel: Record<string, string> = { ADMIN: 'Admin', MANAGER: 'Manager', MAINTAINER: 'Mainteneur' };

export default function TechniciansManager({
  skills,
  technicians,
  timesheet,
}: {
  skills: Skill[];
  technicians: Technician[];
  timesheet: TimesheetRow[];
}) {
  const router = useRouter();
  const [newSkill, setNewSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const addSkill = async () => {
    if (!newSkill.trim()) return;
    await run(async () => {
      await createSkill(newSkill);
      setNewSkill('');
    });
  };

  const toggleUserSkill = async (tech: Technician, skillId: string) => {
    const current = new Set(tech.skills.map((s) => s.skillId));
    if (current.has(skillId)) current.delete(skillId);
    else current.add(skillId);
    await run(() => setUserSkills(tech.id, [...current]));
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>}

      {/* Compétences */}
      <div className="card">
        <div className="card-head"><span className="card-head-title">Compétences / habilitations</span></div>
        <div className="p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {skills.length === 0 && <span className="text-xs text-muted">Aucune compétence.</span>}
            {skills.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-alt px-2 py-0.5 text-xs text-foreground">
                {s.name}
                <span className="text-[10px] text-muted tabular-nums">({s._count.users})</span>
                <button type="button" onClick={() => run(() => deleteSkill(s.id))} disabled={busy} className="hover:text-[#b91c1c] disabled:opacity-50" title="Supprimer">×</button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addSkill(); }}
              placeholder="ex. Électrique, Levage, Portails auto"
              maxLength={80}
              disabled={busy}
              className="rounded border border-border-default bg-surface px-2 py-1 text-xs text-foreground focus:border-[color:var(--accent)] focus:outline-none"
            />
            <button type="button" onClick={addSkill} disabled={busy} className="rounded bg-[color:var(--primary)] px-2.5 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50">
              Ajouter
            </button>
          </div>
        </div>
      </div>

      {/* Techniciens */}
      <div className="card">
        <div className="card-head"><span className="card-head-title">Techniciens &amp; habilitations</span></div>
        <div className="divide-y divide-[color:var(--border-default)]">
          {technicians.map((t) => {
            const assigned = new Set(t.skills.map((s) => s.skillId));
            return (
              <div key={t.id} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{t.displayName}</span>
                  <span className="badge badge-neutral">{roleLabel[t.role] ?? t.role}</span>
                </div>
                {skills.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {skills.map((s) => {
                      const on = assigned.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleUserSkill(t, s.id)}
                          disabled={busy}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                            on ? 'bg-[#e8513b]/10 text-[color:var(--accent)] ring-1 ring-[#e8513b]' : 'border border-border-default text-muted hover:text-foreground'
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feuilles de temps */}
      <div className="card">
        <div className="card-head">
          <span className="card-head-title">Feuilles de temps</span>
          <span className="page-toolbar-subtitle">30 derniers jours</span>
        </div>
        <div className="p-2">
          {timesheet.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted">Aucun temps saisi sur la période.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--border-default)]">
              {timesheet.map((r) => (
                <li key={r.userId} className="flex items-center justify-between px-1.5 py-1.5">
                  <span className="text-xs text-foreground">{r.displayName}</span>
                  <span className="text-xs font-medium text-foreground tabular-nums">{formatMinutes(r.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
