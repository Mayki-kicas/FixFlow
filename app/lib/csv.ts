// Génération CSV sûre (RFC 4180) — module pur (pas 'use server'), donc testable.

// Échappe une cellule de façon uniforme :
// - neutralise l'injection de formule (Excel/Sheets) en préfixant les caractères
//   déclencheurs (= + - @ tab CR) d'une apostrophe ;
// - double les guillemets internes et encadre la valeur.
export function escapeCsvCell(value: unknown): string {
  let cell = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(cell)) {
    cell = `'${cell}`;
  }
  return `"${cell.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n');
}
