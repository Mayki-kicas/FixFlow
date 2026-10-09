'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createIncidentReport,
  updateIncidentReport,
  deleteIncidentReport,
} from '@/lib/actions/incidentReports';

type Location = {
  id: string;
  name: string;
  code: string;
};

type IncidentReportFormProps = {
  report?: {
    id: string;
    reportType: 'INCIDENT' | 'INTERVENTION';
    dateTime: Date;
    subject: string | null;
    description: string | null;
    company: string | null;
    interventionReason: string | null;
    requestedBy: string | null;
    intervenedBy: string | null;
    resolutionTime: string | null;
    personsInvolved: string | null;
    correctiveActions: string | null;
    notes: string | null;
    locationId: string | null;
  };
  locations: Location[];
};

function formatDateTimeLocal(date: Date): string {
  const d = new Date(date);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUtcIsoFromLocalInput(localDateTime: string): string {
  // `datetime-local` is timezone-less; convert in browser context to ISO UTC
  // so server timezone does not shift the saved hour.
  return new Date(localDateTime).toISOString();
}

export default function IncidentReportForm({ report, locations }: IncidentReportFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    reportType: report?.reportType || 'INCIDENT',
    dateTime: report ? formatDateTimeLocal(report.dateTime) : '',
    subject: report?.subject || '',
    description: report?.description || '',
    company: report?.company || '',
    interventionReason: report?.interventionReason || '',
    requestedBy: report?.requestedBy || '',
    intervenedBy: report?.intervenedBy || '',
    resolutionTime: report?.resolutionTime || '',
    personsInvolved: report?.personsInvolved || '',
    correctiveActions: report?.correctiveActions || '',
    notes: report?.notes || '',
    locationId: report?.locationId || '',
  });

  const isIntervention = formData.reportType === 'INTERVENTION';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'reportType') {
      if (value === 'INTERVENTION') {
        setFormData((prev) => ({
          ...prev,
          reportType: 'INTERVENTION',
          subject: '',
          description: '',
          resolutionTime: '',
          personsInvolved: '',
          correctiveActions: '',
          locationId: '',
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          reportType: 'INCIDENT',
          company: '',
          interventionReason: '',
          requestedBy: '',
          intervenedBy: '',
        }));
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        reportType: formData.reportType,
        dateTime: toUtcIsoFromLocalInput(formData.dateTime),
        subject: formData.subject || undefined,
        description: formData.description || undefined,
        company: formData.company || undefined,
        interventionReason: formData.interventionReason || undefined,
        requestedBy: formData.requestedBy || undefined,
        intervenedBy: formData.intervenedBy || undefined,
        resolutionTime: formData.resolutionTime || undefined,
        personsInvolved: formData.personsInvolved || undefined,
        correctiveActions: formData.correctiveActions || undefined,
        notes: formData.notes || undefined,
        locationId: formData.locationId || undefined,
      } as const;

      if (report) {
        await updateIncidentReport({ id: report.id, ...payload });
      } else {
        await createIncidentReport(payload);
      }

      router.push('/backoffice/incident-reports');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!report) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) return;

    setError(null);
    setLoading(true);
    try {
      await deleteIncidentReport(report.id);
      router.push('/backoffice/incident-reports');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer');
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-1.5 text-sm border border-border-default rounded-lg bg-surface text-foreground transition-colors focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[#e8513b]/25 focus:outline-none';
  const labelClass = 'block text-xs font-medium text-foreground mb-1 uppercase tracking-wide';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${isIntervention ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
        <div>
          <label htmlFor="reportType" className={labelClass}>
            Type de rapport *
          </label>
          <select
            id="reportType"
            name="reportType"
            value={formData.reportType}
            onChange={handleChange}
            className={inputClass}
            disabled={loading}
          >
            <option value="INCIDENT">Incident</option>
            <option value="INTERVENTION">Intervention</option>
          </select>
        </div>

        <div>
          <label htmlFor="dateTime" className={labelClass}>
            Date et heure *
          </label>
          <input
            type="datetime-local"
            id="dateTime"
            name="dateTime"
            required
            value={formData.dateTime}
            onChange={handleChange}
            className={inputClass}
            disabled={loading}
          />
        </div>

        {!isIntervention && (
          <div>
            <label htmlFor="locationId" className={labelClass}>
              Localisation
            </label>
            <select
              id="locationId"
              name="locationId"
              value={formData.locationId}
              onChange={handleChange}
              className={inputClass}
              disabled={loading}
            >
              <option value="">-- Aucune --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} - {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isIntervention ? (
        <>
          <div>
            <label htmlFor="company" className={labelClass}>
              Entreprise *
            </label>
            <input
              type="text"
              id="company"
              name="company"
              required={isIntervention}
              value={formData.company}
              onChange={handleChange}
              placeholder="Ex: Société ABC Maintenance"
              className={inputClass}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="interventionReason" className={labelClass}>
              Raison *
            </label>
            <textarea
              id="interventionReason"
              name="interventionReason"
              required={isIntervention}
              rows={2}
              value={formData.interventionReason}
              onChange={handleChange}
              placeholder="Pourquoi l'intervention est nécessaire..."
              className={`${inputClass} resize-none`}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="requestedBy" className={labelClass}>
                Demandée par *
              </label>
              <input
                type="text"
                id="requestedBy"
                name="requestedBy"
                required={isIntervention}
                value={formData.requestedBy}
                onChange={handleChange}
                placeholder="Nom du demandeur"
                className={inputClass}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="intervenedBy" className={labelClass}>
                Intervenant *
              </label>
              <input
                type="text"
                id="intervenedBy"
                name="intervenedBy"
                required={isIntervention}
                value={formData.intervenedBy}
                onChange={handleChange}
                placeholder="Nom de l'intervenant"
                className={inputClass}
                disabled={loading}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="subject" className={labelClass}>
              Objet du rapport *
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              required={!isIntervention}
              value={formData.subject}
              onChange={handleChange}
              placeholder="Ex: Panne onduleur, fuite d'eau..."
              className={inputClass}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              required={!isIntervention}
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Décrivez le contexte et les faits..."
              className={`${inputClass} resize-none`}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="resolutionTime" className={labelClass}>
                Temps de résolution
              </label>
              <input
                type="text"
                id="resolutionTime"
                name="resolutionTime"
                value={formData.resolutionTime}
                onChange={handleChange}
                placeholder="Ex: 45 minutes, 2 heures..."
                className={inputClass}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="personsInvolved" className={labelClass}>
                Personnes impliquées
              </label>
              <input
                type="text"
                id="personsInvolved"
                name="personsInvolved"
                value={formData.personsInvolved}
                onChange={handleChange}
                placeholder="Noms des personnes concernées..."
                className={inputClass}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="correctiveActions" className={labelClass}>
              Actions menées
            </label>
            <textarea
              id="correctiveActions"
              name="correctiveActions"
              rows={2}
              value={formData.correctiveActions}
              onChange={handleChange}
              placeholder="Mesures prises, opérations réalisées..."
              className={`${inputClass} resize-none`}
              disabled={loading}
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor="notes" className={labelClass}>
          Notes supplémentaires
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          value={formData.notes}
          onChange={handleChange}
          placeholder="Remarques, recommandations..."
          className={`${inputClass} resize-none`}
          disabled={loading}
        />
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-border-default">
        <div>
          {report && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Supprimer
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/backoffice/incident-reports')}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-border-default text-foreground rounded-lg transition-colors hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium bg-[color:var(--primary)] text-[color:var(--surface)] rounded-lg transition-colors hover:bg-[color:var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && (
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {loading ? 'Enregistrement...' : report ? 'Mettre à jour' : 'Créer le rapport'}
          </button>
        </div>
      </div>
    </form>
  );
}
