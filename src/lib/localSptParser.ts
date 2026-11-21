import { TravelReportData } from '../types/report';

function cleanLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function matchLabelValue(lines: string[], labelRegex: RegExp): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(labelRegex);
    if (!match) continue;

    const afterColon = cleanLine(line.slice(match[0].length).replace(/^[:\s]+/, ''));
    if (afterColon) {
      return afterColon;
    }
    if (i + 1 < lines.length) {
      return cleanLine(lines[i + 1]);
    }
  }
  return '';
}

function clampSingleSentence(text: string, maxChars = 72): string {
  const cleaned = cleanLine(text);
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = (lastSpace > 24 ? slice.slice(0, lastSpace) : slice).replace(/[,;:\s]+$/, '');
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

/**
 * Deterministic structured parser for digital SPT PDF text.
 * Used ONLY when a static-only host does not serve the /api/extract-spt backend route.
 */
export function parseDigitalSptTextLocally(rawText: string): Partial<TravelReportData> {
  const normalized = (rawText || '').replace(/\r\n/g, '\n');
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {};
  }

  // 1. Kop Surat (lines before SURAT PERINTAH TUGAS / NOMOR)
  let sptHeadingIndex = lines.findIndex((line) =>
    /surat\s+perintah\s+tugas|surat\s+tugas/i.test(line),
  );
  if (sptHeadingIndex < 0) {
    sptHeadingIndex = Math.min(8, lines.length);
  }
  const kopLines = lines.slice(0, sptHeadingIndex);

  const namaKabupaten =
    kopLines.find((line) => /pemerintah\s+(kabupaten|kota)/i.test(line)) || '';
  const namaKecamatan =
    kopLines.find((line) =>
      /\b(kecamatan|dinas|badan|kantor|sekretariat)\b/i.test(line) &&
      !/pemerintah\s+(kabupaten|kota)/i.test(line) &&
      !/^(jalan|jl\.?|telp|email|website|laman)/i.test(line),
    ) || '';
  const alamatLines = kopLines.filter(
    (line) =>
      line !== namaKabupaten &&
      line !== namaKecamatan &&
      /(jalan|jl\.?|telp|faksimile|pos-?el|email|laman|website|kode\s*pos)/i.test(line),
  );
  const alamatKecamatan = alamatLines.join('\n');

  // 2. Nomor SPT
  let nomorSpt = '';
  for (let i = Math.max(0, sptHeadingIndex); i < Math.min(lines.length, sptHeadingIndex + 5); i++) {
    const m = lines[i].match(/nomor\s*[:\-]?\s*([A-Za-z0-9./\-_]+)/i);
    if (m && m[1]) {
      nomorSpt = m[1].trim();
      break;
    }
  }

  // 3. Dasar Hukum
  const dasarStart = lines.findIndex((line) => /^dasar\b/i.test(line));
  let dasarHukum = '';
  if (dasarStart >= 0) {
    const dasarEnd = lines.findIndex(
      (line, idx) => idx > dasarStart && /^(memerintahkan|kepada)\b/i.test(line),
    );
    const slice = lines.slice(dasarStart, dasarEnd > dasarStart ? dasarEnd : dasarStart + 6);
    const cleanedDasar = slice
      .map((line, idx) =>
        idx === 0 ? cleanLine(line.replace(/^dasar\s*[:\-]?\s*/i, '')) : cleanLine(line),
      )
      .filter(Boolean);
    dasarHukum = cleanedDasar.join('\n');
  }

  // 4. Pelaksana / Pegawai
  const namaPegawai = matchLabelValue(lines, /^nama\b(?:\s+pegawai)?/i);
  const nipRaw = matchLabelValue(lines, /^n\s*i\s*p\b/i);
  const pangkatGolongan = matchLabelValue(lines, /^pangkat\s*(?:\/|dan)?\s*gol/i);
  const jabatan = matchLabelValue(lines, /^jabatan\b/i);

  // 5. Tujuan, Maksud, Tanggal
  const maksudPerjalanan = matchLabelValue(lines, /^(untuk|maksud|keperluan)\b/i);
  const tujuan = matchLabelValue(lines, /^(tempat(?:\s+tujuan)?|tujuan|lokasi)\b/i);

  const dateMatches = normalized.match(
    /\b\d{1,2}\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}\b/gi,
  );
  const tanggalBerangkat = matchLabelValue(lines, /^tanggal\s*(?:berangkat|mulai|pelaksanaan)\b/i) || (dateMatches?.[0] || '');
  const tanggalKembali = matchLabelValue(lines, /^tanggal\s*(?:kembali|selesai)\b/i) || tanggalBerangkat;

  // 6. Penetapan & Penandatangan (bottom section)
  let tempatLaporan = '';
  let tanggalSpt = '';
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 14); i--) {
    const m = lines[i].match(
      /(?:ditetapkan\s+di\s+)?([A-Za-z.\s]+?)[,\s]+(?:pada\s+tanggal\s+)?(\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4})/i,
    );
    if (m) {
      tempatLaporan = cleanLine(m[1].replace(/^(ditetapkan\s+di|pada\s+tanggal)\s*/i, ''));
      tanggalSpt = cleanLine(m[2]);
      break;
    }
  }

  let nipCamat = '';
  let namaCamat = '';
  let pangkatCamat = '';
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 8); i--) {
    const nipMatch = lines[i].match(/NIP\.?\s*[:\-]?\s*([0-9\s]{8,25})/i);
    if (nipMatch) {
      nipCamat = cleanLine(nipMatch[1]);
      if (i - 1 >= 0) {
        const prevLine = cleanLine(lines[i - 1]);
        if (/^(pembina|penata|pengatur|juru)/i.test(prevLine)) {
          pangkatCamat = prevLine;
          if (i - 2 >= 0) namaCamat = cleanLine(lines[i - 2]);
        } else {
          namaCamat = prevLine;
        }
      }
      break;
    }
  }

  const shortTujuan = (tujuan || '').split(',')[0].trim();
  const hasilPelaksanaan = clampSingleSentence(
    shortTujuan
      ? `Kegiatan di ${shortTujuan} telah dilaksanakan dengan tertib dan lancar.`
      : 'Kegiatan perjalanan dinas sesuai SPT telah dilaksanakan dengan lancar.',
  );
  const kesimpulanSaran = clampSingleSentence(
    shortTujuan
      ? `Pelaksanaan tugas di ${shortTujuan} berjalan sesuai rencana dan tertib.`
      : 'Pelaksanaan tugas berjalan sesuai rencana dan agar segera ditindaklanjuti.',
  );

  const resolvedTanggalBerangkat = tanggalBerangkat || tanggalKembali || tanggalSpt;
  const resolvedTanggalKembali = tanggalKembali || tanggalBerangkat || tanggalSpt;

  return {
    namaKabupaten,
    namaKecamatan,
    alamatKecamatan,
    nomorSpt,
    tanggalSpt,
    dasarHukum,
    namaPegawai,
    nip: nipRaw,
    pangkatGolongan,
    jabatan,
    tujuan,
    maksudPerjalanan,
    tanggalBerangkat: resolvedTanggalBerangkat,
    tanggalKembali: resolvedTanggalKembali,
    hasilPelaksanaan,
    kesimpulanSaran,
    tempatLaporan,
    tanggalLaporan: resolvedTanggalKembali,
    namaCamat,
    nipCamat,
    pangkatCamat,
  };
}
