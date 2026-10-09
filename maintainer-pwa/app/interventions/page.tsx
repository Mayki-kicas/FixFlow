const fakeInterventions = [
  { id: 'ext_tkt_001', title: '193: Probleme imprimante', site: 'Cergy', status: 'Envoye' },
  { id: 'ext_tkt_002', title: '194: Camera entree KO', site: 'Global', status: 'En cours' },
];

export default function InterventionsPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold">Mes interventions</h1>
      <p className="text-xs text-slate-500">MVP PWA: liste branchée sur API externe à implémenter.</p>
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        {fakeInterventions.map((row) => (
          <a key={row.id} href={`/interventions/${row.id}`} className="block px-3 py-2 border-b border-slate-100 hover:bg-slate-50">
            <p className="text-sm font-medium">{row.title}</p>
            <p className="text-xs text-slate-500">{row.site} · {row.status}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
