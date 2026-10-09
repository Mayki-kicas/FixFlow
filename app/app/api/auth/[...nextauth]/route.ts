import NextAuth from 'next-auth';
import { buildAuthOptions } from '@/lib/auth';

// Options construites par requête pour activer dynamiquement le provider SSO
// (Entra) selon la configuration backoffice.
async function handler(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const authOptions = await buildAuthOptions();
  // Signature App Router à 3 arguments de NextAuth (options par requête).
  // @ts-expect-error — NextAuth v4 accepte (req, ctx, options) hors types publics.
  return NextAuth(req, ctx, authOptions);
}

export { handler as GET, handler as POST };
