import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  FileCheck2,
  FolderOpen,
  Lock,
  LogIn,
  Plus,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react';
import { StoredTravelReport } from '../types/report';

interface ArchivePanelProps {
  user: User | null;
  authReady: boolean;
  isTempAdmin?: boolean;
  hasLocalSession?: boolean;
  localAccountLabel?: string;
  reports: StoredTravelReport[];
  loadingReports: boolean;
  activeReportId: string | null;
  onSignIn: () => void;
  onLoadReport: (report: StoredTravelReport) => void;
  onToggleReportStatus: (report: StoredTravelReport) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
  onCreateNewReport: () => void;
}

export const ArchivePanel: React.FC<ArchivePanelProps> = ({
  user,
  authReady,
  isTempAdmin = false,
  hasLocalSession = false,
  localAccountLabel,
  reports,
  loadingReports,
  activeReportId,
  onSignIn,
  onLoadReport,
  onToggleReportStatus,
  onDeleteReport,
  onCreateNewReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'final'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.nomorSpt.toLowerCase().includes(q) ||
        r.namaPegawai.toLowerCase().includes(q) ||
        r.tujuan.toLowerCase().includes(q) ||
        r.namaKecamatan.toLowerCase().includes(q)
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

  const isLocalAuthorized = isTempAdmin || hasLocalSession;

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
            Untuk menjaga kerahasiaan data perjalanan dinas, NIP pegawai, dan lampiran dokumentasi instansi, arsip laporan hanya dapat diakses oleh akun staf yang terautentikasi.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] transition-colors whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            Masuk dengan Google
          </button>
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
              Arsip Laporan Perjalanan Dinas Tersimpan
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Akun aktif: {user?.displayName || user?.email || localAccountLabel || 'Administrator Sementara (admin)'} ·{' '}
              {user ? 'Terisolasi privat per akun staf' : 'Penyimpanan sesi lokal browser'}
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateNewReport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Buat Laporan Baru
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Nomor SPT, Nama Pegawai, atau Tujuan..."
              className="w-full rounded-md border border-[#CBD5E1] bg-white pl-9 pr-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-md">
            {(['all', 'draft', 'final'] as const).map((tab) => (
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
                {tab === 'all' ? 'Semua' : tab === 'draft' ? 'Draf' : 'Final'}
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
              Susun laporan di Editor Laporan lalu tekan tombol "Simpan ke Arsip".
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                  <th className="py-3 pr-4">Nomor SPT</th>
                  <th className="py-3 pr-4">Pelaksana & Tujuan</th>
                  <th className="py-3 pr-4">Tanggal</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {filteredReports.map((item) => {
                  const isCurrent = item.id === activeReportId;
                  const isBusy = busyId === item.id;
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
                        <div className="text-xs text-[#64748B] mt-0.5">
                          {item.photos?.length || 0} foto lampiran
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 align-top">
                        <div className="font-medium text-[#0F172A]">{item.namaPegawai}</div>
                        <div className="text-xs text-[#475569] mt-0.5 line-clamp-1">
                          {item.tujuan || '-'}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 align-top text-xs text-[#475569] whitespace-nowrap tabular-nums">
                        {item.tanggalLaporan || item.tanggalSpt || '-'}
                      </td>
                      <td className="py-3.5 pr-4 align-top text-xs whitespace-nowrap">
                        {item.status === 'final' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Final Terkunci
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-[#D97706]">
                            <FileCheck2 className="w-3.5 h-3.5" />
                            Draf
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onLoadReport(item)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
                          >
                            Buka di Editor
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(item.id);
                              try {
                                await onToggleReportStatus(item);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#334155] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {item.status === 'final' ? (
                              <>
                                <Unlock className="w-3 h-3" />
                                Buka Draf
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                Finalkan
                              </>
                            )}
                          </button>

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
    </div>
  );
};
