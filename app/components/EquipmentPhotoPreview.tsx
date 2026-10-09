'use client';

import { useState } from 'react';
import Image from 'next/image';

type EquipmentPhotoPreviewProps = {
  src: string;
  alt: string;
  size?: number;
};

export default function EquipmentPhotoPreview({ src, alt, size = 32 }: EquipmentPhotoPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  // Fichier supprimé du disque (nettoyage) → placeholder, jamais d'image cassée ni de crash.
  if (failed) {
    return (
      <span
        className="flex flex-shrink-0 items-center justify-center rounded border border-dashed border-border-default text-muted"
        style={{ width: `${size}px`, height: `${size}px` }}
        title="Photo indisponible (fichier supprimé)"
        aria-label="Photo indisponible"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M21 15l-5-5L5 21M3 5.5A1.5 1.5 0 014.5 4H18M21 8v8" />
        </svg>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex-shrink-0 rounded border border-border-default transition-colors hover:border-[color:var(--accent)]"
        aria-label="Voir la photo de l'équipement"
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          unoptimized
          onError={() => setFailed(true)}
          className="object-cover rounded"
          style={{ width: `${size}px`, height: `${size}px` }}
        />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-xl bg-surface border border-border-default p-3 shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-2 top-2 h-7 w-7 rounded-full border border-border-default text-muted transition-colors hover:bg-surface-alt"
              aria-label="Fermer"
            >
              ×
            </button>
            <div className="flex items-center justify-center">
              <Image
                src={src}
                alt={alt}
                width={900}
                height={700}
                unoptimized
                onError={() => {
                  setFailed(true);
                  setIsOpen(false);
                }}
                className="max-h-[70vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
