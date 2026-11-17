import { TravelReportData } from '../types/report';

export const SAMPLE_SPT_EXTRACTED: Partial<TravelReportData> = {
  namaKabupaten: 'PEMERINTAH KABUPATEN SUKAMAJU',
  namaKecamatan: 'KECAMATAN CISARUA',
  alamatKecamatan:
    'Jl. Raya Cisarua No. 142, Kode Pos 40551, Telp. (022) 2700112, Email: kec.cisarua@sukamaju.go.id',
  nomorSpt: '800.1.11.1/148/SPT-KEC/XI/2026',
  tanggalSpt: '12 November 2026',
  dasarHukum:
    '1. Peraturan Bupati Sukamaju Nomor 24 Tahun 2025 tentang Pedoman Pelaksanaan Perjalanan Dinas di Lingkungan Pemerintah Kabupaten Sukamaju.\n2. Dokumen Pelaksanaan Anggaran (DPA) Kecamatan Cisarua Tahun Anggaran 2026 Kegiatan Pembinaan dan Pengawasan Penyelenggaraan Pemerintahan Desa.\n3. Undangan Rapat Koordinasi dan Evaluasi Pembangunan Infrastruktur Desa Nomor 140/89/Ds-Skm/XI/2026.',
  namaPegawai: 'Raden Ahmad Fauzi, S.Sos., M.AP.',
  nip: '19840718 201001 1 012',
  pangkatGolongan: 'Penata Tk. I (III/d)',
  jabatan: 'Kepala Seksi Pemerintahan Kecamatan Cisarua',
  tujuan: 'Kantor Desa Sukamaju dan Lokasi Pembangunan Drainase RW 04, Kecamatan Cisarua',
  maksudPerjalanan:
    'Melaksanakan Rapat Koordinasi Penyelenggaraan Administrasi Pemerintahan Desa, Monitoring Pelayanan Publik Terpadu, serta Peninjauan Lapangan Progres Pekerjaan Saluran Drainase Jalan Desa Tahun Anggaran 2026.',
  tanggalBerangkat: '14 November 2026',
  tanggalKembali: '14 November 2026',
  hasilPelaksanaan:
    'Kegiatan koordinasi dan monitoring di Desa Sukamaju berjalan lancar.',
  kesimpulanSaran:
    'Pelaksanaan tugas sesuai rencana dan agar segera ditindaklanjuti.',
  tempatLaporan: 'Cisarua',
  tanggalLaporan: '16 November 2026',
  namaCamat: 'H. Dedi Kurniawan, S.STP., M.Si.',
  nipCamat: '19750412 199511 1 001',
  pangkatCamat: 'Pembina Tk. I (IV/b)',
};

export const SAMPLE_FULL_REPORT: TravelReportData = {
  namaKabupaten: SAMPLE_SPT_EXTRACTED.namaKabupaten!,
  namaKecamatan: SAMPLE_SPT_EXTRACTED.namaKecamatan!,
  alamatKecamatan: SAMPLE_SPT_EXTRACTED.alamatKecamatan!,
  nomorSpt: SAMPLE_SPT_EXTRACTED.nomorSpt!,
  tanggalSpt: SAMPLE_SPT_EXTRACTED.tanggalSpt!,
  dasarHukum: SAMPLE_SPT_EXTRACTED.dasarHukum!,
  namaPegawai: SAMPLE_SPT_EXTRACTED.namaPegawai!,
  nip: SAMPLE_SPT_EXTRACTED.nip!,
  pangkatGolongan: SAMPLE_SPT_EXTRACTED.pangkatGolongan!,
  jabatan: SAMPLE_SPT_EXTRACTED.jabatan!,
  tujuan: SAMPLE_SPT_EXTRACTED.tujuan!,
  maksudPerjalanan: SAMPLE_SPT_EXTRACTED.maksudPerjalanan!,
  tanggalBerangkat: SAMPLE_SPT_EXTRACTED.tanggalBerangkat!,
  tanggalKembali: SAMPLE_SPT_EXTRACTED.tanggalKembali!,
  hasilPelaksanaan:
    '1. Rapat Koordinasi di Balai Desa Sukamaju dihadiri oleh Kepala Desa, Sekretaris Desa, Ketua BPD, serta para Kepala Dusun. Evaluasi menunjukkan penyaluran administrasi kependudukan dan pelaporan APBDes semester II telah mencapai progres 92%.\n2. Peninjauan lapangan pada pekerjaan saluran drainase sepanjang 240 meter di RW 04 berjalan sesuai spesifikasi teknis Rencana Anggaran Biaya (RAB), dengan mutu pasangan batu dan aliran pembuangan dalam kondisi baik.\n3. Supervisi pada loket Pelayanan Publik Kantor Desa memastikan seluruh berkas pengantar KTP/KK dan Akta Kelahiran warga dilayani sesuai standar waktu maksimal 15 menit tanpa pungutan liar.',
  kesimpulanSaran:
    'Pelaksanaan penyelenggaraan pemerintahan desa dan pembangunan infrastruktur di Desa Sukamaju berjalan tertib, transparan, dan sesuai jadwal. Disarankan agar Pemerintah Desa segera menuntaskan pelaporan SPJ tahap akhir paling lambat tanggal 25 November 2026 serta melakukan pembersihan rutin saluran drainase menjelang puncak musim hujan.',
  penutup:
    'Demikian laporan hasil pelaksanaan perjalanan dinas ini dibuat dengan sebenar-benarnya sebagai pertanggungjawaban kedinasan. Atas perhatian dan arahan Bapak Camat, kami ucapkan terima kasih.',
  tempatLaporan: SAMPLE_SPT_EXTRACTED.tempatLaporan!,
  tanggalLaporan: SAMPLE_SPT_EXTRACTED.tanggalLaporan!,
  namaCamat: SAMPLE_SPT_EXTRACTED.namaCamat!,
  nipCamat: SAMPLE_SPT_EXTRACTED.nipCamat!,
  pangkatCamat: SAMPLE_SPT_EXTRACTED.pangkatCamat!,
  status: 'draft',
  photos: [
    {
      id: 'sample-foto-1',
      name: 'doc_rapat_koordinasi.jpg',
      caption: 'Rapat Koordinasi dan Evaluasi Administrasi Pemerintahan di Balai Desa Sukamaju.',
      dataUrl: '/src/assets/images/doc_rapat_koordinasi_1794887588403.jpg',
    },
    {
      id: 'sample-foto-2',
      name: 'doc_tinjauan_lapangan.jpg',
      caption: 'Peninjauan lapangan progres konstruksi saluran drainase dan jalan desa bersama perangkat desa.',
      dataUrl: '/src/assets/images/doc_tinjauan_lapangan_1794887588359.jpg',
    },
    {
      id: 'sample-foto-3',
      name: 'doc_pelayanan_warga.jpg',
      caption: 'Supervisi loket Pelayanan Publik administrasi kependudukan (KTP/KK & Akta Lahir) bagi warga.',
      dataUrl: '/src/assets/images/doc_pelayanan_warga_1794887588857.jpg',
    },
    {
      id: 'sample-foto-4',
      name: 'doc_foto_bersama.jpg',
      caption: 'Foto bersama tim monitoring Kecamatan Cisarua dengan Kepala Desa dan perangkat Desa Sukamaju.',
      dataUrl: '/src/assets/images/doc_foto_bersama_1794887589104.jpg',
    },
  ],
};
