import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { STAFF_FIELD_LIMITS } from '../types/report';

interface AccountPanelProps {
  roleLabel: 'User' | 'Operator' | 'Administrator';
  profileName: string;
  profileInstansi: string;
  accountEmail: string;
  staffNip?: string;
  isLocalStaff: boolean;
  isFirebaseUser: boolean;
  onSaveProfile: (input: {
    displayName: string;
    instansi: string;
    email?: string;
  }) => Promise<boolean>;
  onChangeStaffPassword?: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onSendPasswordResetEmail?: (
    email: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  roleLabel,
  profileName,
  profileInstansi,
  accountEmail,
  staffNip,
  isLocalStaff,
  isFirebaseUser,
  onSaveProfile,
  onChangeStaffPassword,
  onSendPasswordResetEmail,
}) => {
  const [displayName, setDisplayName] = useState(profileName);
  const [instansi, setInstansi] = useState(profileInstansi);
  const [email, setEmail] = useState(accountEmail);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profileName);
    setInstansi(profileInstansi);
    setEmail(accountEmail);
  }, [profileName, profileInstansi, accountEmail]);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const cleanName = displayName.trim();
    const cleanInstansi = instansi.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setProfileError('Nama lengkap wajib diisi.');
      return;
    }

    if (isLocalStaff && !cleanInstansi) {
      setProfileError('Jabatan / Unit Kerja wajib diisi.');
      return;
    }

    if (isLocalStaff && cleanEmail) {
      const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        setProfileError('Format alamat email tidak valid.');
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      const ok = await onSaveProfile({
        displayName: cleanName,
        instansi: cleanInstansi || 'Pemerintah Kecamatan Tarik',
        email: isLocalStaff ? cleanEmail : undefined,
      });
      if (ok) {
        setProfileSuccess('Data akun Anda berhasil diperbarui dan disimpan.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Semua kolom kata sandi wajib diisi.');
      return;
    }
    if (
      newPassword.length < STAFF_FIELD_LIMITS.passwordMin ||
      newPassword.length > STAFF_FIELD_LIMITS.passwordMax
    ) {
      setPasswordError(
        `Kata sandi baru minimal ${STAFF_FIELD_LIMITS.passwordMin} karakter.`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    if (!onChangeStaffPassword) return;

    setIsChangingPassword(true);
    try {
      const result = await onChangeStaffPassword(currentPassword, newPassword);
      if (!result.ok) {
        setPasswordError(result.error || 'Gagal memperbarui kata sandi.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setPasswordSuccess('Kata sandi akun berhasil diperbarui.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleTriggerFirebaseReset = async () => {
    if (!onSendPasswordResetEmail || !accountEmail) return;
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsChangingPassword(true);
    try {
      const result = await onSendPasswordResetEmail(accountEmail);
      if (!result.ok) {
        setPasswordError(result.error || 'Gagal mengirim tautan atur ulang kata sandi.');
        return;
      }
      setPasswordSuccess(
        `Tautan atur ulang kata sandi telah dikirim ke ${accountEmail}.`,
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Header Card */}
      <section className="bg-white border border-[#D8E0EB] rounded-lg p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#0F2A56] shrink-0">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[#0F172A] font-display">
                  Kelola Akun Saya
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#BFDBFE] bg-[#EFF6FF] text-[11px] font-semibold text-[#0F2A56]">
                  <UserCheck className="w-3 h-3" />
                  Peran: {roleLabel}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-1">
                Perbarui informasi profil dan keamanan kredensial akun Anda sendiri.
              </p>
            </div>
          </div>

          {staffNip && (
            <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs">
              <span className="text-[#64748B] block text-[11px]">NIP Terdaftar</span>
              <span className="font-mono-tabular font-semibold text-[#0F2A56]">
                {staffNip}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Role Permissions Info for User */}
      {roleLabel === 'User' && (
        <section className="bg-[#F8FAFC] border border-[#D8E0EB] rounded-lg p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#0F2A56] mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs text-[#334155]">
              <p className="font-semibold text-[#0F172A]">
                Hak Akses &amp; Ruang Lingkup Akun User
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[#475569]">
                <li>
                  Berhak mengakses <strong className="text-[#0F172A]">Beranda</strong>, membuat laporan baru melalui{' '}
                  <strong className="text-[#0F172A]">Buat Laporan/Ajukan SPD Baru</strong>, serta mengelola akun pribadi pada menu ini.
                </li>
                <li>
                  Seluruh pengajuan SPD dan lampiran berkas (SPT PDF, Surat Dasar PDF, Foto) bersifat pribadi dan terisolasi — User tidak dapat mengakses file maupun pengajuan milik User lain.
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Profile Form */}
        <section className="bg-white border border-[#D8E0EB] rounded-lg p-6">
          <h2 className="text-base font-semibold text-[#0F172A] border-b border-[#E2E8F0] pb-3">
            Informasi Profil Akun
          </h2>

          {profileError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]"
            >
              {profileError}
            </div>
          )}

          {profileSuccess && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-xs text-[#166534]"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSubmitProfile} className="mt-4 space-y-3.5">
            {staffNip && (
              <div>
                <label
                  htmlFor="account-nip"
                  className="block text-xs font-medium text-[#334155] mb-1"
                >
                  NIP (Identitas Login)
                </label>
                <input
                  id="account-nip"
                  type="text"
                  readOnly
                  value={staffNip}
                  className="w-full rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-3 py-2 text-sm text-[#475569] font-mono-tabular cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="account-name"
                className="block text-xs font-medium text-[#334155] mb-1"
              >
                Nama Lengkap <span className="text-[#DC2626]">*</span>
              </label>
              <input
                id="account-name"
                type="text"
                required
                maxLength={STAFF_FIELD_LIMITS.displayName}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nama lengkap beserta gelar"
                className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
              />
            </div>

            <div>
              <label
                htmlFor="account-instansi"
                className="block text-xs font-medium text-[#334155] mb-1"
              >
                {isLocalStaff ? 'Jabatan' : 'Instansi / Unit Kerja'}{' '}
                {isLocalStaff && <span className="text-[#DC2626]">*</span>}
              </label>
              <input
                id="account-instansi"
                type="text"
                required={isLocalStaff}
                maxLength={STAFF_FIELD_LIMITS.jabatan}
                value={instansi}
                onChange={(e) => setInstansi(e.target.value)}
                placeholder="Jabatan atau unit kerja"
                className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
              />
            </div>

            {(isLocalStaff || isFirebaseUser) && (
              <div>
                <label
                  htmlFor="account-email"
                  className="block text-xs font-medium text-[#334155] mb-1"
                >
                  Alamat Email{' '}
                  {isLocalStaff && (
                    <span className="text-[#64748B] font-normal">(Opsional)</span>
                  )}
                </label>
                <input
                  id="account-email"
                  type="email"
                  readOnly={!isLocalStaff}
                  maxLength={STAFF_FIELD_LIMITS.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@kecamatantarik.go.id"
                  className={
                    isLocalStaff
                      ? 'w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15'
                      : 'w-full rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-3 py-2 text-sm text-[#475569] cursor-not-allowed'
                  }
                />
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors"
              >
                {isSavingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Simpan Profil Akun
              </button>
            </div>
          </form>
        </section>

        {/* Password / Credentials Section */}
        <section className="bg-white border border-[#D8E0EB] rounded-lg p-6">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
            <KeyRound className="w-4 h-4 text-[#0F2A56]" />
            <h2 className="text-base font-semibold text-[#0F172A]">
              Keamanan &amp; Kata Sandi
            </h2>
          </div>

          {passwordError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]"
            >
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-xs text-[#166534]"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {isLocalStaff ? (
            <form onSubmit={handleSubmitPassword} className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="account-current-password"
                  className="block text-xs font-medium text-[#334155] mb-1"
                >
                  Kata Sandi Saat Ini <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="account-current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi saat ini"
                    className="w-full rounded-md border border-[#CBD5E1] bg-white pl-3 pr-10 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={
                      showCurrentPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'
                    }
                    className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="account-new-password"
                  className="block text-xs font-medium text-[#334155] mb-1"
                >
                  Kata Sandi Baru <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="account-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={STAFF_FIELD_LIMITS.passwordMin}
                    maxLength={STAFF_FIELD_LIMITS.passwordMax}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full rounded-md border border-[#CBD5E1] bg-white pl-3 pr-10 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={
                      showNewPassword ? 'Sembunyikan kata sandi baru' : 'Lihat kata sandi baru'
                    }
                    className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="account-confirm-password"
                  className="block text-xs font-medium text-[#334155] mb-1"
                >
                  Konfirmasi Kata Sandi Baru <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  id="account-confirm-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={STAFF_FIELD_LIMITS.passwordMin}
                  maxLength={STAFF_FIELD_LIMITS.passwordMax}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] rounded-md hover:bg-[#172554] disabled:opacity-60 transition-colors"
                >
                  {isChangingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Perbarui Kata Sandi
                </button>
              </div>
            </form>
          ) : isFirebaseUser && accountEmail ? (
            <div className="mt-4 space-y-3 text-xs text-[#475569]">
              <p className="leading-relaxed">
                Akun Anda masuk menggunakan email terverifikasi{' '}
                <strong className="text-[#0F172A]">{accountEmail}</strong>. Untuk mengganti kata sandi secara aman, kirim tautan pengaturan ulang ke email Anda.
              </p>
              <button
                type="button"
                disabled={isChangingPassword}
                onClick={handleTriggerFirebaseReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded-md hover:bg-[#DBEAFE] disabled:opacity-60 transition-colors"
              >
                {isChangingPassword ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                Kirim Tautan Ubah Kata Sandi ke Email
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs text-[#475569] leading-relaxed">
              Kredensial akun sistem bawaan (<strong className="text-[#0F172A]">{roleLabel}</strong>) dikelola oleh konfigurasi sistem. Anda tetap dapat memperbarui nama tampilan dan unit kerja pada formulir profil di samping.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
