'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleTicketTask } from '@/lib/actions/maintenance';

type Task = {
  id: string;
  label: string;
  done: boolean;
  doneBy: { displayName: string } | null;
  doneAt: Date | null;
};

// Check-list d'un OT (préventif). Cochable par ADMIN/MANAGER (canEdit).
export default function TicketTaskList({ tasks, canEdit }: { tasks: Task[]; canEdit: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (task: Task) => {
    if (!canEdit) return;
    setBusyId(task.id);
    try {
      await toggleTicketTask(task.id, !task.done);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusyId(null);
    }
  };

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-head-title">Check-list</span>
        <span className="badge badge-neutral tabular-nums">{doneCount}/{tasks.length}</span>
      </div>
      <ul className="p-2 space-y-0.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <label className={`flex items-start gap-2 rounded px-1.5 py-1 ${canEdit ? 'cursor-pointer hover:bg-surface-alt' : ''}`}>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggle(task)}
                disabled={!canEdit || busyId === task.id}
                className="mt-0.5 accent-[color:var(--accent)]"
              />
              <span className="min-w-0">
                <span className={`text-xs ${task.done ? 'text-muted line-through' : 'text-foreground'}`}>{task.label}</span>
                {task.done && task.doneBy && (
                  <span className="block text-[10px] text-muted">
                    {task.doneBy.displayName}
                    {task.doneAt ? ` · ${new Date(task.doneAt).toLocaleDateString('fr-FR')}` : ''}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
