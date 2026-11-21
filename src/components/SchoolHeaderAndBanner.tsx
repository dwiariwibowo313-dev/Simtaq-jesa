import React, { useState } from 'react';
import {
  Announcement,
  AnnouncementRead,
  SCHOOL_NAME,
  SCHOOL_SLOGAN,
  SchoolSettings,
  UserAccount,
  UserRole,
} from '../types/simtaq';
import {
  BookOpenCheck,
  Check,
  LogIn,
  LogOut,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface TopHeaderProps {
  settings: SchoolSettings;
  activeUser: UserAccount | null;
  isAuthenticated: boolean;
  isLocalLearningMode: boolean;
  activePageTitle: string;
  isOnline: boolean;
  pendingSyncCount: number;
  onSyncNow: () => void;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  school_admin: 'Admin Sekolah',
  teacher: 'Guru / Muhafidz',
  student: 'Portal Siswa',
  guardian: 'Portal Wali',
};

export const SchoolTopHeader: React.FC<TopHeaderProps> = ({
  settings,
  activeUser,
  isAuthenticated,
  isLocalLearningMode,
  activePageTitle,
  isOnline,
  pendingSyncCount,
  onSyncNow,
  onGoogleSignIn,
  onSignOut,
}) => {
  return (
    <header className="sm:sticky sm:top-0 z-30 border-b border-emerald-900/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        {/* Zone 1: School Identity */}
        <div className="flex min-w-0 items-center gap-3">
          {settings.logo_data_url ? (
            <img
              src={settings.logo_data_url}
              alt="Logo SDN Jetiskarangpung 1"
              referrerPolicy="no-referrer"
              className="h-10 w-10 shrink-0 rounded-xl border border-emerald-900/10 object-contain bg-white p-0.5"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-amber-300 shadow-xs"
              aria-hidden="true"
            >
              <BookOpenCheck className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold tracking-tight text-emerald-950 sm:text-base">
                {settings.school_name || SCHOOL_NAME}
              </span>
            </div>
            <p className="truncate text-xs font-medium text-amber-800">
              {settings.slogan || SCHOOL_SLOGAN}
            </p>
          </div>
        </div>

        {/* Zone 2: Active Portal & Page Context */}
        <div className="hidden lg:flex items-center gap-2 text-sm text-slate-600">
          <span className="font-semibold text-emerald-800 whitespace-nowrap">
            {isAuthenticated && activeUser
              ? ROLE_LABELS[activeUser.role]
              : isLocalLearningMode
                ? 'Mode Belajar Lokal'
                : 'Gerbang Autentikasi'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate max-w-48 font-medium text-slate-800">{activePageTitle}</span>
        </div>

        {/* Zone 3: Connectivity, Verified Google Auth / Sign-Out, PWA Install */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end shrink-0">
          <button
            type="button"
            onClick={onSyncNow}
            title={
              isOnline
                ? `Online · ${pendingSyncCount} data menunggu sinkronisasi`
                : `Offline · ${pendingSyncCount} data tersimpan aman di perangkat`
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition whitespace-nowrap shrink-0 ${
              isOnline
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100'
                : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
          >
            {isOnline ? (
              <RefreshCw className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
            )}
            <span className="tabular-nums">
              {isOnline ? 'Sinkron' : 'Offline'} ({pendingSyncCount})
            </span>
          </button>

          {isAuthenticated && activeUser ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block max-w-[160px] truncate rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-950">
                {activeUser.display_name}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                Keluar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Masuk Google
            </button>
          )}

          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};

interface SchoolInfoBannerProps {
  role: UserRole;
  userName: string;
}

const STUDENT_MOTIVATIONS = [
  'Ayo belajar dan menghafal Al-Qur’an dengan semangat!',
  'Setiap ayat yang dipelajari adalah langkah menuju kebaikan.',
  'Terus berlatih, rajin murajaah, dan jadilah generasi berprestasi.',
  'Belajar dengan tekun, berakhlak mulia, dan pantang menyerah.',
];

export const SchoolInfoBanner: React.FC<SchoolInfoBannerProps> = ({ role, userName }) => {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const isStudentOrGuardian = role === 'student' || role === 'guardian';

  return (
    <section
      aria-label="Pesan Informasi Sekolah"
      className="rounded-2xl border border-emerald-800/15 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800 p-5 text-white shadow-xs"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-amber-200">
            <span>{SCHOOL_NAME}</span>
            <span aria-hidden="true">·</span>
            <span>{SCHOOL_SLOGAN}</span>
          </div>
          {isStudentOrGuardian ? (
            <>
              <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                Selamat Datang di SIMTAQ, {userName}!
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-emerald-50">
                “Belajar Al-Qur’an, memperkuat hafalan, memperindah bacaan, dan meraih prestasi.”{' '}
                <span className="font-medium text-amber-200">
                  — {STUDENT_MOTIVATIONS[quoteIdx]}
                </span>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Pesan Informasi Sekolah — {ROLE_LABELS[role]} ({userName})
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-emerald-50">
                SDN Jetiskarangpung 1 · Sekolah Negeri Berkarakter Islami, Sekolah Para Juara. Mode
                penyimpanan lokal offline-first aktif untuk mendukung pembelajaran hemat kuota.
              </p>
            </>
          )}
        </div>

        {isStudentOrGuardian && (
          <button
            type="button"
            onClick={() => setQuoteIdx((prev) => (prev + 1) % STUDENT_MOTIVATIONS.length)}
            className="self-start sm:self-center rounded-lg border border-amber-300/40 bg-emerald-900/40 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-emerald-900/70 whitespace-nowrap shrink-0"
          >
            Pesan Semangat Lainnya
          </button>
        )}
      </div>

      {role === 'super_admin' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-emerald-950/50 px-3 py-2 text-xs text-amber-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>
            <strong>SIMTAQ v1.2 Aktif (Terotentikasi):</strong> Sesi Super Admin (
            <code>dwiariwibowo313@gmail.com</code>) terverifikasi Google Sign-In, terkunci via
            dokumen atomic <code>/system_bootstrap/super_admin</code>, dengan sinkronisasi dua arah
            Firestore &amp; manajemen sekolah penuh.
          </span>
        </div>
      )}
    </section>
  );
};

interface AnnouncementFeedProps {
  announcements: Announcement[];
  reads: AnnouncementRead[];
  userUid: string;
  onMarkRead: (announcementId: string) => void;
}

export const AnnouncementFeed: React.FC<AnnouncementFeedProps> = ({
  announcements,
  reads,
  userUid,
  onMarkRead,
}) => {
  const readSet = new Set(reads.filter((r) => r.user_uid === userUid).map((r) => r.announcement_id));

  if (announcements.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Megaphone className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h3>Pengumuman Sekolah</h3>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Belum ada pengumuman aktif untuk peran atau kelas Anda saat ini.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Pengumuman Sekolah" className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900">Pengumuman Sekolah</h3>
        </div>
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          {announcements.length} pengumuman aktif
        </span>
      </div>

      <div className="mt-3 divide-y divide-slate-100">
        {announcements.map((item) => {
          const isRead = readSet.has(item.id);
          return (
            <article key={item.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span
                      className={`font-semibold ${
                        item.priority === 'Mendesak'
                          ? 'text-amber-800'
                          : item.priority === 'Penting'
                            ? 'text-emerald-800'
                            : 'text-slate-600'
                      }`}
                    >
                      Prioritas: {item.priority}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.author_name}</span>
                    {!isRead && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-700">Baru</span>
                      </>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                  <p className="text-sm leading-relaxed text-slate-600">{item.body}</p>
                </div>

                <div className="shrink-0">
                  {isRead ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 whitespace-nowrap">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Sudah dibaca
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMarkRead(item.id)}
                      className="rounded-lg border border-emerald-700/25 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      Tandai Dibaca
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
