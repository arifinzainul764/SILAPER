export interface ReportPhoto {
  id: string;
  name: string;
  caption: string;
  dataUrl: string;
}

export type ReportStatus = 'draft' | 'final';

export interface TravelReportData {
  namaKabupaten: string;
  namaKecamatan: string;
  alamatKecamatan: string;
  nomorSpt: string;
  tanggalSpt: string;
  dasarHukum: string;
  namaPegawai: string;
  nip: string;
  pangkatGolongan: string;
  jabatan: string;
  tujuan: string;
  maksudPerjalanan: string;
  tanggalBerangkat: string;
  tanggalKembali: string;
  hasilPelaksanaan: string;
  kesimpulanSaran: string;
  penutup: string;
  tempatLaporan: string;
  tanggalLaporan: string;
  namaCamat: string;
  nipCamat: string;
  pangkatCamat: string;
  status: ReportStatus;
  photos: ReportPhoto[];
  logoDataUrl?: string;
  kopBannerDataUrl?: string;
}

export interface StoredTravelReport extends TravelReportData {
  id: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// Volumetric limits synchronized verbatim with firebase-blueprint.json & firestore.rules
export const REPORT_FIELD_LIMITS = {
  namaKabupaten: 160,
  namaKecamatan: 160,
  alamatKecamatan: 250,
  nomorSpt: 120,
  tanggalSpt: 60,
  dasarHukum: 2000,
  namaPegawai: 160,
  nip: 60,
  pangkatGolongan: 100,
  jabatan: 160,
  tujuan: 240,
  maksudPerjalanan: 2000,
  tanggalBerangkat: 60,
  tanggalKembali: 60,
  hasilPelaksanaan: 4000,
  kesimpulanSaran: 2500,
  penutup: 1500,
  tempatLaporan: 120,
  tanggalLaporan: 60,
  namaCamat: 160,
  nipCamat: 60,
  pangkatCamat: 100,
  photoCaption: 240,
  photoName: 160,
  photoId: 64,
  photoDataUrl: 220000,
  logoDataUrl: 220000,
  kopBannerDataUrl: 220000,
  maxPhotos: 4,
} as const;

export function createEmptyReport(): TravelReportData {
  return {
    namaKabupaten: 'PEMERINTAH KABUPATEN SUKAMAJU',
    namaKecamatan: 'KECAMATAN CISARUA',
    alamatKecamatan: 'Jl. Raya Cisarua No. 142, Kode Pos 40551, Telp. (022) 2700112, Email: kec.cisarua@sukamaju.go.id',
    nomorSpt: '',
    tanggalSpt: '',
    dasarHukum: '',
    namaPegawai: '',
    nip: '',
    pangkatGolongan: '',
    jabatan: '',
    tujuan: '',
    maksudPerjalanan: '',
    tanggalBerangkat: '',
    tanggalKembali: '',
    hasilPelaksanaan: '',
    kesimpulanSaran: '',
    penutup:
      'Demikian laporan hasil pelaksanaan perjalanan dinas ini kami sampaikan sebagai bahan pertanggungjawaban dan tindak lanjut pimpinan. Atas perhatian dan arahannya kami ucapkan terima kasih.',
    tempatLaporan: 'Cisarua',
    tanggalLaporan: '',
    namaCamat: 'H. Dedi Kurniawan, S.STP., M.Si.',
    nipCamat: '19750412 199511 1 001',
    pangkatCamat: 'Pembina Tk. I (IV/b)',
    status: 'draft',
    photos: [],
    logoDataUrl: '',
    kopBannerDataUrl: '',
  };
}

export function sanitizeReportForFirestore(
  report: TravelReportData,
  ownerId: string,
): TravelReportData & { ownerId: string } {
  const clamp = (val: string, max: number) => (val || '').trim().slice(0, max);

  return {
    ownerId,
    namaKabupaten: clamp(report.namaKabupaten, REPORT_FIELD_LIMITS.namaKabupaten),
    namaKecamatan: clamp(report.namaKecamatan, REPORT_FIELD_LIMITS.namaKecamatan),
    alamatKecamatan: clamp(report.alamatKecamatan, REPORT_FIELD_LIMITS.alamatKecamatan),
    nomorSpt: clamp(report.nomorSpt || 'DRAFT-SPT', REPORT_FIELD_LIMITS.nomorSpt),
    tanggalSpt: clamp(report.tanggalSpt, REPORT_FIELD_LIMITS.tanggalSpt),
    dasarHukum: clamp(report.dasarHukum, REPORT_FIELD_LIMITS.dasarHukum),
    namaPegawai: clamp(report.namaPegawai || 'Pegawai Kecamatan', REPORT_FIELD_LIMITS.namaPegawai),
    nip: clamp(report.nip, REPORT_FIELD_LIMITS.nip),
    pangkatGolongan: clamp(report.pangkatGolongan, REPORT_FIELD_LIMITS.pangkatGolongan),
    jabatan: clamp(report.jabatan, REPORT_FIELD_LIMITS.jabatan),
    tujuan: clamp(report.tujuan, REPORT_FIELD_LIMITS.tujuan),
    maksudPerjalanan: clamp(report.maksudPerjalanan, REPORT_FIELD_LIMITS.maksudPerjalanan),
    tanggalBerangkat: clamp(report.tanggalBerangkat, REPORT_FIELD_LIMITS.tanggalBerangkat),
    tanggalKembali: clamp(report.tanggalKembali, REPORT_FIELD_LIMITS.tanggalKembali),
    hasilPelaksanaan: clamp(report.hasilPelaksanaan, REPORT_FIELD_LIMITS.hasilPelaksanaan),
    kesimpulanSaran: clamp(report.kesimpulanSaran, REPORT_FIELD_LIMITS.kesimpulanSaran),
    penutup: clamp(report.penutup, REPORT_FIELD_LIMITS.penutup),
    tempatLaporan: clamp(report.tempatLaporan, REPORT_FIELD_LIMITS.tempatLaporan),
    tanggalLaporan: clamp(report.tanggalLaporan, REPORT_FIELD_LIMITS.tanggalLaporan),
    namaCamat: clamp(report.namaCamat, REPORT_FIELD_LIMITS.namaCamat),
    nipCamat: clamp(report.nipCamat, REPORT_FIELD_LIMITS.nipCamat),
    pangkatCamat: clamp(report.pangkatCamat, REPORT_FIELD_LIMITS.pangkatCamat),
    status: report.status === 'final' ? 'final' : 'draft',
    photos: (report.photos || []).slice(0, REPORT_FIELD_LIMITS.maxPhotos).map((p, idx) => ({
      id: clamp(p.id || `foto-${idx + 1}`, REPORT_FIELD_LIMITS.photoId).replace(/[^a-zA-Z0-9_\-]/g, '_'),
      name: clamp(p.name || `dokumentasi_${idx + 1}.jpg`, REPORT_FIELD_LIMITS.photoName),
      caption: clamp(p.caption || '', REPORT_FIELD_LIMITS.photoCaption),
      dataUrl: (p.dataUrl || '').slice(0, REPORT_FIELD_LIMITS.photoDataUrl),
    })),
    logoDataUrl: (report.logoDataUrl || '').slice(0, REPORT_FIELD_LIMITS.logoDataUrl),
    kopBannerDataUrl: (report.kopBannerDataUrl || '').slice(0, REPORT_FIELD_LIMITS.kopBannerDataUrl),
  };
}

export const ADMIN_EMAIL = 'arifinzainul764@gmail.com';

export const STAFF_FIELD_LIMITS = {
  email: 180,
  displayName: 120,
  jabatan: 160,
  nip: 60,
  nipKey: 60,
  passwordMin: 6,
  passwordMax: 128,
} as const;

export interface AuthorizedStaff {
  id: string;
  nip: string;
  nipKey: string;
  displayName: string;
  jabatan: string;
  passwordSalt: string;
  passwordHash: string;
  email: string;
  active: boolean;
  addedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}
