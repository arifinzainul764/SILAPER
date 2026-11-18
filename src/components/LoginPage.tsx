import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MailCheck,
  RefreshCw,
} from 'lucide-react';

interface LoginPageProps {
  onLoginWithEmail: (email: string, password: string) => Promise<void>;
  onLoginWithGoogle: () => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onResendVerification: () => Promise<void>;
  onCheckVerification: () => Promise<void>;
  onCancelVerification: () => Promise<void>;
  needsEmailVerification: boolean;
  pendingUserEmail: string;
  authError: string | null;
  authNotice: string | null;
  isSubmitting: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginWithEmail,
  onLoginWithGoogle,
  onResetPassword,
  onResendVerification,
  onCheckVerification,
  onCancelVerification,
  needsEmailVerification,
  pendingUserEmail,
  authError,
  authNotice,
  isSubmitting,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setLocalError('Masukkan NIP / email dan kata sandi akun staf terlebih dahulu.');
      return;
    }
    await onLoginWithEmail(cleanEmail, password);
  };

  const handleForgotPassword = async () => {
    setLocalError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalError('Isikan alamat email terdaftar Anda terlebih dahulu untuk mengirim tautan atur ulang kata sandi.');
      return;
    }
    await onResetPassword(cleanEmail);
  };

  const displayedError = localError || authError;

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F4F6F9] text-[#0F172A]">
      {/* Left Institutional Panel */}
      <div className="lg:col-span-6 bg-[#0F2A56] text-white px-8 py-10 lg:px-14 lg:py-14 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/aistudio/image_08502736.png"
              alt="Logo Resmi Kabupaten Sidoarjo"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="w-12 h-12 object-contain shrink-0"
            />
            <span className="text-2xl font-bold tracking-tight text-white font-display">
              SILAPER
            </span>
          </div>

          <div className="mt-10 lg:mt-16 max-w-lg">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold leading-tight text-white font-display text-balance">
              Sistem Laporan Perjalanan Dinas Kecamatan Tarik
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-200 leading-relaxed">
              Portal administrasi internal Pemerintah Kecamatan Tarik untuk penyusunan laporan perjalanan dinas terstandar secara cepat, rapi, dan terdokumentasi aman.
            </p>
          </div>

          <div className="mt-10 lg:mt-14 max-w-lg divide-y divide-white/15 border-t border-b border-white/15">
            <div className="py-4">
              <p className="text-xs font-semibold text-white tracking-wide">
                01. Ekstraksi Otomatis Surat Perintah Tugas
              </p>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Unggah file PDF SPT untuk mengisi otomatis nomor surat, dasar hukum, pelaksana, tujuan, serta maksud perjalanan dinas.
              </p>
            </div>
            <div className="py-4">
              <p className="text-xs font-semibold text-white tracking-wide">
                02. Pratinjau A4 Resmi &amp; Lampiran Dokumentasi
              </p>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Pratinjau langsung tata naskah dinas lengkap dengan Kop Surat Kecamatan Tarik dan galeri foto dokumentasi lapangan.
              </p>
            </div>
            <div className="py-4">
              <p className="text-xs font-semibold text-white tracking-wide">
                03. Arsip Rahasia Staf &amp; Ekspor DOCX / PDF
              </p>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Simpan riwayat laporan per akun staf terdaftar dan unduh dalam format Word (.DOCX), PDF (.PDF), atau cetak langsung.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 text-xs text-slate-300">
          Pemerintah Kabupaten Sidoarjo · Kecamatan Tarik
        </div>
      </div>

      {/* Right Login Card Panel */}
      <div className="lg:col-span-6 flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md bg-white border border-[#D8E0EB] rounded-lg p-7 sm:p-8">
          <div className="flex items-center gap-2.5 text-[#0F2A56] mb-2">
            <LockKeyhole className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold tracking-wide">
              Akses Terbatas Staf Kecamatan Tarik
            </span>
          </div>

          <h2 className="text-xl font-bold text-[#0F172A] font-display">
            {needsEmailVerification ? 'Verifikasi Email Diperlukan' : 'Masuk ke SILAPER'}
          </h2>
          <p className="mt-1.5 text-xs text-[#475569] leading-relaxed">
            {needsEmailVerification
              ? 'Akun Anda perlu verifikasi email terlebih dahulu sebelum dapat mengakses ruang kerja dan arsip laporan.'
              : 'Silakan masuk menggunakan akun resmi yang telah didaftarkan oleh Administrator.'}
          </p>

          {displayedError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs text-[#991B1B]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{displayedError}</span>
            </div>
          )}

          {authNotice && (
            <div
              role="status"
              className="mt-5 flex items-start gap-2.5 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs text-[#166534]"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{authNotice}</span>
            </div>
          )}

          {needsEmailVerification ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-md border border-[#D8E0EB] bg-[#F8FAFC] p-4 text-xs text-[#334155] space-y-1.5">
                <p className="font-semibold text-[#0F172A]">Alamat Email Akun:</p>
                <p className="font-mono-tabular text-[#0F2A56] break-all">
                  {pendingUserEmail}
                </p>
                <p className="text-[#475569] pt-1 leading-relaxed">
                  Klik tautan verifikasi yang dikirim ke kotak masuk email Anda, lalu tekan tombol muat ulang status di bawah ini.
                </p>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={onCheckVerification}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Saya Sudah Verifikasi, Masuk Sekarang
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={onResendVerification}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0F2A56] bg-[#EFF6FF] border border-[#BFDBFE] rounded-md hover:bg-[#DBEAFE] disabled:opacity-60 transition-colors"
              >
                <MailCheck className="w-4 h-4" />
                Kirim Ulang Tautan Verifikasi
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={onCancelVerification}
                className="w-full px-4 py-2 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-[#334155] mb-1.5"
                  >
                    NIP atau Email Terdaftar
                  </label>
                  <input
                    id="login-email"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Masukkan NIP atau email staf"
                    className="w-full rounded-md border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-[#334155]"
                    >
                      Kata Sandi
                    </label>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleForgotPassword}
                      className="text-xs font-medium text-[#1E3A8A] hover:underline disabled:opacity-60"
                    >
                      Lupa kata sandi?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full rounded-md border border-[#CBD5E1] bg-white pl-3.5 pr-11 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                      className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-[#64748B] hover:text-[#0F172A]"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] disabled:opacity-60 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Masuk ke SILAPER
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-xs text-[#64748B]">atau</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={onLoginWithGoogle}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-md hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.89c2.28-2.1 3.53-5.2 3.53-8.88Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.89-3.01c-1.08.72-2.46 1.15-4.05 1.15-3.12 0-5.77-2.11-6.72-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.27V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.02-3.11Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.02 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
                  />
                </svg>
                Masuk dengan Akun Google Terdaftar
              </button>

              <p className="mt-6 pt-5 border-t border-[#E2E8F0] text-xs text-[#64748B] leading-relaxed">
                Pendaftaran mandiri dinonaktifkan. Hanya akun yang didaftarkan Administrator Kecamatan Tarik yang dapat masuk ke sistem.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
