import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

// Abstraction de stockage d'objets (pièces jointes). Driver disque local par défaut ;
// remplaçable par S3/MinIO plus tard sans toucher aux appelants (mêmes fonctions).
// Les fichiers sont hors de /public : le téléchargement passe toujours par la route
// authentifiée /api/attachments/[id], jamais servi en statique.

const BASE_DIR = path.resolve(process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), 'uploads'));

// Résout une clé en chemin absolu sûr (anti path-traversal).
function resolveKeyPath(key: string): string {
  const normalized = path.normalize(key).replace(/^([.][.](\/|\\|$))+/, '');
  const full = path.resolve(BASE_DIR, normalized);
  if (full !== BASE_DIR && !full.startsWith(BASE_DIR + path.sep)) {
    throw new Error('Clé de stockage invalide');
  }
  return full;
}

export function buildAttachmentKey(id: string): string {
  return `attachments/${id}`;
}

export function buildEquipmentPhotoKey(id: string): string {
  return `equipment-photos/${id}`;
}

// Rendu affiché d'un plan d'étage (SVG/image/PDF).
export function buildFloorPlanKey(id: string): string {
  return `floor-plans/${id}`;
}

// Fichier source d'un plan (DWG d'origine, conservé pour archive).
export function buildFloorPlanSourceKey(id: string): string {
  return `floor-plans/${id}.src`;
}

// Document rattaché à un équipement (manuel, schéma, certificat…).
export function buildEquipmentDocumentKey(id: string): string {
  return `equipment-documents/${id}`;
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  const full = resolveKeyPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function getObject(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKeyPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await unlink(resolveKeyPath(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
