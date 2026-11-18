import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileDown,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { exportReportToDocx } from '../lib/exportDocx';
import { exportReportToPdf } from '../lib/exportPdf';
import {
  dataUrlToPdfBlob,
  formatPdfFileSize,
  getSuratDasarPdf,
} from '../lib/suratDasarStorage';
import { A4Preview } from './A4Preview';
import {
  REPORT_FIELD_LIMITS,
  ReportStatus,
  StoredTravelReport,
  normalizeReportStatus,
} from '../types/report';

interface ArchivePanelProps {
  user: User | null;
  authReady: boolean;
  isTempAdmin?: boolean;
  isOperator?: boolean;
  hasLocalSession?: boolean;
  canVerifyReports?: boolean;
  currentOwnerId?: string;
  reports: StoredTravelReport[];
  loadingReports: boolean;
  activeReportId: string | null;
  onLoadReport: (report: StoredTravelReport) => void;
  onChangeReportStatus: (
    report: StoredTravelReport,
    nextStatus: ReportStatus,
    catatanVerifikasi?: string,
  ) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
  onCreateNewReport: () => void;
}

export const ArchivePanel: React.FC<ArchivePanelProps> = ({
  user,
  authReady,
  isTempAdmin = false,
  isOperator = false,
  hasLocalSession = false,
  canVerifyReports = false,
  currentOwnerId,
  reports,
  loadingReports,
  activeReportId,
  onLoadReport,
  onChangeReportStatus,
  onDeleteReport,
  onCreateNewReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Verification modal states
  const [verifyingReport, setVerifyingReport] = useState<StoredTravelReport | null>(null);
  const [verificationNote, setVerificationNote] = useState<string>('');
  const [sptPdfUrl, setSptPdfUrl] = useState<string>('');
  const [dasarPdfUrl, setDasarPdfUrl] = useState<string>('');
  const [previewPdfTarget, setPreviewPdfTarget] = useState<'spt' | 'dasar' | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState<boolean>(false);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState<boolean>(false);

  // Modal A4 preview zoom & export states
  const [previewZoom, setPreviewZoom] = useState<number>(0.78);
  const [isAutoFitZoom, setIsAutoFitZoom] = useState<boolean>(true);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);

  const computeAutoFitZoom = useCallback(() => {
    const wrapper = previewWrapperRef.current;
    const content = previewContentRef.current;
    if (!wrapper || !content || content.offsetWidth === 0) return;
    const style = window.getComputedStyle(wrapper);
    const padX =
      (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const availableWidth = Math.max(240, wrapper.clientWidth - padX - 8);
    const fitted = Math.min(1.05, Math.max(0.35, availableWidth / content.offsetWidth));
    setPreviewZoom(Math.round(fitted * 100) / 100);
  }, []);

  useEffect(() => {
    if (!verifyingReport) return;
    const el = previewContentRef.current;
    const wrapper = previewWrapperRef.current;
    if (!el) return;

    const updateSize = () => {
      setPreviewSize({
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
      if (isAutoFitZoom) {
        computeAutoFitZoom();
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    if (wrapper) {
      observer.observe(wrapper);
    }
    return () => observer.disconnect();
  }, [verifyingReport, isAutoFitZoom, computeAutoFitZoom]);

  useEffect(() => {
    if (!verifyingReport) {
      setSptPdfUrl('');
      setDasarPdfUrl('');
      setPreviewPdfTarget(null);
      return;
    }

    let active = true;
    const urlsToRevoke: string[] = [];

    const resolveBlobUrl = async (id?: string, fallbackDataUrl?: string): Promise<string> => {
      if (id) {
        const stored = await getSuratDasarPdf(
          id,
          currentOwnerId,
          canVerifyReports,
        );
        if (stored?.blob) {
          const url = URL.createObjectURL(stored.blob);
          urlsToRevoke.push(url);
          return url;
        }
      }
      const fallbackBlob = dataUrlToPdfBlob(fallbackDataUrl);
      if (fallbackBlob) {
        const url = URL.createObjectURL(fallbackBlob);
        urlsToRevoke.push(url);
        return url;
      }
      return '';
    };

    const loadFiles = async () => {
      setLoadingAttachments(true);
      try {
        const [resolvedSpt, resolvedDasar] = await Promise.all([
          resolveBlobUrl(verifyingReport.sptPdfId, verifyingReport.sptPdfDataUrl),
          resolveBlobUrl(
            verifyingReport.suratDasarPdfId,
            verifyingReport.suratDasarPdfDataUrl,
          ),
        ]);
        if (!active) return;
        setSptPdfUrl(resolvedSpt);
        setDasarPdfUrl(resolvedDasar);
        if (resolvedSpt) {
          setPreviewPdfTarget('spt');
        } else if (resolvedDasar) {
          setPreviewPdfTarget('dasar');
        } else {
          setPreviewPdfTarget(null);
        }
      } finally {
        if (active) setLoadingAttachments(false);
      }
    };

    void loadFiles();

    return () => {
      active = false;
      for (const u of urlsToRevoke) {
        URL.revokeObjectURL(u);
      }
    };
  }, [verifyingReport, currentOwnerId, canVerifyReports]);

  const handleOpenVerificationModal = (item: StoredTravelReport) => {
    setVerifyingReport(item);
    setVerificationNote(item.catatanVerifikasi || '');
    setIsAutoFitZoom(true);
    setExportFeedback(null);
  };

  const handleCloseVerificationModal = () => {
    if (isSubmittingVerification) return;
    setVerifyingReport(null);
    setVerificationNote('');
    setExportFeedback(null);
  };

  const handleDownloadDocx = async () => {
    if (!verifyingReport) return;
    setIsExportingDocx(true);
    setExportFeedback(null);
    try {
      await exportReportToDocx(verifyingReport);
      setExportFeedback({
        type: 'success',
        message: 'Dokumen Word (.DOCX) berhasil diunduh.',
      });
    } catch (err) {
      setExportFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal mengunduh dokumen Word (.DOCX).',
      });
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!verifyingReport) return;
    setIsExportingPdf(true);
    setExportFeedback(null);
    try {
      await exportReportToPdf(verifyingReport);
      setExportFeedback({
        type: 'success',
        message: 'Dokumen PDF (.PDF) berhasil diunduh.',
      });
    } catch (err) {
      setExportFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal mengunduh dokumen PDF (.PDF).',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleApplyVerificationDecision = async (nextStatus: ReportStatus) => {
    if (!verifyingReport) return;
    setIsSubmittingVerification(true);
    try {
      await onChangeReportStatus(verifyingReport, nextStatus, verificationNote.trim());
      setVerifyingReport(null);
      setVerificationNote('');
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      const normalized = normalizeReportStatus(r.status);
      if (statusFilter !== 'all' && normalized !== statusFilter) return false;
      if (!q) return true;
      return (
        r.nomorSpt.toLowerCase().includes(q) ||
        r.namaPegawai.toLowerCase().includes(q) ||
        r.tujuan.toLowerCase().includes(q) ||
        r.namaKecamatan.toLowerCase().includes(q) ||
        (r.nip || '').toLowerCase().includes(q)
      );
    });
  }, [reports, searchQuery, statusFilter]);

  if (!authReady) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-6">
        <div className="bg-white border border-[#D8E0EB] rounded-lg p-8 text-center text-sm text-[#475569]">
          Memeriksa sesi autentikasi pengguna...
        </div>
      </div>
    );
  }

  const isLocalAuthorized = isTempAdmin || isOperator || hasLocalSession;

  if (!user && !isLocalAuthorized) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6">
        <div className="bg-white border border-[#D8E0EB] rounded-lg p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#0F2A56]">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-[#0F172A]">
            Arsip Laporan Rahasia Kecamatan
          </h2>
          <p className="text-sm text-[#475569] mt-2 leading-relaxed">
            Untuk menjaga kerahasiaan data perjalanan dinas, NIP pegawai, dan lampiran dokumentasi instansi, arsip laporan hanya dapat diakses menggunakan akun yang dibuat oleh Administrator Kecamatan Tarik.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="bg-white border border-[#D8E0EB] rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Daftar Surat Perjalanan Dinas (SPD)
            </h2>
            {canVerifyReports ? (
              <p className="text-xs text-[#475569] mt-0.5">
                Mode Verifikasi Aktif · Periksa berkas pengajuan (SPT/SPD berstempel, Surat Dasar, Foto) dan tetapkan status SPD.
              </p>
            ) : (
              <p className="text-xs text-[#475569] mt-0.5">
                Menampilkan khusus daftar pengajuan dan berkas SPD milik akun Anda sendiri.
              </p>
            )}
          </div>

          {!isOperator && (
            <button
              type="button"
              onClick={onCreateNewReport}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Buat Laporan/Ajukan SPD Baru
            </button>
          )}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Nomor SPT, Nama Pegawai, NIP, atau Tujuan..."
              className="w-full rounded-md border border-[#CBD5E1] bg-white pl-9 pr-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F1F5F9] rounded-md">
            {(['all', 'diajukan', 'diterima', 'ditolak'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {tab === 'all'
                  ? 'Semua'
                  : tab === 'diajukan'
                    ? 'Diajukan'
                    : tab === 'diterima'
                      ? 'Diterima'
                      : 'Ditolak'}
              </button>
            ))}
          </div>
        </div>

        {/* Table / List */}
        {loadingReports ? (
          <div className="py-12 text-center text-sm text-[#64748B]">
            Memuat arsip laporan terenkripsi...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-14 text-center">
            <FolderOpen className="w-9 h-9 text-[#94A3B8] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#0F172A]">
              {reports.length === 0
                ? 'Belum ada laporan tersimpan di arsip Anda.'
                : 'Tidak ada laporan yang cocok dengan filter pencarian.'}
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              {isOperator
                ? 'Daftar pengajuan SPD dari seluruh staf akan tampil di tabel ini untuk diverifikasi berkas dan statusnya.'
                : (
                  <>
                    Klik tombol &ldquo;Buat Laporan/Ajukan SPD Baru&rdquo; di atas untuk menyusun laporan lalu tekan &ldquo;Ajukan SPD&rdquo;.
                  </>
                )}
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                  <th className="py-3 pr-4">Nomor SPT &amp; Berkas</th>
                  <th className="py-3 pr-4">Pelaksana &amp; Tujuan</th>
                  <th className="py-3 pr-4">Tanggal</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {filteredReports.map((item) => {
                  const isCurrent = item.id === activeReportId;
                  const isBusy = busyId === item.id;
                  const normalizedStatus = normalizeReportStatus(item.status);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#F8FAFC] transition-colors ${
                        isCurrent ? 'bg-[#EFF6FF]/50' : ''
                      }`}
                    >
                      <td className="py-3.5 pr-4 align-top">
                        <div className="font-mono-tabular text-xs font-semibold text-[#0F2A56]">
                          {item.nomorSpt}
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5 space-y-0.5">
                          <div>{item.photos?.length || 0} foto dokumentasi</div>
                          {item.sptPdfName && (
                            <div className="text-[#334155] truncate max-w-[240px]">
                              SPT/SPD: {item.sptPdfName}
                            </div>
                          )}
                          {item.suratDasarPdfName && (
                            <div className="truncate max-w-[240px]">
                              Surat Dasar: {item.suratDasarPdfName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 align-top">
                        <div className="font-medium text-[#0F172A]">{item.namaPegawai}</div>
                        {item.nip && (
                          <div className="text-[11px] font-mono-tabular text-[#64748B]">
                            NIP. {item.nip}
                          </div>
                        )}
                        <div className="text-xs text-[#475569] mt-0.5 line-clamp-1">
                          {item.tujuan || '-'}
                        </div>
                        {item.catatanVerifikasi && (
                          <div className="mt-1 text-[11px] text-[#334155] bg-[#F8FAFC] border border-[#E2E8F0] rounded px-2 py-1">
                            Catatan: {item.catatanVerifikasi}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 align-top text-xs text-[#475569] whitespace-nowrap tabular-nums">
                        {item.tanggalLaporan || item.tanggalSpt || '-'}
                      </td>
                      <td className="py-3.5 pr-4 align-top text-xs whitespace-nowrap">
                        {normalizedStatus === 'diterima' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F0FDF4] border border-[#BBF7D0] font-semibold text-[#15803D]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Diterima
                          </span>
                        ) : normalizedStatus === 'ditolak' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FEF2F2] border border-[#FECACA] font-semibold text-[#B91C1C]">
                            <XCircle className="w-3.5 h-3.5" />
                            Ditolak
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FFFBEB] border border-[#FDE68A] font-semibold text-[#B45309]">
                            <Clock className="w-3.5 h-3.5" />
                            Diajukan
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 align-top text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {canVerifyReports && (
                            <button
                              type="button"
                              onClick={() => handleOpenVerificationModal(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2A56] rounded hover:bg-[#1E3A8A] transition-colors whitespace-nowrap"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              Verifikasi Berkas
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onLoadReport(item)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
                          >
                            Buka di Editor
                          </button>

                          {canVerifyReports && (
                            <select
                              aria-label={`Ubah status ${item.nomorSpt}`}
                              disabled={isBusy}
                              value={normalizedStatus}
                              onChange={async (e) => {
                                const nextStatus = e.target.value as ReportStatus;
                                if (nextStatus === normalizedStatus) return;
                                setBusyId(item.id);
                                try {
                                  await onChangeReportStatus(item, nextStatus);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium text-[#334155] bg-white border border-[#CBD5E1] rounded hover:bg-[#F8FAFC] focus:border-[#0F2A56] focus:outline-none disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              <option value="diajukan">Diajukan</option>
                              <option value="diterima">Diterima</option>
                              <option value="ditolak">Ditolak</option>
                            </select>
                          )}

                          {confirmDeleteId === item.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(item.id);
                                  try {
                                    await onDeleteReport(item.id);
                                    setConfirmDeleteId(null);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-[#DC2626] rounded hover:bg-[#B91C1C]"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 text-xs text-[#475569] hover:text-[#0F172A]"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              aria-label={`Hapus laporan ${item.nomorSpt}`}
                              className="p-1.5 text-[#64748B] hover:text-[#DC2626] rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Verifikasi Pengajuan SPD & Berkas */}
      {verifyingReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-spd-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 sm:p-5 overflow-y-auto"
        >
          <div className="w-full max-w-5xl bg-white border border-[#D8E0EB] rounded-lg shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between gap-3 bg-[#F8FAFC]">
              <div className="min-w-0">
                <h3
                  id="verify-spd-modal-title"
                  className="text-base font-bold text-[#0F172A]"
                >
                  Verifikasi Pengajuan &amp; Berkas SPD
                </h3>
                <p className="text-xs text-[#475569] mt-0.5 font-mono-tabular">
                  SPT Nomor: {verifyingReport.nomorSpt} · Pelaksana: {verifyingReport.namaPegawai}
                </p>
              </div>
              <button
                type="button"
                disabled={isSubmittingVerification}
                onClick={handleCloseVerificationModal}
                aria-label="Tutup panel verifikasi"
                className="p-1.5 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* 1. Live Preview Dokumen Resmi (Kertas A4) & Unduh */}
              <div className="border border-[#E2E8F0] rounded-md p-4 bg-[#F8FAFC] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-[#0F2A56]">
                      Live Preview Dokumen Resmi (Kertas A4)
                    </h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      2 Halaman · Kop Surat Kecamatan + Lampiran Dokumentasi ({verifyingReport.photos?.length || 0}/4)
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Zoom Controls */}
                    <div
                      role="group"
                      aria-label="Kontrol zoom pratinjau dokumen"
                      className="inline-flex items-center bg-white border border-[#CBD5E1] rounded-md overflow-hidden shrink-0"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsAutoFitZoom(false);
                          setPreviewZoom((prev) => Math.max(0.35, Math.round((prev - 0.1) * 100) / 100));
                        }}
                        disabled={previewZoom <= 0.35}
                        aria-label="Perkecil pratinjau dokumen"
                        title="Perkecil"
                        className="px-2 py-1.5 text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F2A56] disabled:opacity-40 transition-colors"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAutoFitZoom(false);
                          setPreviewZoom(1);
                        }}
                        title="Reset zoom ke 100%"
                        className="px-2 py-1.5 min-w-[48px] text-center text-xs font-semibold font-mono-tabular text-[#0F172A] border-x border-[#E2E8F0] hover:bg-[#EFF6FF]"
                      >
                        {Math.round(previewZoom * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAutoFitZoom(false);
                          setPreviewZoom((prev) => Math.min(1.5, Math.round((prev + 0.1) * 100) / 100));
                        }}
                        disabled={previewZoom >= 1.5}
                        aria-label="Perbesar pratinjau dokumen"
                        title="Perbesar"
                        className="px-2 py-1.5 text-[#334155] hover:bg-[#F1F5F9] hover:text-[#0F2A56] disabled:opacity-40 transition-colors"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAutoFitZoom(true);
                          computeAutoFitZoom();
                        }}
                        className={`px-2 py-1.5 text-[11px] font-medium border-l border-[#E2E8F0] whitespace-nowrap ${
                          isAutoFitZoom
                            ? 'bg-[#EFF6FF] text-[#0F2A56] font-semibold'
                            : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#EFF6FF]'
                        }`}
                      >
                        Pas Lebar
                      </button>
                    </div>

                    {/* Download Buttons */}
                    <button
                      type="button"
                      disabled={isExportingDocx}
                      onClick={() => void handleDownloadDocx()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1E3A8A] rounded-md hover:bg-[#172554] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    >
                      {isExportingDocx ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      Unduh ke Word (.DOCX)
                    </button>

                    <button
                      type="button"
                      disabled={isExportingPdf}
                      onClick={() => void handleDownloadPdf()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#0A1E40] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                    >
                      {isExportingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5" />
                      )}
                      Unduh ke PDF (.PDF)
                    </button>
                  </div>
                </div>

                {exportFeedback && (
                  <div
                    role="status"
                    className={`px-3 py-2 rounded border text-xs font-medium ${
                      exportFeedback.type === 'success'
                        ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                        : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                    }`}
                  >
                    {exportFeedback.message}
                  </div>
                )}

                <div
                  ref={previewWrapperRef}
                  className="a4-sheet-wrapper bg-[#E2E8F0] border border-[#CBD5E1] rounded-md p-3 sm:p-4 max-h-[52vh] overflow-auto"
                >
                  <div
                    className="preview-zoom-box mx-auto"
                    style={{
                      width: previewSize.width ? `${previewSize.width * previewZoom}px` : undefined,
                      height: previewSize.height ? `${previewSize.height * previewZoom}px` : undefined,
                    }}
                  >
                    <div
                      ref={previewContentRef}
                      className="preview-zoom-stage origin-top-left w-fit"
                      style={{ transform: `scale(${previewZoom})` }}
                    >
                      <A4Preview report={verifyingReport} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Kelengkapan Berkas PDF (SPT + SPD Berstempel & Surat Dasar) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wide text-[#0F2A56]">
                  Pemeriksaan Berkas Lampiran
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Card File SPT & SPD Berstempel */}
                  <div className="border border-[#CBD5E1] rounded-md p-3.5 bg-white flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                        <FileText className="w-4 h-4 text-[#0F2A56] shrink-0" />
                        <span>01. File PDF SPT (beserta SPD berstempel)</span>
                      </div>
                      <p className="text-xs text-[#475569] mt-1.5 break-words">
                        {verifyingReport.sptPdfName
                          ? `${verifyingReport.sptPdfName}${
                              verifyingReport.sptPdfSize
                                ? ` (${formatPdfFileSize(verifyingReport.sptPdfSize)})`
                                : ''
                            }`
                          : 'Belum ada file PDF SPT tersimpan pada pengajuan ini.'}
                      </p>
                    </div>

                    {loadingAttachments ? (
                      <span className="text-[11px] text-[#64748B]">Memuat berkas...</span>
                    ) : sptPdfUrl ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPdfTarget((prev) => (prev === 'spt' ? null : 'spt'))
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors ${
                            previewPdfTarget === 'spt'
                              ? 'bg-[#0F2A56] text-white border-[#0F2A56]'
                              : 'bg-[#EFF6FF] text-[#0F2A56] border-[#BFDBFE] hover:bg-[#DBEAFE]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {previewPdfTarget === 'spt' ? 'Tutup Pratinjau' : 'Pratinjau PDF'}
                        </button>
                        <a
                          href={sptPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0F2A56] bg-white border border-[#CBD5E1] rounded hover:bg-[#F8FAFC]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Tab Baru
                        </a>
                        <a
                          href={sptPdfUrl}
                          download={verifyingReport.sptPdfName || 'spt-spd.pdf'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0F2A56] bg-white border border-[#CBD5E1] rounded hover:bg-[#F8FAFC]"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Unduh
                        </a>
                      </div>
                    ) : verifyingReport.sptPdfName ? (
                      <p className="text-[11px] text-[#B45309]">
                        File berukuran besar tersimpan pada penyimpanan lokal perangkat pengaju.
                      </p>
                    ) : null}
                  </div>

                  {/* Card File Surat Dasar */}
                  <div className="border border-[#CBD5E1] rounded-md p-3.5 bg-white flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                        <FileText className="w-4 h-4 text-[#0F2A56] shrink-0" />
                        <span>02. File PDF Surat Dasar (Opsional)</span>
                      </div>
                      <p className="text-xs text-[#475569] mt-1.5 break-words">
                        {verifyingReport.suratDasarPdfName
                          ? `${verifyingReport.suratDasarPdfName}${
                              verifyingReport.suratDasarPdfSize
                                ? ` (${formatPdfFileSize(verifyingReport.suratDasarPdfSize)})`
                                : ''
                            }`
                          : 'Tidak dilampirkan (opsional).'}
                      </p>
                    </div>

                    {loadingAttachments ? (
                      <span className="text-[11px] text-[#64748B]">Memuat berkas...</span>
                    ) : dasarPdfUrl ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPdfTarget((prev) => (prev === 'dasar' ? null : 'dasar'))
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors ${
                            previewPdfTarget === 'dasar'
                              ? 'bg-[#0F2A56] text-white border-[#0F2A56]'
                              : 'bg-[#EFF6FF] text-[#0F2A56] border-[#BFDBFE] hover:bg-[#DBEAFE]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {previewPdfTarget === 'dasar' ? 'Tutup Pratinjau' : 'Pratinjau PDF'}
                        </button>
                        <a
                          href={dasarPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0F2A56] bg-white border border-[#CBD5E1] rounded hover:bg-[#F8FAFC]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Tab Baru
                        </a>
                        <a
                          href={dasarPdfUrl}
                          download={verifyingReport.suratDasarPdfName || 'surat-dasar.pdf'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0F2A56] bg-white border border-[#CBD5E1] rounded hover:bg-[#F8FAFC]"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Unduh
                        </a>
                      </div>
                    ) : verifyingReport.suratDasarPdfName ? (
                      <p className="text-[11px] text-[#B45309]">
                        File berukuran besar tersimpan pada penyimpanan lokal perangkat pengaju.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Inline Embedded PDF Viewer */}
                {previewPdfTarget &&
                  ((previewPdfTarget === 'spt' && sptPdfUrl) ||
                    (previewPdfTarget === 'dasar' && dasarPdfUrl)) && (
                    <div className="border border-[#CBD5E1] rounded-md overflow-hidden bg-[#F1F5F9]">
                      <div className="px-3 py-2 bg-[#E2E8F0] flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                        <span>
                          Pratinjau Berkas:{' '}
                          {previewPdfTarget === 'spt'
                            ? verifyingReport.sptPdfName || 'PDF SPT'
                            : verifyingReport.suratDasarPdfName || 'PDF Surat Dasar'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewPdfTarget(null)}
                          className="text-xs text-[#475569] hover:text-[#0F172A]"
                        >
                          Tutup
                        </button>
                      </div>
                      <iframe
                        src={previewPdfTarget === 'spt' ? sptPdfUrl : dasarPdfUrl}
                        title={
                          previewPdfTarget === 'spt'
                            ? 'Pratinjau PDF SPT dan SPD Berstempel'
                            : 'Pratinjau PDF Surat Dasar'
                        }
                        className="w-full h-80 bg-white"
                      />
                    </div>
                  )}

                {/* Foto Dokumentasi Kegiatan */}
                <div className="border border-[#CBD5E1] rounded-md p-3.5 bg-white">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                      <ImageIcon className="w-4 h-4 text-[#0F2A56] shrink-0" />
                      <span>
                        03. Foto Dokumentasi Kegiatan ({verifyingReport.photos?.length || 0}/4)
                      </span>
                    </div>
                  </div>
                  {verifyingReport.photos && verifyingReport.photos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {verifyingReport.photos.map((photo, idx) => (
                        <div
                          key={photo.id || idx}
                          className="border border-[#E2E8F0] rounded overflow-hidden bg-[#F8FAFC]"
                        >
                          <div className="aspect-[4/3] bg-slate-200 overflow-hidden">
                            <img
                              src={photo.dataUrl}
                              alt={photo.caption || `Foto ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-2 text-[11px] text-[#334155]">
                            <div className="font-medium truncate">
                              Foto {idx + 1} · {photo.name}
                            </div>
                            {photo.caption && (
                              <div className="text-[#64748B] mt-0.5 line-clamp-2">
                                {photo.caption}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748B]">Tidak ada foto dokumentasi.</p>
                  )}
                </div>
              </div>

              {/* 3. Catatan Verifikasi Operator */}
              <div>
                <label
                  htmlFor="verification-note-input"
                  className="block text-xs font-semibold text-[#334155] mb-1"
                >
                  Catatan Verifikasi Operator <span className="font-normal text-[#64748B]">(Opsional)</span>
                </label>
                <textarea
                  id="verification-note-input"
                  rows={2}
                  maxLength={REPORT_FIELD_LIMITS.catatanVerifikasi}
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  placeholder="Contoh: Berkas SPT dan SPD berstempel telah sesuai, atau catatan perbaikan jika ditolak..."
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>
            </div>

            {/* Modal Footer: Decision Buttons */}
            <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                disabled={isSubmittingVerification}
                onClick={() => {
                  const target = verifyingReport;
                  setVerifyingReport(null);
                  onLoadReport(target);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-[#0F2A56] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#EFF6FF] transition-colors whitespace-nowrap"
              >
                Buka Dokumen A4 di Editor
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmittingVerification}
                  onClick={() => void handleApplyVerificationDecision('diajukan')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] rounded-md hover:bg-[#FEF3C7] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Tandai Diajukan
                </button>
                <button
                  type="button"
                  disabled={isSubmittingVerification}
                  onClick={() => void handleApplyVerificationDecision('ditolak')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#DC2626] rounded-md hover:bg-[#B91C1C] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Tolak (Ditolak)
                </button>
                <button
                  type="button"
                  disabled={isSubmittingVerification}
                  onClick={() => void handleApplyVerificationDecision('diterima')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#15803D] rounded-md hover:bg-[#166534] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verifikasi &amp; Terima
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
