import React, { useState } from 'react';
import {
  Info,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { AuthorizedStaff, STAFF_FIELD_LIMITS } from '../types/report';

interface StaffAdminPanelProps {
  staffList: AuthorizedStaff[];
  loadingStaff: boolean;
  adminEmail: string;
  onAddStaff: (input: {
    email: string;
    displayName: string;
    jabatan: string;
    nip: string;
  }) => Promise<boolean>;
  onToggleStaffActive: (staff: AuthorizedStaff) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
}

export const StaffAdminPanel: React.FC<StaffAdminPanelProps> = ({
  staffList,
  loadingStaff,
  adminEmail,
  onAddStaff,
  onToggleStaffActive,
  onDeleteStaff,
}) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [nip, setNip] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) return;
    setSubmitting(true);
    try {
      const ok = await onAddStaff({
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        jabatan: jabatan.trim(),
        nip: nip.trim(),
      });
      if (ok) {
        setEmail('');
        setDisplayName('');
        setJabatan('');
        setNip('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header & Guidance */}
      <div className="bg-white border border-[#D8E0EB] rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              Kelola Akun Staf Kecamatan Tarik
            </h2>
            <p className="text-xs text-[#475569] mt-1">
              Daftar email pegawai yang diizinkan mengakses SILAPER. Hanya akun pada daftar ini (atau akun Email &amp; Kata Sandi yang dibuat Administrator di Firebase Console) yang dapat masuk.
            </p>
          </div>
          <div className="text-xs text-[#0F2A56] font-medium inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Admin: {adminEmail}</span>
          </div>
        </div>

        {/* Add Staff Form */}
        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          <div className="md:col-span-4">
            <label htmlFor="staff-email" className="block text-xs font-medium text-[#334155] mb-1">
              Email Staf <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="staff-email"
              type="email"
              required
              maxLength={STAFF_FIELD_LIMITS.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staf@gmail.com"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="staff-name" className="block text-xs font-medium text-[#334155] mb-1">
              Nama Lengkap <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="staff-name"
              type="text"
              required
              maxLength={STAFF_FIELD_LIMITS.displayName}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nama Pegawai"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-3">
            <label htmlFor="staff-jabatan" className="block text-xs font-medium text-[#334155] mb-1">
              Jabatan
            </label>
            <input
              id="staff-jabatan"
              type="text"
              maxLength={STAFF_FIELD_LIMITS.jabatan}
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="Kasi / Staf Kecamatan"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="staff-nip" className="block text-xs font-medium text-[#334155] mb-1">
              NIP
            </label>
            <input
              id="staff-nip"
              type="text"
              maxLength={STAFF_FIELD_LIMITS.nip}
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Opsional"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] font-mono-tabular focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="inline-flex items-center gap-2 text-xs text-[#475569]">
              <Info className="w-4 h-4 text-[#1E3A8A] shrink-0" />
              <span>
                Untuk login menggunakan kata sandi, buat pula akun dengan email yang sama di menu Firebase Authentication &rarr; Users.
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              Daftarkan Akun Staf
            </button>
          </div>
        </form>
      </div>

      {/* Staff Registry Table */}
      <div className="bg-white border border-[#D8E0EB] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-[#0F172A]">
            Daftar Akun Staf Terdaftar
          </h3>
          <span className="text-xs text-[#475569] tabular-nums">
            Total: {staffList.length} akun
          </span>
        </div>

        {loadingStaff ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-10 bg-[#F1F5F9] rounded animate-pulse" />
            ))}
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#0F172A]">
              Belum ada akun staf tambahan yang didaftarkan
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Gunakan formulir di atas untuk mendaftarkan email pegawai Kecamatan Tarik agar dapat masuk ke SILAPER.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#475569]">
                  <th className="py-3 px-4">Nama &amp; Email</th>
                  <th className="py-3 px-4">Jabatan</th>
                  <th className="py-3 px-4">NIP</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F172A]">{staff.displayName}</p>
                      <p className="text-[#475569] font-mono-tabular mt-0.5">{staff.email}</p>
                    </td>
                    <td className="py-3 px-4 text-[#334155]">
                      {staff.jabatan || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-[#334155]">
                      {staff.nip || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold ${
                          staff.active ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {staff.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleStaffActive(staff)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
                        >
                          {staff.active ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              Nonaktifkan
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              Aktifkan
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteStaff(staff.id)}
                          aria-label={`Hapus akun ${staff.email}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#DC2626] bg-white border border-[#FECACA] rounded hover:bg-[#FEF2F2] transition-colors whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
