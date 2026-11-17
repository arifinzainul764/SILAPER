import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  ImagePlus,
  Loader2,
  Lock,
  Sparkles,
  Trash2,
  Unlock,
  UploadCloud,
} from 'lucide-react';
import { compressImageFile } from '../lib/imageUtils';
import { SAMPLE_SPT_EXTRACTED } from '../lib/sampleData';
import { REPORT_FIELD_LIMITS, ReportPhoto, TravelReportData } from '../types/report';

interface ReportFormProps {
  report: TravelReportData;
  isUnlocked: boolean;
  showRequiredErrors?: boolean;
  onToggleUnlock: () => void;
  onChangeField: <K extends keyof TravelReportData>(field: K, value: TravelReportData[K]) => void;
  onApplyExtractedSpt: (extracted: Partial<TravelReportData>, sourceFileName: string) => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  report,
  isUnlocked,
  showRequiredErrors = false,
  onToggleUnlock,
  onChangeField,
  onApplyExtractedSpt,
}) => {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedPdfName, setUploadedPdfName] = useState<string>('');
  const [lastPdfFile, setLastPdfFile] = useState<File | null>(null);
  const [extractStatus, setExtractStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showInstansiSection, setShowInstansiSection] = useState(false);

  const inputBaseClass = isUnlocked
    ? 'w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] transition-colors focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15'
    : 'w-full rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-3 py-2 text-sm text-[#475569] cursor-not-allowed select-none';

  const handlePdfFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setExtractStatus({
        type: 'error',
        message: 'Format file tidak valid. Harap unggah dokumen Surat Perintah Tugas berformat PDF (.pdf).',
      });
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setExtractStatus({
        type: 'error',
        message: 'Ukuran file PDF maksimal 12 MB.',
      });
      return;
    }

    setLastPdfFile(file);
    setUploadedPdfName(file.name);
    setIsExtracting(true);
    setExtractStatus(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 40000);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Gagal membaca file PDF.'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/extract-spt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          pdfBase64: base64,
          fileName: file.name,
        }),
      });

      const rawText = await response.text();
      let payload: { extracted?: Partial<TravelReportData>; error?: string } = {};
      try {
        payload = rawText ? (JSON.parse(rawText) as typeof payload) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(
            payload?.error ||
              'Server AI sedang sibuk (503 UNAVAILABLE). Silakan klik "Coba Lagi" dalam beberapa detik.',
          );
        }
        throw new Error(payload?.error || 'Gagal mengekstrak data dari file PDF SPT.');
      }

      const extracted = (payload.extracted || {}) as Partial<TravelReportData>;
      onApplyExtractedSpt(extracted, file.name);
      setExtractStatus({
        type: 'success',
        message: `Ekstraksi otomatis dari "${file.name}" berhasil. Kolom dikunci untuk mencegah kesalahan ketik.`,
      });
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const msg = isAbort
        ? 'Waktu tunggu ekstraksi habis (melebihi 40 detik) karena koneksi atau server AI padat.'
        : err instanceof Error
          ? err.message
          : 'Gagal memproses file PDF.';
      setExtractStatus({
        type: 'error',
        message: `${msg} Anda dapat menekan "Coba Lagi", menggunakan "Simulasi Ekstraksi SPT", atau klik "Ubah Data" untuk mengisi manual.`,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsExtracting(false);
    }
  };

  const handleSimulatedExtraction = () => {
    setIsExtracting(true);
    setExtractStatus(null);
    const demoFile = 'SPT_800.1.11.1_148_Kec_Cisarua_2026.pdf';
    setUploadedPdfName(demoFile);

    setTimeout(() => {
      onApplyExtractedSpt(SAMPLE_SPT_EXTRACTED, demoFile);
      setIsExtracting(false);
      setExtractStatus({
        type: 'success',
        message: `Simulasi ekstraksi otomatis dari "${demoFile}" selesai. Data dikunci otomatis — klik "Ubah Data" jika ingin menyunting.`,
      });
    }, 550);
  };

  const handlePhotoSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoError(null);

    const remaining = REPORT_FIELD_LIMITS.maxPhotos - report.photos.length;
    if (remaining <= 0) {
      setPhotoError(
        `Batas maksimal ${REPORT_FIELD_LIMITS.maxPhotos} foto dokumentasi sudah tercapai. Hapus salah satu foto terlebih dahulu untuk mengganti.`,
      );
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    const selected = Array.from(files);
    if (selected.length > remaining) {
      setPhotoError(
        `Maksimal 4 foto diperbolehkan. Hanya ${remaining} foto pertama yang dapat ditambahkan.`,
      );
    }

    const allowedFiles = selected.slice(0, remaining);
    const invalidFiles = allowedFiles.filter(
      (f) => f.type !== 'image/jpeg' && f.type !== 'image/png',
    );
    if (invalidFiles.length > 0) {
      setPhotoError(
        'Format foto tidak didukung. Hanya file berformat JPG/JPEG atau PNG yang diperbolehkan.',
      );
    }

    const validImages = allowedFiles.filter(
      (f) => f.type === 'image/jpeg' || f.type === 'image/png',
    );
    if (validImages.length === 0) {
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    setIsProcessingPhoto(true);
    try {
      const processed: ReportPhoto[] = [];
      for (const file of validImages) {
        const dataUrl = await compressImageFile(file);
        processed.push({
          id: `foto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name.slice(0, REPORT_FIELD_LIMITS.photoName),
          caption: '',
          dataUrl,
        });
      }
      onChangeField('photos', [...report.photos, ...processed].slice(0, REPORT_FIELD_LIMITS.maxPhotos));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Gagal memproses foto dokumentasi.');
    } finally {
      setIsProcessingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotoError(null);
    onChangeField(
      'photos',
      report.photos.filter((p) => p.id !== id),
    );
  };

  const handlePhotoCaptionChange = (id: string, caption: string) => {
    onChangeField(
      'photos',
      report.photos.map((p) =>
        p.id === id
          ? { ...p, caption: caption.slice(0, REPORT_FIELD_LIMITS.photoCaption) }
          : p,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* 01. Unggah PDF Surat Perintah Tugas (SPT) */}
      <section className="bg-white border border-[#D8E0EB] rounded-lg p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              01. Unggah PDF Surat Perintah Tugas (SPT)
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Sistem mengekstrak otomatis Nomor SPT, Dasar Hukum, Identitas Pegawai, Tujuan, dan Maksud Perjalanan.
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handlePdfFile(file);
          }}
          className="border border-dashed border-[#94A3B8] bg-[#F8FAFC] rounded-md p-4 text-center transition-colors hover:border-[#0F2A56]"
        >
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePdfFile(file);
              e.target.value = '';
            }}
          />

          <div className="flex flex-col items-center">
            {isExtracting ? (
              <Loader2 className="w-7 h-7 text-[#0F2A56] animate-spin mb-2" />
            ) : (
              <UploadCloud className="w-7 h-7 text-[#0F2A56] mb-2" />
            )}

            <p className="text-sm font-medium text-[#0F172A]">
              {isExtracting
                ? 'Sedang mengekstrak variabel SPT...'
                : uploadedPdfName
                  ? `File terpilih: ${uploadedPdfName}`
                  : 'Seret file PDF SPT ke sini atau pilih dokumen'}
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Format PDF resmi instansi · Ukuran maksimal 12 MB
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                disabled={isExtracting}
                onClick={() => pdfInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Pilih File PDF SPT
              </button>
              <button
                type="button"
                disabled={isExtracting}
                onClick={handleSimulatedExtraction}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2A56] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F1F5F9] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Simulasi Ekstraksi SPT
              </button>
            </div>
          </div>
        </div>

        {extractStatus && (
          <div
            role="status"
            className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs ${
              extractStatus.type === 'success'
                ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]'
                : extractStatus.type === 'error'
                  ? 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]'
                  : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]'
            }`}
          >
            {extractStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-2">
              <span className="block">{extractStatus.message}</span>
              {extractStatus.type === 'error' && lastPdfFile && (
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={() => handlePdfFile(lastPdfFile)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#991B1B] bg-white border border-[#FCA5A5] rounded hover:bg-[#FEE2E2] disabled:opacity-50 transition-colors"
                >
                  Coba Lagi
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 02. Variabel Ekstraksi SPT & Status Kunci */}
      <section className="bg-white border border-[#D8E0EB] rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              02. Data Surat Perintah Tugas & Pelaksana
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              {isUnlocked
                ? 'Mode penyuntingan aktif · Seluruh kolom terbuka untuk penyesuaian manual.'
                : 'Mode terkunci (Read-Only) · Mencegah perubahan atau penghapusan data tidak sengaja.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleUnlock}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              isUnlocked
                ? 'bg-[#0F2A56] text-white hover:bg-[#1E3A8A]'
                : 'bg-[#EFF6FF] text-[#0F2A56] border border-[#BFDBFE] hover:bg-[#DBEAFE]'
            }`}
          >
            {isUnlocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                Kunci Data
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                Ubah Data
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="nomorSpt" className="block text-xs font-medium text-[#334155] mb-1">
              Nomor SPT
            </label>
            <input
              id="nomorSpt"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.nomorSpt}
              value={report.nomorSpt}
              onChange={(e) => onChangeField('nomorSpt', e.target.value)}
              placeholder="Contoh: 800.1.11.1/148/SPT-KEC/XI/2026"
              className={`${inputBaseClass} font-mono-tabular`}
            />
          </div>

          <div>
            <label htmlFor="tanggalSpt" className="block text-xs font-medium text-[#334155] mb-1">
              Tanggal SPT
            </label>
            <input
              id="tanggalSpt"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.tanggalSpt}
              value={report.tanggalSpt}
              onChange={(e) => onChangeField('tanggalSpt', e.target.value)}
              placeholder="Contoh: 12 November 2026"
              className={inputBaseClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="dasarHukum" className="block text-xs font-medium text-[#334155] mb-1">
              Dasar Hukum
            </label>
            <textarea
              id="dasarHukum"
              rows={3}
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.dasarHukum}
              value={report.dasarHukum}
              onChange={(e) => onChangeField('dasarHukum', e.target.value)}
              placeholder="Peraturan, DPA Kecamatan, atau surat undangan terkait..."
              className={inputBaseClass}
            />
          </div>

          <div>
            <label htmlFor="namaPegawai" className="block text-xs font-medium text-[#334155] mb-1">
              Nama Pegawai
            </label>
            <input
              id="namaPegawai"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.namaPegawai}
              value={report.namaPegawai}
              onChange={(e) => onChangeField('namaPegawai', e.target.value)}
              placeholder="Nama lengkap beserta gelar"
              className={inputBaseClass}
            />
          </div>

          <div>
            <label htmlFor="nip" className="block text-xs font-medium text-[#334155] mb-1">
              NIP
            </label>
            <input
              id="nip"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.nip}
              value={report.nip}
              onChange={(e) => onChangeField('nip', e.target.value)}
              placeholder="19840718 201001 1 012"
              className={`${inputBaseClass} font-mono-tabular`}
            />
          </div>

          <div>
            <label htmlFor="pangkatGolongan" className="block text-xs font-medium text-[#334155] mb-1">
              Pangkat / Golongan
            </label>
            <input
              id="pangkatGolongan"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.pangkatGolongan}
              value={report.pangkatGolongan}
              onChange={(e) => onChangeField('pangkatGolongan', e.target.value)}
              placeholder="Penata Tk. I (III/d)"
              className={inputBaseClass}
            />
          </div>

          <div>
            <label htmlFor="jabatan" className="block text-xs font-medium text-[#334155] mb-1">
              Jabatan
            </label>
            <input
              id="jabatan"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.jabatan}
              value={report.jabatan}
              onChange={(e) => onChangeField('jabatan', e.target.value)}
              placeholder="Kepala Seksi Pemerintahan"
              className={inputBaseClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tujuan" className="block text-xs font-medium text-[#334155] mb-1">
              Tujuan Perjalanan Dinas
            </label>
            <input
              id="tujuan"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.tujuan}
              value={report.tujuan}
              onChange={(e) => onChangeField('tujuan', e.target.value)}
              placeholder="Lokasi / Desa / Instansi tujuan"
              className={inputBaseClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="maksudPerjalanan" className="block text-xs font-medium text-[#334155] mb-1">
              Maksud Perjalanan
            </label>
            <textarea
              id="maksudPerjalanan"
              rows={2}
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.maksudPerjalanan}
              value={report.maksudPerjalanan}
              onChange={(e) => onChangeField('maksudPerjalanan', e.target.value)}
              placeholder="Uraian tugas sesuai SPT..."
              className={inputBaseClass}
            />
          </div>

          <div>
            <label htmlFor="tanggalBerangkat" className="block text-xs font-medium text-[#334155] mb-1">
              Tanggal Berangkat
            </label>
            <input
              id="tanggalBerangkat"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.tanggalBerangkat}
              value={report.tanggalBerangkat}
              onChange={(e) => onChangeField('tanggalBerangkat', e.target.value)}
              placeholder="14 November 2026"
              className={inputBaseClass}
            />
          </div>

          <div>
            <label htmlFor="tanggalKembali" className="block text-xs font-medium text-[#334155] mb-1">
              Tanggal Kembali
            </label>
            <input
              id="tanggalKembali"
              type="text"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.tanggalKembali}
              value={report.tanggalKembali}
              onChange={(e) => onChangeField('tanggalKembali', e.target.value)}
              placeholder="14 November 2026"
              className={inputBaseClass}
            />
          </div>
        </div>

        {/* Collapsible Kop Surat & Pejabat Penandatangan */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setShowInstansiSection((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-semibold text-[#0F2A56] py-1 hover:text-[#1E3A8A]"
          >
            <span>Pengaturan Kop Surat Kecamatan & Pejabat Penandatangan</span>
            {showInstansiSection ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showInstansiSection && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="namaKabupaten" className="block text-xs font-medium text-[#334155] mb-1">
                  Nama Pemerintah Kabupaten/Kota
                </label>
                <input
                  id="namaKabupaten"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.namaKabupaten}
                  value={report.namaKabupaten}
                  onChange={(e) => onChangeField('namaKabupaten', e.target.value)}
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label htmlFor="namaKecamatan" className="block text-xs font-medium text-[#334155] mb-1">
                  Nama Kecamatan
                </label>
                <input
                  id="namaKecamatan"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.namaKecamatan}
                  value={report.namaKecamatan}
                  onChange={(e) => onChangeField('namaKecamatan', e.target.value)}
                  className={inputBaseClass}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="alamatKecamatan" className="block text-xs font-medium text-[#334155] mb-1">
                  Alamat & Kontak Kantor Kecamatan
                </label>
                <input
                  id="alamatKecamatan"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.alamatKecamatan}
                  value={report.alamatKecamatan}
                  onChange={(e) => onChangeField('alamatKecamatan', e.target.value)}
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label htmlFor="tempatLaporan" className="block text-xs font-medium text-[#334155] mb-1">
                  Tempat Penetapan Laporan
                </label>
                <input
                  id="tempatLaporan"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.tempatLaporan}
                  value={report.tempatLaporan}
                  onChange={(e) => onChangeField('tempatLaporan', e.target.value)}
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label htmlFor="tanggalLaporan" className="block text-xs font-medium text-[#334155] mb-1">
                  Tanggal Laporan
                </label>
                <input
                  id="tanggalLaporan"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.tanggalLaporan}
                  value={report.tanggalLaporan}
                  onChange={(e) => onChangeField('tanggalLaporan', e.target.value)}
                  placeholder="16 November 2026"
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label htmlFor="namaCamat" className="block text-xs font-medium text-[#334155] mb-1">
                  Nama Camat (Mengetahui)
                </label>
                <input
                  id="namaCamat"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.namaCamat}
                  value={report.namaCamat}
                  onChange={(e) => onChangeField('namaCamat', e.target.value)}
                  className={inputBaseClass}
                />
              </div>

              <div>
                <label htmlFor="nipCamat" className="block text-xs font-medium text-[#334155] mb-1">
                  NIP Camat
                </label>
                <input
                  id="nipCamat"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.nipCamat}
                  value={report.nipCamat}
                  onChange={(e) => onChangeField('nipCamat', e.target.value)}
                  className={`${inputBaseClass} font-mono-tabular`}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="pangkatCamat" className="block text-xs font-medium text-[#334155] mb-1">
                  Pangkat / Golongan Camat
                </label>
                <input
                  id="pangkatCamat"
                  type="text"
                  disabled={!isUnlocked}
                  maxLength={REPORT_FIELD_LIMITS.pangkatCamat}
                  value={report.pangkatCamat}
                  onChange={(e) => onChangeField('pangkatCamat', e.target.value)}
                  className={inputBaseClass}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 03. Isi Laporan Pelaksanaan (Romawi V - VII) */}
      <section className="bg-white border border-[#D8E0EB] rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              03. Uraian Hasil & Penutup (Romawi V – VII)
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              {isUnlocked
                ? 'Lengkapi poin hasil pelaksanaan, kesimpulan, dan kalimat penutup.'
                : 'Klik tombol "Ubah Data" di atas untuk mengisi atau menyunting uraian laporan.'}
            </p>
          </div>
          <span className="text-xs font-medium text-[#DC2626] whitespace-nowrap shrink-0">
            * Wajib diisi
          </span>
        </div>

        <div className="space-y-3.5">
          <div>
            <label htmlFor="hasilPelaksanaan" className="block text-xs font-medium text-[#334155] mb-1">
              V. Hasil Pelaksanaan Kegiatan
              <span className="text-[#DC2626] font-bold ml-1" aria-hidden="true">*</span>
            </label>
            <textarea
              id="hasilPelaksanaan"
              rows={4}
              required
              aria-required="true"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.hasilPelaksanaan}
              value={report.hasilPelaksanaan}
              onChange={(e) => onChangeField('hasilPelaksanaan', e.target.value)}
              placeholder="Tuliskan poin-poin temuan dan capaian kegiatan di lokasi..."
              className={`${inputBaseClass} ${
                showRequiredErrors && !report.hasilPelaksanaan.trim()
                  ? '!border-[#DC2626] ring-1 ring-[#DC2626]/20'
                  : ''
              }`}
            />
            {showRequiredErrors && !report.hasilPelaksanaan.trim() && (
              <p className="text-[11px] text-[#DC2626] mt-1">
                Kolom V. Hasil Pelaksanaan Kegiatan wajib diisi.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="kesimpulanSaran" className="block text-xs font-medium text-[#334155] mb-1">
              VI. Kesimpulan dan Saran
              <span className="text-[#DC2626] font-bold ml-1" aria-hidden="true">*</span>
            </label>
            <textarea
              id="kesimpulanSaran"
              rows={3}
              required
              aria-required="true"
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.kesimpulanSaran}
              value={report.kesimpulanSaran}
              onChange={(e) => onChangeField('kesimpulanSaran', e.target.value)}
              placeholder="Ringkasan hasil serta rekomendasi tindak lanjut..."
              className={`${inputBaseClass} ${
                showRequiredErrors && !report.kesimpulanSaran.trim()
                  ? '!border-[#DC2626] ring-1 ring-[#DC2626]/20'
                  : ''
              }`}
            />
            {showRequiredErrors && !report.kesimpulanSaran.trim() && (
              <p className="text-[11px] text-[#DC2626] mt-1">
                Kolom VI. Kesimpulan dan Saran wajib diisi.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="penutup" className="block text-xs font-medium text-[#334155] mb-1">
              VII. Penutup
            </label>
            <textarea
              id="penutup"
              rows={2}
              disabled={!isUnlocked}
              maxLength={REPORT_FIELD_LIMITS.penutup}
              value={report.penutup}
              onChange={(e) => onChangeField('penutup', e.target.value)}
              className={inputBaseClass}
            />
          </div>
        </div>
      </section>

      {/* 04. Unggah Foto Dokumentasi (Maksimal 4 Foto) */}
      <section
        id="section-foto-dokumentasi"
        className={`bg-white border rounded-lg p-5 transition-colors ${
          showRequiredErrors && report.photos.length === 0
            ? 'border-[#DC2626]'
            : 'border-[#D8E0EB]'
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              04. Foto Dokumentasi Kegiatan
              <span className="text-[#DC2626] font-bold ml-1" aria-hidden="true">*</span>
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Format JPG atau PNG · Minimal 1 dan maksimal 4 foto untuk galeri Lampiran A4.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="block text-xs font-semibold text-[#0F2A56] tabular-nums whitespace-nowrap">
              {report.photos.length} / {REPORT_FIELD_LIMITS.maxPhotos} Foto
            </span>
            <span className="block text-[11px] font-medium text-[#DC2626] whitespace-nowrap">
              * Wajib diisi
            </span>
          </div>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={(e) => handlePhotoSelect(e.target.files)}
        />

        <button
          type="button"
          disabled={isProcessingPhoto || report.photos.length >= REPORT_FIELD_LIMITS.maxPhotos}
          onClick={() => photoInputRef.current?.click()}
          className={`w-full border border-dashed rounded-md py-4 px-4 flex items-center justify-center gap-2.5 text-sm font-medium text-[#0F2A56] hover:border-[#0F2A56] hover:bg-[#EFF6FF]/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
            showRequiredErrors && report.photos.length === 0
              ? 'border-[#DC2626] bg-[#FEF2F2]/50'
              : 'border-[#94A3B8] bg-[#F8FAFC]'
          }`}
        >
          {isProcessingPhoto ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses & Mengompres Foto...
            </>
          ) : report.photos.length >= REPORT_FIELD_LIMITS.maxPhotos ? (
            <>Maksimal 4 Foto Tercapai</>
          ) : (
            <>
              <ImagePlus className="w-4 h-4" />
              Unggah Foto Dokumentasi (JPG/PNG)
            </>
          )}
        </button>

        {showRequiredErrors && report.photos.length === 0 && (
          <p className="text-[11px] text-[#DC2626] mt-2">
            Kolom 04. Foto Dokumentasi Kegiatan wajib diisi (unggah minimal 1 foto).
          </p>
        )}

        {photoError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{photoError}</span>
          </div>
        )}

        {report.photos.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.photos.map((photo, index) => (
              <div
                key={photo.id}
                className="border border-[#E2E8F0] rounded-md p-2.5 bg-[#F8FAFC] flex flex-col gap-2"
              >
                <div className="relative aspect-[4/3] rounded overflow-hidden bg-slate-200 border border-[#E2E8F0]">
                  <img
                    src={photo.dataUrl}
                    alt={photo.caption || `Foto dokumentasi ${index + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo.id)}
                    aria-label={`Hapus foto ${index + 1}`}
                    className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-[#DC2626] text-white rounded hover:bg-[#B91C1C] transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                </div>

                <div className="text-[11px] text-[#64748B] truncate">
                  Foto {index + 1} · {photo.name}
                </div>

                <input
                  type="text"
                  maxLength={REPORT_FIELD_LIMITS.photoCaption}
                  value={photo.caption}
                  onChange={(e) => handlePhotoCaptionChange(photo.id, e.target.value)}
                  placeholder="Keterangan singkat foto..."
                  className="w-full rounded border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] focus:border-[#0F2A56] focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
