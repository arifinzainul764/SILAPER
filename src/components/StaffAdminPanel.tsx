import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { AuthorizedStaff, STAFF_FIELD_LIMITS } from '../types/report';

export interface EditStaffInput {
  id: string;
  nip: string;
  displayName: string;
  jabatan: string;
  email: string;
  password?: string;
}

type SortField = 'displayName' | 'nip' | 'jabatan' | 'email' | 'active';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';

interface StaffAdminPanelProps {
  staffList: AuthorizedStaff[];
  loadingStaff: boolean;
  adminEmail: string;
  onAddStaff: (input: {
    nip: string;
    displayName: string;
    jabatan: string;
    password: string;
    email: string;
  }) => Promise<boolean>;
  onEditStaff: (input: EditStaffInput) => Promise<boolean>;
  onToggleStaffActive: (staff: AuthorizedStaff) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
}

export const StaffAdminPanel: React.FC<StaffAdminPanelProps> = ({
  staffList,
  loadingStaff,
  adminEmail,
  onAddStaff,
  onEditStaff,
  onToggleStaffActive,
  onDeleteStaff,
}) => {
  // Add form state
  const [nip, setNip] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('displayName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Edit modal state
  const [editingStaff, setEditingStaff] = useState<AuthorizedStaff | null>(null);
  const [editNip, setEditNip] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editJabatan, setEditJabatan] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNip = nip.trim();
    const cleanName = displayName.trim();
    const cleanJabatan = jabatan.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanNip || !cleanName || !cleanJabatan || !password) {
      setFormError('NIP, Nama Lengkap, Jabatan, dan Password wajib diisi.');
      return;
    }

    if (password.length < STAFF_FIELD_LIMITS.passwordMin) {
      setFormError(`Password minimal terdiri dari ${STAFF_FIELD_LIMITS.passwordMin} karakter.`);
      return;
    }

    if (cleanEmail) {
      const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        setFormError('Format email tidak valid. Kosongkan jika tidak ingin mengisi email.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const ok = await onAddStaff({
        nip: cleanNip,
        displayName: cleanName,
        jabatan: cleanJabatan,
        password,
        email: cleanEmail,
      });
      if (ok) {
        setNip('');
        setDisplayName('');
        setJabatan('');
        setPassword('');
        setEmail('');
        setShowPassword(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (staff: AuthorizedStaff) => {
    setEditingStaff(staff);
    setEditNip(staff.nip || '');
    setEditDisplayName(staff.displayName || '');
    setEditJabatan(staff.jabatan || '');
    setEditEmail(staff.email || '');
    setEditPassword('');
    setShowEditPassword(false);
    setEditError(null);
  };

  const handleCloseEditModal = () => {
    if (isSavingEdit) return;
    setEditingStaff(null);
    setEditError(null);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditError(null);

    const cleanNip = editNip.trim();
    const cleanName = editDisplayName.trim();
    const cleanJabatan = editJabatan.trim();
    const cleanEmail = editEmail.trim().toLowerCase();

    if (!cleanNip || !cleanName || !cleanJabatan) {
      setEditError('NIP, Nama Lengkap, dan Jabatan wajib diisi.');
      return;
    }

    if (editPassword && editPassword.length < STAFF_FIELD_LIMITS.passwordMin) {
      setEditError(
        `Password baru minimal terdiri dari ${STAFF_FIELD_LIMITS.passwordMin} karakter.`,
      );
      return;
    }

    if (cleanEmail) {
      const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        setEditError('Format email tidak valid. Kosongkan jika tidak ingin mengisi email.');
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      const ok = await onEditStaff({
        id: editingStaff.id,
        nip: cleanNip,
        displayName: cleanName,
        jabatan: cleanJabatan,
        email: cleanEmail,
        password: editPassword || undefined,
      });
      if (ok) {
        setEditingStaff(null);
        setEditPassword('');
        setShowEditPassword(false);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'active' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#0F2A56] shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#0F2A56] shrink-0" />
    );
  };

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all';

  const filteredAndSortedStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = staffList.filter((item) => {
      if (statusFilter === 'active' && !item.active) return false;
      if (statusFilter === 'inactive' && item.active) return false;
      if (!q) return true;
      return (
        (item.displayName || '').toLowerCase().includes(q) ||
        (item.nip || '').toLowerCase().includes(q) ||
        (item.jabatan || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'active') {
        cmp = Number(a.active) - Number(b.active);
        if (cmp === 0) {
          cmp = (a.displayName || '').localeCompare(b.displayName || '', 'id');
        }
      } else {
        const valA = (a[sortField] || '').toLowerCase();
        const valB = (b[sortField] || '').toLowerCase();
        cmp = valA.localeCompare(valB, 'id', { numeric: true });
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [staffList, searchQuery, statusFilter, sortField, sortDirection]);

  const sortSelectValue = `${sortField}:${sortDirection}`;

  const handleSortSelectChange = (value: string) => {
    const [field, dir] = value.split(':') as [SortField, SortDirection];
    if (field && dir) {
      setSortField(field);
      setSortDirection(dir);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortField('displayName');
    setSortDirection('asc');
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Header & Registration Form */}
      <div className="bg-white border border-[#D8E0EB] rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A]">
              Kelola Akun Staf Kecamatan Tarik
            </h2>
            <p className="text-xs text-[#475569] mt-1">
              Daftarkan akun pegawai menggunakan NIP, Nama Lengkap, Jabatan, dan Password wajib. Email bersifat opsional.
            </p>
          </div>
          <div className="text-xs text-[#0F2A56] font-medium inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Admin: {adminEmail}</span>
          </div>
        </div>

        {formError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
          >
            {formError}
          </div>
        )}

        {/* Add Staff Form */}
        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          <div className="md:col-span-4">
            <label htmlFor="staff-nip" className="block text-xs font-medium text-[#334155] mb-1">
              NIP <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="staff-nip"
              type="text"
              required
              maxLength={STAFF_FIELD_LIMITS.nip}
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="19840718 201001 1 012"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] font-mono-tabular focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-4">
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
              placeholder="Nama lengkap beserta gelar"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="staff-jabatan" className="block text-xs font-medium text-[#334155] mb-1">
              Jabatan <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="staff-jabatan"
              type="text"
              required
              maxLength={STAFF_FIELD_LIMITS.jabatan}
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="Kasi / Staf Kecamatan Tarik"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-6">
            <label htmlFor="staff-password" className="block text-xs font-medium text-[#334155] mb-1">
              Password <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative">
              <input
                id="staff-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={STAFF_FIELD_LIMITS.passwordMin}
                maxLength={STAFF_FIELD_LIMITS.passwordMax}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full rounded-md border border-[#CBD5E1] bg-white pl-3 pr-10 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="md:col-span-6">
            <label htmlFor="staff-email" className="block text-xs font-medium text-[#334155] mb-1">
              Email <span className="text-[#64748B] font-normal">(Opsional)</span>
            </label>
            <input
              id="staff-email"
              type="email"
              maxLength={STAFF_FIELD_LIMITS.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Opsional (staf@kecamatantarik.go.id)"
              className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
          </div>

          <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="inline-flex items-center gap-2 text-xs text-[#475569]">
              <Info className="w-4 h-4 text-[#1E3A8A] shrink-0" />
              <span>
                Staf yang terdaftar dapat masuk pada halaman login menggunakan NIP (atau Email jika diisi) dan Password.
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
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">
              Daftar Akun Staf Terdaftar
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5 tabular-nums">
              {hasActiveFilters
                ? `Menampilkan ${filteredAndSortedStaff.length} dari ${staffList.length} akun`
                : `Total: ${staffList.length} akun terdaftar`}
            </p>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#475569] bg-[#F8FAFC] border border-[#CBD5E1] rounded-md hover:bg-[#F1F5F9] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          )}
        </div>

        {/* Filter & Sort Toolbar */}
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari NIP, Nama, Jabatan, atau Email..."
              aria-label="Cari akun staf terdaftar"
              className="w-full rounded-md border border-[#CBD5E1] bg-white pl-9 pr-8 py-1.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#64748B] hover:text-[#0F172A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter Segmented Tabs */}
            <div
              role="group"
              aria-label="Filter status akun staf"
              className="inline-flex items-center gap-1 p-1 bg-[#E2E8F0]/70 rounded-md"
            >
              {([
                { id: 'all', label: 'Semua' },
                { id: 'active', label: 'Aktif' },
                { id: 'inactive', label: 'Nonaktif' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-white text-[#0F2A56] font-semibold shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="inline-flex items-center gap-1.5">
              <label htmlFor="staff-sort-select" className="text-xs font-medium text-[#475569] whitespace-nowrap">
                Urutkan:
              </label>
              <select
                id="staff-sort-select"
                value={sortSelectValue}
                onChange={(e) => handleSortSelectChange(e.target.value)}
                className="rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
              >
                <option value="displayName:asc">Nama Lengkap (A–Z)</option>
                <option value="displayName:desc">Nama Lengkap (Z–A)</option>
                <option value="nip:asc">NIP (Terkecil–Terbesar)</option>
                <option value="nip:desc">NIP (Terbesar–Terkecil)</option>
                <option value="jabatan:asc">Jabatan (A–Z)</option>
                <option value="jabatan:desc">Jabatan (Z–A)</option>
                <option value="email:asc">Email (A–Z)</option>
                <option value="email:desc">Email (Z–A)</option>
                <option value="active:desc">Status (Aktif Dulu)</option>
                <option value="active:asc">Status (Nonaktif Dulu)</option>
              </select>
            </div>
          </div>
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
              Lengkapi NIP, Nama Lengkap, Jabatan, dan Password pada formulir di atas untuk mendaftarkan akun pegawai baru.
            </p>
          </div>
        ) : filteredAndSortedStaff.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-[#0F172A]">
              Tidak ada akun staf yang sesuai dengan filter pencarian
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Ubah kata kunci pencarian atau pilih status filter lain.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded-md hover:bg-[#DBEAFE] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tampilkan Semua Akun
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#475569]">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleHeaderSort('displayName')}
                      className="inline-flex items-center gap-1.5 hover:text-[#0F2A56] transition-colors"
                    >
                      <span>Nama Lengkap &amp; NIP</span>
                      {renderSortIcon('displayName')}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleHeaderSort('jabatan')}
                      className="inline-flex items-center gap-1.5 hover:text-[#0F2A56] transition-colors"
                    >
                      <span>Jabatan</span>
                      {renderSortIcon('jabatan')}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleHeaderSort('email')}
                      className="inline-flex items-center gap-1.5 hover:text-[#0F2A56] transition-colors"
                    >
                      <span>Email</span>
                      {renderSortIcon('email')}
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleHeaderSort('active')}
                      className="inline-flex items-center gap-1.5 hover:text-[#0F2A56] transition-colors"
                    >
                      <span>Status</span>
                      {renderSortIcon('active')}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {filteredAndSortedStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F172A]">{staff.displayName}</p>
                      <p className="text-[#475569] font-mono-tabular mt-0.5">
                        NIP. {staff.nip || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-[#334155]">
                      {staff.jabatan || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-[#475569]">
                      {staff.email || '—'}
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
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(staff)}
                          aria-label={`Edit akun ${staff.displayName}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#334155] bg-white border border-[#CBD5E1] rounded hover:bg-[#F1F5F9] hover:text-[#0F2A56] transition-colors whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStaffActive(staff)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded hover:bg-[#DBEAFE] transition-colors whitespace-nowrap"
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
                          aria-label={`Hapus akun ${staff.displayName}`}
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

      {/* Modal Edit Akun Staf */}
      {editingStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-staff-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg bg-white border border-[#D8E0EB] rounded-lg p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3.5">
              <div>
                <h2
                  id="edit-staff-modal-title"
                  className="text-base font-bold text-[#0F172A]"
                >
                  Edit Data Akun Staf
                </h2>
                <p className="text-xs text-[#475569] mt-0.5">
                  Perbarui informasi NIP, Nama Lengkap, Jabatan, Email, atau Password akun staf terdaftar.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSavingEdit}
                aria-label="Tutup jendela edit"
                className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
              >
                {editError}
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="edit-staff-nip" className="block text-xs font-medium text-[#334155] mb-1">
                  NIP <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="edit-staff-nip"
                  type="text"
                  required
                  maxLength={STAFF_FIELD_LIMITS.nip}
                  value={editNip}
                  onChange={(e) => setEditNip(e.target.value)}
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] font-mono-tabular focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>

              <div>
                <label htmlFor="edit-staff-name" className="block text-xs font-medium text-[#334155] mb-1">
                  Nama Lengkap <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="edit-staff-name"
                  type="text"
                  required
                  maxLength={STAFF_FIELD_LIMITS.displayName}
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>

              <div>
                <label htmlFor="edit-staff-jabatan" className="block text-xs font-medium text-[#334155] mb-1">
                  Jabatan <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="edit-staff-jabatan"
                  type="text"
                  required
                  maxLength={STAFF_FIELD_LIMITS.jabatan}
                  value={editJabatan}
                  onChange={(e) => setEditJabatan(e.target.value)}
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>

              <div>
                <label htmlFor="edit-staff-email" className="block text-xs font-medium text-[#334155] mb-1">
                  Email <span className="text-[#64748B] font-normal">(Opsional)</span>
                </label>
                <input
                  id="edit-staff-email"
                  type="email"
                  maxLength={STAFF_FIELD_LIMITS.email}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Kosongkan jika tidak menggunakan email"
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>

              <div>
                <label htmlFor="edit-staff-password" className="block text-xs font-medium text-[#334155] mb-1">
                  Password Baru <span className="text-[#64748B] font-normal">(Opsional)</span>
                </label>
                <div className="relative">
                  <input
                    id="edit-staff-password"
                    type={showEditPassword ? 'text' : 'password'}
                    maxLength={STAFF_FIELD_LIMITS.passwordMax}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak ingin mengubah password"
                    className="w-full rounded-md border border-[#CBD5E1] bg-white pl-3 pr-10 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((prev) => !prev)}
                    aria-label={showEditPassword ? 'Sembunyikan password' : 'Lihat password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Isi minimal 6 karakter hanya jika Anda ingin mengganti password staf ini.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] transition-colors whitespace-nowrap"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
