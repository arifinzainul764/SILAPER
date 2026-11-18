import React from 'react';
import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  UserCheck,
} from 'lucide-react';
import { StoredTravelReport } from '../types/report';

interface HomePanelProps {
  profileName: string;
  profileInstansi: string;
  accountSubLabel?: string;
  reports: StoredTravelReport[];
  loadingReports: boolean;
  isAdminUser: boolean;
  staffCount: number;
  onCreateNewReport: () => void;
  onOpenReport: (report: StoredTravelReport) => void;
  onNavigateTab: (tab: 'archive' | 'guide' | 'staff') => void;
}

export const HomePanel: React.FC<HomePanelProps> = ({
  profileName,
  profileInstansi,
  accountSubLabel,
  reports,
  loadingReports,
  isAdminUser,
  staffCount,
  onCreateNewReport,
  onOpenReport,
  onNavigateTab,
}) => {
  const draftCount = reports.filter((r) => r.status !== 'final').length;
  const finalCount = reports.filter((r) => r.status === 'final').length;
  const photoCount = reports.reduce((acc, r) => acc + (r.photos?.length || 0), 0);
  const recentReports = reports.slice(0, 5);

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
      {/* Welcome Header Card */}
      <section className="bg-white border border-[#D8E0EB] rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1E3A8A]">
              {todayFormatted}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] font-display">
              Selamat Datang, {profileName}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569]">
              {profileInstansi}
              {accountSubLabel ? ` · ${accountSubLabel}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('archive')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0F2A56] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap"
            >
              <Archive className="w-4 h-4" />
              Daftar SPPD
            </button>
            <button
              type="button"
              onClick={onCreateNewReport}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Buat SPPD Baru
            </button>
          </div>
        </div>
      </section>

      {/* Summary Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D8E0EB] rounded-lg p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B]">Total Laporan SPPD</p>
            <p className="text-2xl font-bold text-[#0F172A] mt-1 tabular-nums">
              {loadingReports ? '—' : reports.length}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1">Tersimpan pada arsip</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#0F2A56] shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-[#D8E0EB] rounded-lg p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B]">Status Draf</p>
            <p className="text-2xl font-bold text-[#D97706] mt-1 tabular-nums">
              {loadingReports ? '—' : draftCount}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1">Masih dapat disunting</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center text-[#D97706] shrink-0">
            <FileCheck2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-[#D8E0EB] rounded-lg p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-[#64748B]">Final Terkunci</p>
            <p className="text-2xl font-bold text-[#16A34A] mt-1 tabular-nums">
              {loadingReports ? '—' : finalCount}
            </p>
            <p className="text-[11px] text-[#64748B] mt-1">Siap cetak &amp; arsip resmi</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A] shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {isAdminUser ? (
          <div className="bg-white border border-[#D8E0EB] rounded-lg p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#64748B]">Akun Staf Terdaftar</p>
              <p className="text-2xl font-bold text-[#0F2A56] mt-1 tabular-nums">
                {staffCount}
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">Pengguna aktif Kecamatan</p>
            </div>
            <div className="w-9 h-9 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#0F2A56] shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#D8E0EB] rounded-lg p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#64748B]">Foto Dokumentasi</p>
              <p className="text-2xl font-bold text-[#0F2A56] mt-1 tabular-nums">
                {loadingReports ? '—' : photoCount}
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">Lampiran galeri A4</p>
            </div>
            <div className="w-9 h-9 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#0F2A56] shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
        )}
      </section>

      {/* Main Grid: Recent Reports & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent SPPD List */}
        <section className="lg:col-span-2 bg-white border border-[#D8E0EB] rounded-lg p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                Laporan SPPD Terbaru
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Daftar laporan perjalanan dinas terakhir yang tersimpan pada akun Anda.
              </p>
            </div>
            {reports.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('archive')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F2A56] hover:text-[#1E3A8A] whitespace-nowrap"
              >
                Lihat Semua
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {loadingReports ? (
            <div className="py-12 text-center text-xs text-[#64748B]">
              Memuat data laporan SPPD...
            </div>
          ) : recentReports.length === 0 ? (
            <div className="py-12 text-center">
              <FolderOpen className="w-9 h-9 text-[#94A3B8] mx-auto mb-2.5" />
              <p className="text-sm font-medium text-[#0F172A]">
                Belum ada laporan SPPD yang tersimpan.
              </p>
              <p className="text-xs text-[#64748B] mt-1 mb-4">
                Unggah PDF Surat Perintah Tugas untuk menyusun laporan perjalanan dinas resmi secara otomatis.
              </p>
              <button
                type="button"
                onClick={onCreateNewReport}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat SPPD Baru
              </button>
            </div>
          ) : (
            <div className="mt-2 divide-y divide-[#E2E8F0]">
              {recentReports.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-tabular text-xs font-semibold text-[#0F2A56]">
                        {item.nomorSpt}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          item.status === 'final' ? 'text-[#16A34A]' : 'text-[#D97706]'
                        }`}
                      >
                        · {item.status === 'final' ? 'Final' : 'Draf'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#0F172A] truncate mt-0.5">
                      {item.namaPegawai}
                    </p>
                    <p className="text-xs text-[#64748B] truncate">
                      {item.tujuan || '-'} · {item.tanggalLaporan || item.tanggalSpt || '-'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenReport(item)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    Buka di Editor
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Navigation Panel */}
        <section className="bg-white border border-[#D8E0EB] rounded-lg p-6">
          <div className="pb-4 border-b border-[#E2E8F0]">
            <h2 className="text-base font-semibold text-[#0F172A]">Akses Cepat</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Pintasan fitur utama SILAPER Kecamatan Tarik.
            </p>
          </div>

          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              onClick={onCreateNewReport}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-md border border-[#E2E8F0] hover:border-[#0F2A56] hover:bg-[#F8FAFC] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded bg-[#0F2A56] text-white flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A]">Buat SPPD Baru</p>
                  <p className="text-[11px] text-[#64748B] truncate">
                    Unggah SPT.PDF &amp; cetak A4
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#64748B] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('archive')}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-md border border-[#E2E8F0] hover:border-[#0F2A56] hover:bg-[#F8FAFC] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded bg-[#EFF6FF] text-[#0F2A56] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                  <Archive className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A]">SPPD Tersimpan</p>
                  <p className="text-[11px] text-[#64748B] truncate">
                    Kelola draf &amp; laporan final
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#64748B] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('guide')}
              className="w-full flex items-center justify-between gap-3 p-3 rounded-md border border-[#E2E8F0] hover:border-[#0F2A56] hover:bg-[#F8FAFC] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded bg-[#EFF6FF] text-[#0F2A56] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A]">Panduan SPT</p>
                  <p className="text-[11px] text-[#64748B] truncate">
                    Alur kerja &amp; tata cara ekspor
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#64748B] shrink-0" />
            </button>

            {isAdminUser && (
              <button
                type="button"
                onClick={() => onNavigateTab('staff')}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-md border border-[#E2E8F0] hover:border-[#0F2A56] hover:bg-[#F8FAFC] transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-[#EFF6FF] text-[#0F2A56] border border-[#BFDBFE] flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A]">Kelola Akun Staf</p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      Daftarkan &amp; perbarui akun staf
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#64748B] shrink-0" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
