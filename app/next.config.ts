import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
// La CSP est posée par requête dans middleware.ts (nonce par requête, sans 'unsafe-inline'
// sur script-src). Les rares routes hors middleware (signin, api à token) n'en reçoivent pas
// — elles ne rendent pas de HTML à scripts sensibles.

// Les pièces jointes (photos/PDF) transitent par des Server Actions en multipart.
// La limite par défaut de 1 Mo est bien en-dessous de nos limites d'upload
// (cf. lib/security.ts) : on l'aligne sur maxBytes × nb max de fichiers + marge overhead.
const attachmentMaxBytes = Number(process.env.ATTACHMENT_MAX_BYTES || 8 * 1024 * 1024);
const maxAttachmentFiles = Math.max(
  Number(process.env.TICKET_ATTACHMENTS_MAX_FILES || 5),
  Number(process.env.CHAT_ATTACHMENTS_MAX_FILES || 5),
);
const serverActionsBodySizeLimit = attachmentMaxBytes * maxAttachmentFiles + 4 * 1024 * 1024;

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: serverActionsBodySizeLimit,
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
