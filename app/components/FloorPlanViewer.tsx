'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { placeEquipment, unplaceEquipment, setEquipmentIcon } from '@/lib/actions/floor-plans';
import EquipmentTicketsPanel from '@/components/EquipmentTicketsPanel';
import FloorPlanManageBar from '@/components/FloorPlanManageBar';
import { EquipmentIcon, EQUIPMENT_ICON_OPTIONS } from '@/components/equipment-icons';

export type PlacedEquipment = {
  id: string;
  name: string;
  refCode: string;
  planX: number | null;
  planY: number | null;
  icon: string | null;
  category: { name: string; icon: string | null };
};

// Icône effective d'un équipement : son icône propre, sinon celle de sa catégorie,
// sinon générique.
function effectiveIcon(eq: PlacedEquipment): string | null {
  return eq.icon ?? eq.category.icon ?? null;
}

type FloorPlanViewerProps = {
  planId: string;
  fileUrl: string;
  contentType: string;
  equipments: PlacedEquipment[];
  canEdit: boolean;
  locationEquipments?: PlacedEquipment[];
  locationId: string;
  currentPlan: { id: string; name: string };
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 10;

export default function FloorPlanViewer({
  planId,
  fileUrl,
  contentType,
  equipments,
  canEdit,
  locationEquipments = [],
  locationId,
  currentPlan,
}: FloorPlanViewerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const panState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const movedRef = useRef(false);

  const isPdf = contentType === 'application/pdf';

  // --- Transform helpers -----------------------------------------------------
  const fitView = useCallback(() => {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !img.naturalWidth) return;
    const cr = c.getBoundingClientRect();
    const s = Math.min(cr.width / img.naturalWidth, cr.height / img.naturalHeight) * 0.95;
    setScale(s);
    setTx((cr.width - img.naturalWidth * s) / 2);
    setTy((cr.height - img.naturalHeight * s) / 2);
  }, []);

  const zoomAround = (cx: number, cy: number, factor: number) => {
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
      const ratio = next / prev;
      setTx((t) => cx - (cx - t) * ratio);
      setTy((t) => cy - (cy - t) * ratio);
      return next;
    });
  };

  const zoomButton = (factor: number) => {
    const cr = containerRef.current?.getBoundingClientRect();
    if (!cr) return;
    zoomAround(cr.width / 2, cr.height / 2, factor);
  };

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (isPdf) return;
    e.preventDefault();
    const cr = containerRef.current?.getBoundingClientRect();
    if (!cr) return;
    zoomAround(e.clientX - cr.left, e.clientY - cr.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, [isPdf]);

  // --- Pan -------------------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    if (isPdf || drag) return;
    if ((e.target as HTMLElement).dataset.marker) return;
    movedRef.current = false;
    panState.current = { x: e.clientX, y: e.clientY, tx, ty };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!panState.current) return;
    const dx = e.clientX - panState.current.x;
    const dy = e.clientY - panState.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    setTx(panState.current.tx + dx);
    setTy(panState.current.ty + dy);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    panState.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const normalized = (clientX: number, clientY: number) => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  };

  // --- Placement (palette + clic) -------------------------------------------
  const onPlaneClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.marker) return;
    if (movedRef.current) return;
    if (!editing) {
      setSelectedId(null);
      return;
    }
    if (!armedId || busy) return;
    const n = normalized(e.clientX, e.clientY);
    if (!n) return;
    setBusy(true);
    try {
      await placeEquipment(armedId, planId, n.x, n.y);
      setArmedId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Pose impossible');
    } finally {
      setBusy(false);
    }
  };

  // --- Drag d'un marqueur posé (fluide : suit le curseur) -------------------
  const onMarkerPointerDown = (e: React.PointerEvent, eqId: string) => {
    e.stopPropagation();
    if (!editing) return;
    const start = normalized(e.clientX, e.clientY);
    if (!start) return;
    setSelectedId(eqId);
    let moved = false;
    setDrag({ id: eqId, x: start.x, y: start.y });
    const move = (ev: PointerEvent) => {
      const n = normalized(ev.clientX, ev.clientY);
      if (!n) return;
      moved = true;
      setDrag({ id: eqId, x: n.x, y: n.y });
    };
    const up = async (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const n = normalized(ev.clientX, ev.clientY);
      setDrag(null);
      if (!moved || !n) return; // simple clic : pas de déplacement
      setBusy(true);
      try {
        await placeEquipment(eqId, planId, n.x, n.y);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Déplacement impossible');
      } finally {
        setBusy(false);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onMarkerClick = (e: React.MouseEvent, eqId: string) => {
    e.stopPropagation();
    if (editing) {
      setSelectedId(eqId);
      return;
    }
    setSelectedId(eqId);
  };

  const changeIcon = async (eqId: string, icon: string) => {
    setBusy(true);
    try {
      await setEquipmentIcon(eqId, icon);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Changement d’icône impossible');
    } finally {
      setBusy(false);
    }
  };

  const removeFromPlan = async (eqId: string) => {
    if (!confirm('Retirer cet équipement du plan ?')) return;
    setBusy(true);
    try {
      await unplaceEquipment(eqId);
      if (selectedId === eqId) setSelectedId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Retrait impossible');
    } finally {
      setBusy(false);
    }
  };

  const unplaced = locationEquipments.filter((e) => e.planX == null || e.planY == null);
  const selectedPlaced = equipments.find((e) => e.id === selectedId) || null;

  const toggleEditing = () => {
    setEditing((v) => !v);
    setManaging(false);
    setArmedId(null);
    setSelectedId(null);
  };
  const toggleManaging = () => {
    setManaging((v) => !v);
    setEditing(false);
    setArmedId(null);
  };

  const iconBtn = 'inline-flex h-7 w-7 items-center justify-center rounded border border-border-default text-muted hover:text-foreground';

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Zone plan */}
      <div className="card overflow-hidden">
        <div className="card-head">
          <span className="card-head-title">{currentPlan.name}</span>
          <div className="flex items-center gap-1.5">
            {!isPdf && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => zoomButton(1 / 1.25)} className={iconBtn} aria-label="Dézoomer">−</button>
                <button type="button" onClick={() => zoomButton(1.25)} className={iconBtn} aria-label="Zoomer">+</button>
                <button type="button" onClick={fitView} className="rounded border border-border-default px-2 py-1 text-xs text-muted hover:text-foreground">
                  Ajuster
                </button>
              </div>
            )}
            {canEdit && !isPdf && (
              <button
                type="button"
                onClick={toggleEditing}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  editing ? 'bg-[color:var(--primary)] text-[color:var(--surface)]' : 'border border-border-default text-muted hover:text-foreground'
                }`}
              >
                {editing ? 'Terminer' : 'Éditer'}
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={toggleManaging}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  managing ? 'bg-[color:var(--primary)] text-[color:var(--surface)]' : 'border border-border-default text-muted hover:text-foreground'
                }`}
              >
                Gérer les plans
              </button>
            )}
          </div>
        </div>

        {managing && (
          <div className="border-b border-border-default p-3">
            <FloorPlanManageBar locationId={locationId} currentPlan={currentPlan} />
          </div>
        )}

        {isPdf ? (
          <div className="p-3">
            <iframe src={fileUrl} title="Plan PDF" className="h-[72vh] w-full rounded-lg border border-border-default" />
            <p className="mt-2 text-[11px] text-muted">
              Les marqueurs ne sont pas disponibles sur un plan PDF. Convertissez le plan en SVG ou DWG pour poser des équipements.
            </p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative h-[74vh] w-full touch-none select-none overflow-hidden bg-surface-alt"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={onPlaneClick}
            style={{ cursor: editing && armedId ? 'crosshair' : 'grab' }}
          >
            <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
              {/* En dark mode : inversion + rotation de teinte -> fond sombre, traits clairs,
                  couleurs préservées. Les marqueurs (frères) ne sont pas affectés. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={fileUrl}
                alt="Plan d’étage"
                className="block max-w-none dark:[filter:invert(0.92)_hue-rotate(180deg)]"
                draggable={false}
                onLoad={fitView}
              />

              {equipments.map((eq) => {
                const isDragged = drag?.id === eq.id;
                const x = isDragged ? drag!.x : eq.planX;
                const y = isDragged ? drag!.y : eq.planY;
                if (x == null || y == null) return null;
                const active = selectedId === eq.id;
                return (
                  <button
                    key={eq.id}
                    type="button"
                    data-marker="1"
                    onPointerDown={(e) => onMarkerPointerDown(e, eq.id)}
                    onClick={(e) => onMarkerClick(e, eq.id)}
                    title={`${eq.name} (${eq.refCode})`}
                    className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-white shadow-soft-md ${
                      active ? 'ring-2 ring-[#111827] dark:ring-white' : ''
                    } ${editing ? 'cursor-move' : 'cursor-pointer'} ${isDragged ? 'opacity-90' : ''}`}
                    style={{ left: `${x * 100}%`, top: `${y * 100}%`, backgroundColor: '#e8513b' }}
                  >
                    <span data-marker="1" className="pointer-events-none">
                      <EquipmentIcon icon={effectiveIcon(eq)} className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Aide contextuelle en surimpression */}
            {editing && (
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#111827]/80 px-3 py-1 text-[11px] font-medium text-white">
                {armedId ? 'Cliquez sur le plan pour poser le point' : 'Choisissez un équipement dans la palette, ou glissez un marqueur'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panneau latéral */}
      <aside className="space-y-3">
        {editing ? (
          <div className="card">
            <div className="card-head">
              <span className="card-head-title">À poser</span>
              <span className="badge badge-neutral">{unplaced.length}</span>
            </div>
            <div className="p-2">
              {selectedPlaced && (
                <div className="mb-2 rounded-lg bg-surface-alt px-2 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-foreground">
                      {selectedPlaced.name} <span className="text-muted">({selectedPlaced.refCode})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromPlan(selectedPlaced.id)}
                      disabled={busy}
                      className="flex-shrink-0 text-xs font-medium text-[#b91c1c] hover:opacity-80 disabled:opacity-50"
                    >
                      Retirer
                    </button>
                  </div>
                  <p className="mt-1.5 field-label">Icône</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {EQUIPMENT_ICON_OPTIONS.map((opt) => {
                      const current = effectiveIcon(selectedPlaced) ?? 'generic';
                      const active = current === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          title={opt.label}
                          onClick={() => changeIcon(selectedPlaced.id, opt.key)}
                          disabled={busy}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-white disabled:opacity-50 ${
                            active ? 'border-[#111827] bg-[#e8513b] dark:border-white' : 'border-transparent bg-[#e8513b]/60 hover:bg-[#e8513b]'
                          }`}
                        >
                          <EquipmentIcon icon={opt.key} className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {unplaced.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted">Tous les équipements du centre sont posés.</p>
              ) : (
                <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                  {unplaced.map((eq) => (
                    <li key={eq.id}>
                      <button
                        type="button"
                        onClick={() => setArmedId((id) => (id === eq.id ? null : eq.id))}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                          armedId === eq.id ? 'bg-[#e8513b]/10 ring-1 ring-[#e8513b]' : 'hover:bg-surface-alt'
                        }`}
                      >
                        <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#e8513b] text-white">
                          <EquipmentIcon icon={effectiveIcon(eq)} className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{eq.name}</span>
                          <span className="block truncate text-[10px] text-muted">{eq.refCode} · {eq.category.name}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : selectedId ? (
          <>
            <div className="flex items-center justify-end">
              <button type="button" onClick={() => setSelectedId(null)} className="text-xs text-muted hover:text-foreground">
                Fermer
              </button>
            </div>
            <EquipmentTicketsPanel equipmentId={selectedId} canEdit={canEdit} />
          </>
        ) : (
          <div className="card p-4 text-sm text-muted">
            Cliquez sur un marqueur pour voir l’équipement et ses tickets.
            <p className="mt-2 text-[11px]">Molette = zoom · glisser = déplacer la vue.</p>
            {canEdit && <p className="mt-1 text-[11px]">« Éditer » pour poser des équipements, « Gérer les plans » pour les étages.</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
