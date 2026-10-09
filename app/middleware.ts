import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// CSP par requête avec nonce (script-src sans 'unsafe-inline' + strict-dynamic).
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Next/React injectent des styles inline → 'unsafe-inline' conservé côté style uniquement.
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? '' : " 'unsafe-eval'"}`,
    "connect-src 'self'",
    "form-action 'self'",
  ].join('; ');
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const host = req.headers.get('host') || '';
    const allowedHosts = (process.env.ALLOWED_HOSTS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (allowedHosts.length > 0 && host && !allowedHosts.includes(host.toLowerCase())) {
      return new NextResponse('Host non autorise', { status: 400 });
    }

    const forceHttps = process.env.FORCE_HTTPS === 'true';
    const forwardedProto = req.headers.get('x-forwarded-proto');
    if (forceHttps && forwardedProto && forwardedProto !== 'https') {
      const httpsUrl = req.nextUrl.clone();
      httpsUrl.protocol = 'https:';
      return NextResponse.redirect(httpsUrl);
    }

    // Routes admin uniquement
    if (path.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Routes backoffice (admin + manager)
    if (path.startsWith('/backoffice') &&
        token?.role !== 'ADMIN' &&
        token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // CSP à nonce : on le passe à Next via l'en-tête de requête (Next l'applique à ses
    // scripts) et on le pose sur la réponse.
    const nonce = btoa(crypto.randomUUID());
    const csp = buildCsp(nonce);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('content-security-policy', csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('content-security-policy', csp);
    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Exclut les routes à authentification propre par token (cron internes + intégration
    // externe) : elles n'ont pas de session NextAuth et seraient sinon redirigées (307).
    '/((?!api/auth|api/notifications|api/integration|auth/signin|auth/pending|_next/static|_next/image|favicon.ico).*)',
  ],
};
