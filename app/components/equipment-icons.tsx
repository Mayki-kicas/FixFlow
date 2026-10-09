// Icônes de type d'équipement pour les marqueurs de plan + le sélecteur.
// Formes volontairement franches (trait épais ~2) pour rester lisibles en petit.

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className ?? 'h-4 w-4'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Portail / barrière levante : poteau + lisse à rayures.
function GateIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <line x1="5" y1="21" x2="5" y2="9" />
      <path d="M3 21h4" />
      <circle cx="5" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <line x1="6.3" y1="7" x2="21" y2="5.5" />
      <line x1="10" y1="6.6" x2="10.6" y2="8.6" />
      <line x1="14" y1="6.2" x2="14.6" y2="8.2" />
      <line x1="18" y1="5.8" x2="18.6" y2="7.8" />
    </Svg>
  );
}

// Caméra (silhouette appareil : corps + viseur + objectif).
function CameraIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <path d="M8.5 8l1.3-2.3h4.4L15.5 8" />
      <circle cx="12" cy="13.5" r="3" />
    </Svg>
  );
}

// Porte / accès : vantail debout + poignée.
function DoorIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" />
      <line x1="5" y1="21" x2="19" y2="21" />
      <circle cx="14" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Ascenseur : cabine + flèches haut/bas.
function ElevatorIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M12 7l-2.2 2.8h4.4z" fill="currentColor" stroke="none" />
      <path d="M12 17l-2.2-2.8h4.4z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Générique (tout et rien) : clé (équipement / maintenance).
function GenericIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a6 6 0 0 1-7.6 7.6l-6.3 6.3a2.1 2.1 0 0 1-3-3l6.3-6.3a6 6 0 0 1 7.6-7.6l-3.1 3.1z" />
    </Svg>
  );
}

export const EQUIPMENT_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: 'gate', label: 'Portail / Barrière' },
  { key: 'camera', label: 'Caméra / Vidéo' },
  { key: 'door', label: 'Porte / Accès' },
  { key: 'elevator', label: 'Ascenseur / Monte-charge' },
  { key: 'generic', label: 'Générique' },
];

export function EquipmentIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  switch (icon) {
    case 'gate':
      return <GateIcon className={className} />;
    case 'camera':
      return <CameraIcon className={className} />;
    case 'door':
      return <DoorIcon className={className} />;
    case 'elevator':
      return <ElevatorIcon className={className} />;
    default:
      return <GenericIcon className={className} />;
  }
}
