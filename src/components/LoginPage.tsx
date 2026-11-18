import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  RefreshCw,
} from 'lucide-react';

interface LoginPageProps {
  onLoginWithEmail: (email: string, password: string) => Promise<void>;
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
    <div className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-12 bg-[#F4F6F9] text-[#0F172A]">
      {/* Left Institutional Panel (Desktop only so mobile shows login form immediately without scrolling) */}
      <div className="hidden lg:flex lg:col-span-5 bg-[#0F2A56] text-white px-12 py-14 flex-col justify-between">
        <div>
          <div className="flex items-center gap-4">
            <img
              src="/assets/aistudio/image_08502736.png"
              alt="Logo Resmi Kabupaten Sidoarjo"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="w-16 h-16 object-contain shrink-0"
            />
            <div className="leading-tight">
              <span className="text-3xl font-bold tracking-tight text-white font-display block leading-none">
                SILAPER
              </span>
              <span className="text-sm font-medium text-slate-200 block mt-1.5">
                Kecamatan Tarik
              </span>
            </div>
          </div>

          <div className="mt-16 max-w-md">
            <h1 className="text-3xl font-bold leading-tight text-white font-display text-balance">
              Sistem Laporan Perjalanan Dinas Kecamatan Tarik
            </h1>
            <p className="mt-4 text-sm text-slate-200 leading-relaxed">
              Portal administrasi internal Pemerintah Kecamatan Tarik untuk penyusunan laporan perjalanan dinas terstandar.
            </p>
          </div>
        </div>

        <div className="pt-8 text-xs text-slate-300">
          Sub Bagian Umum dan Kepegawaian · Kecamatan Tarik
        </div>
      </div>

      {/* Right Login Card Panel */}
      <div className="lg:col-span-7 flex items-center justify-center px-4 py-4 sm:px-8 sm:py-10">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="flex lg:hidden items-center justify-center gap-3.5 mb-4">
            <img
              src="/assets/aistudio/image_08502736.png"
              alt="Logo Resmi Kabupaten Sidoarjo"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain shrink-0"
            />
            <div className="leading-tight">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F2A56] font-display block leading-none">
                SILAPER
              </span>
              <span className="text-sm sm:text-base font-semibold text-[#334155] block mt-1">
                Kecamatan Tarik
              </span>
            </div>
          </div>

          <div className="bg-white border border-[#D8E0EB] rounded-lg p-5 sm:p-8 shadow-xs">
            <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] font-display">
              {needsEmailVerification ? 'Verifikasi Email Diperlukan' : 'Masuk ke SILAPER'}
            </h2>
            {needsEmailVerification && (
              <p className="mt-1 text-xs text-[#475569] leading-relaxed">
                Akun Anda perlu verifikasi email terlebih dahulu sebelum dapat mengakses ruang kerja dan arsip laporan.
              </p>
            )}

            {displayedError && (
              <div
                role="alert"
                className="mt-3.5 sm:mt-4 flex items-start gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-xs text-[#991B1B]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{displayedError}</span>
              </div>
            )}

            {authNotice && (
              <div
                role="status"
                className="mt-3.5 sm:mt-4 flex items-start gap-2 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-xs text-[#166534]"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{authNotice}</span>
              </div>
            )}

            {needsEmailVerification ? (
              <div className="mt-5 space-y-3.5">
                <div className="rounded-md border border-[#D8E0EB] bg-[#F8FAFC] p-3.5 text-xs text-[#334155] space-y-1.5">
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
                <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-3 sm:space-y-4">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-[#334155] mb-1"
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
                      className="w-full rounded-md border border-[#CBD5E1] bg-white px-3.5 py-2 sm:py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
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
                        className="w-full rounded-md border border-[#CBD5E1] bg-white pl-3.5 pr-11 py-2 sm:py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F2A56] focus:outline-none focus:ring-2 focus:ring-[#0F2A56]/15"
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
