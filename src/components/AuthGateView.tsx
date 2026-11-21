import React from 'react';
import {
  SCHOOL_NAME,
  SCHOOL_SLOGAN,
  SUPER_ADMIN_EMAIL,
  UserAccount,
} from '../types/simtaq';
import {
  BookOpenCheck,
  Clock,
  HeartHandshake,
  Info,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface AuthGateViewProps {
  signedInUser: UserAccount | null;
  authLoading: boolean;
  authError: string | null;
  bootstrapMismatch?: boolean;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRefreshAccountStatus: () => Promise<void>;
  onEnterLocalLearningMode: () => void;
  onOpenPublicTab: (tab: 'tentang' | 'donasi') => void;
}

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  signedInUser,
  authLoading,
  authError,
  bootstrapMismatch,
  onGoogleSignIn,
  onSignOut,
  onRefreshAccountStatus,
  onEnterLocalLearningMode,
  onOpenPublicTab,
}) => {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-emerald-900/15 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-amber-300 shadow-xs">
              <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-wide text-emerald-800 uppercase">
                {SCHOOL_NAME}
              </p>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Gerbang Masuk SIMTAQ
              </h1>
              <p className="text-xs font-medium text-amber-800">{SCHOOL_SLOGAN}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenPublicTab('tentang')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Info className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              Tentang SIMTAQ
            </button>
            <button
              type="button"
              onClick={() => onOpenPublicTab('donasi')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <HeartHandshake className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              Dukung Pengembangan
            </button>
          </div>
        </div>

        {authError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
          >
            {authError}
          </div>
        )}

        {bootstrapMismatch && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-950"
          >
            <strong>Akses Ditolak:</strong> Dokumen pengunci atomic <code>super_admin</code> sudah
            terikat ke UID berbeda. Sistem menolak klaim ulang demi keamanan.
          </div>
        )}

        {!signedInUser ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Portal Akun Resmi (Google Sign-In) */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
              <div className="flex items-center gap-2 text-emerald-900">
                <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <h2 className="text-base font-bold">Masuk Akun Terverifikasi (Google)</h2>
              </div>
              <p className="text-xs leading-relaxed text-slate-700">
                Untuk mengakses <strong>Portal Guru/Muhafidz</strong>, <strong>Admin Sekolah</strong>,{' '}
                <strong>Super Admin</strong>, serta menyinkronkan catatan hafalan &amp; kontak wali ke
                cloud sekolah, masuk menggunakan akun Google terverifikasi.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  • Super Admin utama: <code className="font-semibold">{SUPER_ADMIN_EMAIL}</code>
                </li>
                <li>• Akun baru selain Super Admin akan menunggu aktivasi peran oleh Admin.</li>
                <li>• Tidak menggunakan PIN polos atau kredensial buatan lokal.</li>
              </ul>

              <button
                type="button"
                disabled={authLoading}
                onClick={() => void onGoogleSignIn()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {authLoading ? 'Memproses Google Sign-In...' : 'Masuk dengan Google'}
              </button>
            </div>

            {/* Mode Belajar Mandiri Offline (Tanpa Login, Non-Privileged) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-900">
                <Sparkles className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <h2 className="text-base font-bold">Mode Belajar Lokal (Siswa Tanpa Login)</h2>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                Siswa dapat langsung belajar Al-Qur’an secara offline di perangkat ini tanpa perlu akun
                Google (Smart Murotal, Smart Hifdzil &amp; Talking Duet lokal, Belajar Tajwid, dan
                latihan MAPSi).
              </p>
              <p className="text-xs leading-relaxed text-slate-500">
                Mode ini bersifat belajar mandiri di perangkat dan tidak memberikan akses Portal Guru,
                Admin Sekolah, maupun data PII sekolah di cloud.
              </p>

              <button
                type="button"
                onClick={onEnterLocalLearningMode}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/30 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
              >
                Buka Mode Belajar Siswa Offline
              </button>
            </div>
          </div>
        ) : (
          /* Signed-in but inactive / pending approval */
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-900">
              <Clock className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-base font-bold">
                Akun Terverifikasi — Menunggu Aktivasi Peran Sekolah
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              Akun Google Anda (<strong>{signedInUser.email}</strong>) berhasil diverifikasi, tetapi
              peran akses sekolah belum diaktifkan oleh Admin Sekolah / Super Admin.
            </p>
            <div className="rounded-xl border border-amber-200 bg-white p-3.5 text-xs space-y-1">
              <p>
                Nama Tampilan: <strong>{signedInUser.display_name}</strong>
              </p>
              <p>
                UID Akun (berikan ke Admin): <code className="font-mono">{signedInUser.uid}</code>
              </p>
              <p>
                Status Saat Ini: <span className="font-semibold text-amber-800">Menunggu Aktivasi</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={authLoading}
                onClick={() => void onRefreshAccountStatus()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Periksa Status Aktivasi
              </button>
              <button
                type="button"
                onClick={onEnterLocalLearningMode}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Lanjut Mode Belajar Lokal
              </button>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Keluar Akun
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
