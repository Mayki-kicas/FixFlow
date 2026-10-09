'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addTicketSignature } from '@/lib/actions/signatures';
import { CheckIcon } from '@/components/icons';

// Capture d'une signature d'intervention (tactile/souris) enregistrée en pièce jointe.
export default function SignaturePad({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const start = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    drawing.current = true;
    hasInk.current = true;
    setSaved(false);
    const ctx = c.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    c.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
    setSaved(false);
  };

  const save = async () => {
    const c = canvasRef.current;
    if (!c || !hasInk.current) return;
    setBusy(true);
    try {
      await addTicketSignature(ticketId, c.toDataURL('image/png'));
      clear();
      setSaved(true);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head"><span className="card-head-title">Signature d’intervention</span></div>
      <div className="p-3 space-y-2">
        <canvas
          ref={canvasRef}
          width={320}
          height={120}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none rounded-lg border border-dashed border-border-default bg-white"
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={busy} className="rounded bg-[color:var(--primary)] px-3 py-1 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--primary-hover)] disabled:opacity-50">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" onClick={clear} disabled={busy} className="rounded border border-border-default px-3 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50">
            Effacer
          </button>
          {saved && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><CheckIcon className="h-3 w-3" /> Signature jointe</span>}
        </div>
      </div>
    </div>
  );
}
