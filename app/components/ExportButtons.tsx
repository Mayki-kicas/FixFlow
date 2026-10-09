'use client';

import { useState } from 'react';
import {
  exportTicketsToCSV,
  exportEquipmentsToCSV,
  exportLocationsToCSV,
  exportQuotesToCSV,
} from '@/lib/actions/exports';

export default function ExportButtons({ type }: { type: 'tickets' | 'equipments' | 'locations' | 'quotes' }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    try {
      let csvContent: string;
      let filename: string;

      const today = new Date().toISOString().split('T')[0];
      if (type === 'tickets') {
        csvContent = await exportTicketsToCSV();
        filename = `tickets-${today}.csv`;
      } else if (type === 'equipments') {
        csvContent = await exportEquipmentsToCSV();
        filename = `equipments-${today}.csv`;
      } else if (type === 'quotes') {
        csvContent = await exportQuotesToCSV();
        filename = `devis-${today}.csv`;
      } else {
        csvContent = await exportLocationsToCSV();
        filename = `locations-${today}.csv`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (error: any) {
      alert(error.message || 'Erreur lors de l\'export');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      {loading ? 'Export...' : 'Télécharger CSV'}
    </button>
  );
}
