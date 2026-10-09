import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';

export default async function BackofficePage() {
  const user = await getCurrentUser();

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
    redirect('/tickets');
  }

  const [criticalCount, locationCount, equipmentCount, teamCount] = await Promise.all([
    prisma.ticket.count({
      where: { priority: 'P1', isArchived: false },
    }),
    prisma.location.count(),
    prisma.equipment.count(),
    prisma.team.count(),
  ]);

  const sections = [
    {
      title: 'GMAO',
      description: 'Maintenance préventive, planification et magasin',
      items: [
        { title: 'Préventif', description: 'Plans de maintenance et contrôles réglementaires', href: '/backoffice/preventif' },
        { title: 'Planification', description: 'Dispatch des interventions par technicien', href: '/backoffice/planning' },
        { title: 'Pièces & stock', description: 'Magasin : pièces détachées, stock et seuils', href: '/backoffice/pieces' },
      ],
    },
    {
      title: 'Pilotage',
      description: 'Fiabilité, analyse, reporting et conformité',
      items: [
        { title: 'Fiabilité', description: 'MTBF, MTTR, disponibilité, respect du préventif', href: '/backoffice/fiabilite' },
        { title: 'Analytique', description: 'KPIs et tendances tickets', href: '/backoffice/analytique' },
        { title: 'Rapports', description: 'Incidents et rapports d’intervention', href: '/backoffice/incident-reports' },
        { title: 'Codes défaut', description: 'Taxonomie panne / cause / remède', href: '/backoffice/codes-defaut' },
        { title: 'Exports', description: 'Exports CSV / PDF', href: '/backoffice/exports' },
      ],
    },
    {
      title: 'Référentiel',
      description: 'Parc, catégories, sites et équipes',
      items: [
        { title: 'Équipements', description: 'Parc, référentiel, documents, QR et compteurs', href: '/backoffice/equipments' },
        { title: 'Catégories', description: "Catégories d'équipements et droits d'accès", href: '/backoffice/categories' },
        { title: 'Localisations', description: 'Sites et localisation Global', href: '/backoffice/locations' },
        { title: 'Équipes', description: 'Équipes techniques et statuts workflow', href: '/backoffice/teams' },
      ],
    },
    {
      title: 'Acteurs',
      description: 'Prestataires, techniciens et accès',
      items: [
        { title: 'Prestataires', description: 'Fournisseurs externes et contrats', href: '/backoffice/maintainers' },
        { title: 'Techniciens', description: 'Compétences, habilitations et feuilles de temps', href: '/backoffice/techniciens' },
        { title: 'Groupes', description: 'Groupes utilisateurs et abonnements', href: '/backoffice/groups' },
        { title: 'Utilisateurs & rôles', description: 'Attribution des rôles, accès et comptes locaux', href: '/backoffice/users' },
      ],
    },
  ];

  if (user.role === 'ADMIN') {
    sections.push({
      title: 'Configuration',
      description: 'Réglages globaux du process maintenance',
      items: [
        { title: 'Réglages SLA', description: 'Délai de prise en charge (triage) et variables globales', href: '/backoffice/settings' },
        { title: 'Authentification', description: 'Méthode SSO (LDAP / Microsoft) et paramètres', href: '/backoffice/auth' },
        { title: 'Email', description: 'Serveur SMTP et notifications par email', href: '/backoffice/email' },
      ],
    });
  }

  const kpis = [
    { label: 'Modules', value: 10 },
    { label: 'Localisations', value: locationCount },
    { label: 'Équipements', value: equipmentCount },
    { label: 'Équipes', value: teamCount },
  ];

  return (
    <>
      <Header user={user} criticalTicketsCount={criticalCount} />
      <div className="min-h-screen bg-transparent">
        <div className="page-toolbar">
          <div className="page-toolbar-inner">
            <div className="page-toolbar-row">
              <div className="flex items-center gap-3">
                <Link href="/tickets" className="text-xs text-muted hover:text-foreground transition-colors duration-150 ease-out">
                  ← Tickets
                </Link>
                <span className="text-border-default">|</span>
                <h1 className="page-toolbar-title">Backoffice</h1>
                <span className="page-toolbar-subtitle">Gestion de la plateforme</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4 border border-border-default rounded-xl bg-surface shadow-soft-md p-3">
            <p className="text-xs text-muted">
              Réservé aux administrateurs et managers
            </p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-border-default px-3 py-2 bg-surface-alt">
                  <p className="text-[10px] uppercase tracking-wide text-muted">{kpi.label}</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{kpi.value.toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="border border-border-default rounded-xl bg-surface shadow-soft-md">
              <div className="px-4 py-2 border-b border-border-default">
                <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                <p className="text-xs text-muted">{section.description}</p>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group block p-3 border border-border-default rounded-xl bg-surface-alt hover:border-[color:var(--accent)] hover:shadow-soft-md transition-all duration-150 ease-out"
                  >
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-[color:var(--accent)] transition-colors duration-150 ease-out">{item.title}</h3>
                    <p className="text-xs text-muted mt-0.5">{item.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          </div>
        </div>
      </div>
    </>
  );
}
