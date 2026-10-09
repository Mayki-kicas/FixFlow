'use client';

import { useState } from 'react';
import Image from 'next/image';

// Vignette de pièce jointe robuste : si le fichier a été supprimé du disque
// (nettoyage des vieux fichiers), affiche un placeholder au lieu d'une image cassée.
export default function AttachmentThumb({
  src,
  alt,
  size = 40,
  className = '',
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`flex items-center justify-center border border-dashed border-border-default text-muted ${className}`}
        style={{ width: size, height: size }}
        title="Pièce jointe indisponible (fichier supprimé)"
        aria-label="Pièce jointe indisponible"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M21 15l-5-5L5 21M3 5.5A1.5 1.5 0 014.5 4H18M21 8v8" />
        </svg>
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
