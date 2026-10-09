'use client';

import Image from 'next/image';

// Affiche le QR d'un équipement (généré côté serveur) + impression d'une étiquette.
export default function EquipmentQrCode({
  dataUrl,
  scanUrl,
  refCode,
  name,
}: {
  dataUrl: string;
  scanUrl: string;
  refCode: string;
  name: string;
}) {
  const print = () => {
    const w = window.open('', '_blank', 'width=400,height=500');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>QR ${refCode}</title>
      <style>body{font-family:sans-serif;text-align:center;margin:24px}img{width:256px;height:256px}h2{margin:12px 0 2px;font-size:16px}p{margin:0;color:#555;font-family:monospace;font-size:13px}</style>
      </head><body>
      <img src="${dataUrl}" alt="QR" />
      <h2>${name.replace(/</g, '&lt;')}</h2>
      <p>${refCode.replace(/</g, '&lt;')}</p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Image src={dataUrl} alt={`QR ${refCode}`} width={120} height={120} unoptimized className="rounded border border-border-default bg-white p-1" />
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs text-muted break-all">{scanUrl}</p>
        <button
          type="button"
          onClick={print}
          className="rounded border border-border-default px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
        >
          Imprimer l’étiquette
        </button>
      </div>
    </div>
  );
}
