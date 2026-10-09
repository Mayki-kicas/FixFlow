export default async function InterventionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold">Intervention {id}</h1>
      <div className="bg-white border border-slate-200 rounded p-3 space-y-3">
        <p className="text-sm">Détail ticket miroir externe (MVP).</p>
        <textarea className="w-full px-3 py-2 text-sm border border-slate-300 rounded" rows={5} placeholder="Ajouter un commentaire..." />
        <input type="file" accept="image/*" multiple className="block w-full text-sm" />
        <button type="button" className="px-3 py-2 text-sm bg-indigo-600 text-white rounded">Envoyer le retour</button>
      </div>
    </section>
  );
}
