import QRCode from 'qrcode';

// URL de scan d'un équipement (page mobile accessible après authentification).
export function equipmentScanUrl(refCode: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return `${base}/equipements/${encodeURIComponent(refCode)}`;
}

// QR code (PNG data URL) pointant vers la page de scan de l'équipement.
export async function generateEquipmentQrDataUrl(refCode: string): Promise<string> {
  return QRCode.toDataURL(equipmentScanUrl(refCode), { margin: 1, width: 256, errorCorrectionLevel: 'M' });
}
