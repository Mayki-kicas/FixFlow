import Link from 'next/link';

export const metadata = {
  title: 'Compte en attente — FixFlow',
};

// Page affichée quand un compte est authentifié mais pas encore autorisé :
// un administrateur doit lui attribuer un rôle avant qu'il puisse accéder à l'outil.
export default function PendingAccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#c97e1a]/10 text-signal-progress">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-foreground">Compte en attente de validation</h1>
        <p className="mt-2 text-sm text-muted">
          Votre connexion a réussi, mais votre compte n&apos;a pas encore reçu d&apos;accès.
          Un administrateur doit vous attribuer un rôle. Réessayez une fois cela fait.
        </p>
        <Link
          href="/auth/signin"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--surface)] transition-colors hover:bg-[color:var(--primary-hover)]"
        >
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
