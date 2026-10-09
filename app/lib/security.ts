// Anti-brute-force du login : voir lib/login-throttle.ts (store persistant).

const ATTACHMENT_MAX_BYTES = Number(process.env.ATTACHMENT_MAX_BYTES || 8 * 1024 * 1024);
const CHAT_ATTACHMENTS_MAX_FILES = Number(process.env.CHAT_ATTACHMENTS_MAX_FILES || 5);
const TICKET_ATTACHMENTS_MAX_FILES = Number(process.env.TICKET_ATTACHMENTS_MAX_FILES || 5);

// Types explicitement autorisés (documents). Les images sont acceptées plus
// largement via isAllowedAttachmentMime (toute image matricielle).
const ALLOWED_ATTACHMENT_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/bmp',
  'image/tiff',
]);

// Accepte toute image matricielle (jpeg/png/webp/gif/heic/heif/avif/bmp/tiff…)
// + PDF. Exclut image/svg+xml : servi inline, c'est un vecteur XSS.
function isAllowedAttachmentMime(mimeType: string) {
  if (mimeType === 'application/pdf') return true;
  if (mimeType === 'image/svg+xml') return false;
  if (ALLOWED_ATTACHMENT_MIME.has(mimeType)) return true;
  return mimeType.startsWith('image/');
}


export function getAttachmentLimits() {
  return {
    maxBytes: ATTACHMENT_MAX_BYTES,
    chatMaxFiles: CHAT_ATTACHMENTS_MAX_FILES,
    ticketMaxFiles: TICKET_ATTACHMENTS_MAX_FILES,
  };
}

export function sanitizeFileName(filename: string) {
  const clean = filename.replace(/[\r\n"]/g, '_').trim();
  return clean.length > 0 ? clean : 'attachment';
}

export function validateAttachmentMeta(input: {
  size: number;
  mimeType: string;
  context: 'chat' | 'ticket';
}) {
  if (!isAllowedAttachmentMime(input.mimeType)) {
    throw new Error(`Type de fichier non autorisé (${input.mimeType || 'inconnu'})`);
  }
  if (input.size <= 0) {
    throw new Error('Fichier vide');
  }
  if (input.size > ATTACHMENT_MAX_BYTES) {
    const mb = Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024));
    throw new Error(`Fichier trop volumineux (max ${mb} Mo)`);
  }
}

function bytesMatch(buffer: Buffer, offset: number, signature: number[]): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, i) => buffer[offset + i] === byte);
}

function asciiAt(buffer: Buffer, offset: number, text: string): boolean {
  return bytesMatch(buffer, offset, [...text].map((c) => c.charCodeAt(0)));
}

// Vérifie la signature (magic bytes) réelle du fichier — ne pas se fier au type MIME
// déclaré par le client. Accepte images matricielles + PDF ; rejette tout le reste
// (HTML/script/SVG déguisés en image, etc.).
export function hasAllowedBinarySignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (bytesMatch(buffer, 0, [0xff, 0xd8, 0xff])) return true; // JPEG
  if (bytesMatch(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true; // PNG
  if (asciiAt(buffer, 0, 'GIF8')) return true; // GIF
  if (asciiAt(buffer, 0, 'RIFF') && asciiAt(buffer, 8, 'WEBP')) return true; // WEBP
  if (asciiAt(buffer, 0, '%PDF')) return true; // PDF
  if (asciiAt(buffer, 0, 'BM')) return true; // BMP
  if (bytesMatch(buffer, 0, [0x49, 0x49, 0x2a, 0x00]) || bytesMatch(buffer, 0, [0x4d, 0x4d, 0x00, 0x2a])) return true; // TIFF
  if (asciiAt(buffer, 4, 'ftyp')) return true; // HEIC/HEIF/AVIF (conteneur ISO-BMFF)
  return false;
}

// À appeler côté serveur après lecture du buffer d'une pièce jointe.
export function validateAttachmentBytes(buffer: Buffer) {
  if (!hasAllowedBinarySignature(buffer)) {
    throw new Error('Contenu de fichier non reconnu (image ou PDF attendu)');
  }
}
