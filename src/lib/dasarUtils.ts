import { TravelReportData } from '../types/report';

function stripMarkdownStyling(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:]|$)/g, '$1$2');
}

function stripListPrefix(line: string): string {
  return line.replace(/^\s*(?:(?:\d{1,2}|[a-zA-Z])[.)]\s+|[-•*▪▫]\s+)/, '').trim();
}

/**
 * Membangun daftar poin untuk bagian I. PENDAHULUAN / DASAR.
 * Jika terdapat lebih dari 1 dasar, penomoran otomatis (1., 2., 3., dst.) diaktifkan.
 * Jika hanya ada 1 dasar, ditampilkan sebagai paragraf normal tanpa penomoran.
 */
export function buildPendahuluanDasarItems(
  report: Pick<TravelReportData, 'nomorSpt' | 'tanggalSpt' | 'dasarHukum'>,
): { items: string[]; useNumbering: boolean } {
  const items: string[] = [];
  const cleanNomor = (report.nomorSpt || '').trim();
  const cleanTanggal = (report.tanggalSpt || '').trim();

  if (cleanNomor || cleanTanggal) {
    items.push(
      `Surat Perintah Tugas (SPT) Nomor ${cleanNomor || '-'} tanggal ${cleanTanggal || '-'}.`,
    );
  }

  const rawDasar = stripMarkdownStyling((report.dasarHukum || '').replace(/\r\n/g, '\n')).trim();
  if (rawDasar) {
    const normalizedLines = rawDasar
      .replace(/\s+(?=\d{1,2}[.)]\s+[A-Z])/g, '\n')
      .split('\n')
      .map((line) => stripListPrefix(line))
      .filter(Boolean);

    for (const entry of normalizedLines) {
      const lower = entry.toLowerCase();
      if (
        cleanNomor &&
        lower.includes(cleanNomor.toLowerCase()) &&
        (lower.includes('surat perintah tugas') || lower.includes('spt'))
      ) {
        continue;
      }
      items.push(entry);
    }
  }

  if (items.length === 0) {
    items.push('Surat Perintah Tugas (SPT) Nomor - tanggal -.');
  }

  return {
    items,
    useNumbering: items.length > 1,
  };
}
