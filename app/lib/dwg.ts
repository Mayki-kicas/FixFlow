// Conversion DWG -> SVG déléguée à un service dédié (conteneur Docker), car elle
// nécessite des binaires natifs (LibreDWG/ODA + ezdxf) absents du runtime Next.js.
// L'URL du service est configurée par DWG_CONVERTER_URL. Tant qu'elle est absente,
// l'upload de DWG est refusé proprement (on peut uploader un SVG/PDF/PNG en attendant).

export function isDwgConversionEnabled(): boolean {
  return !!process.env.DWG_CONVERTER_URL;
}

export async function convertDwgToSvg(dwg: Buffer): Promise<Buffer> {
  const url = process.env.DWG_CONVERTER_URL;
  if (!url) {
    throw new Error(
      'Conversion DWG non configurée. Uploadez un SVG, un PDF ou une image en attendant.',
    );
  }

  const res = await fetch(`${url.replace(/\/$/, '')}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(dwg),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Échec de la conversion du DWG${detail ? ` : ${detail.slice(0, 200)}` : ''}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
