import React, { useMemo, useState } from 'react';
import {
  Announcement,
  AnnouncementRead,
  MemorizationRecord,
  MurajaahRecord,
  QuizResult,
  QuranSurah,
  Student,
  TahfidzTarget,
} from '../types/simtaq';
import { calculateStudentHafalanSummary } from '../utils/tahfidzMetrics';
import { AnnouncementFeed } from './SchoolHeaderAndBanner';
import { BookOpen, CheckCircle2, Clock, RefreshCw, Sparkles, Target } from 'lucide-react';

interface StudentPortalViewProps {
  student: Student;
  isGuardianView: boolean;
  memorizationRecords: MemorizationRecord[];
  murajaahRecords: MurajaahRecord[];
  targets: TahfidzTarget[];
  surahs: QuranSurah[];
  quizResults: QuizResult[];
  announcements: Announcement[];
  reads: AnnouncementRead[];
  userUid: string;
  onMarkAnnouncementRead: (id: string) => void;
  onNavigateModule: (tab: 'murotal' | 'hifdzil' | 'tajwid' | 'mapsi') => void;
}

const STATUS_LABEL: Record<MemorizationRecord['status'], string> = {
  lulus: 'Lulus',
  perlu_perbaikan: 'Perlu Perbaikan',
  menunggu_penilaian: 'Menunggu Penilaian',
};

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  student,
  isGuardianView,
  memorizationRecords,
  murajaahRecords,
  targets,
  surahs,
  quizResults,
  announcements,
  reads,
  userUid,
  onMarkAnnouncementRead,
  onNavigateModule,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'all' | '30d'>('all');

  const filteredSetoran = useMemo(() => {
    const base = memorizationRecords.filter((r) => r.student_id === student.id);
    if (periodFilter === 'all') return base;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return base.filter((r) => r.date >= cutoffStr);
  }, [memorizationRecords, student.id, periodFilter]);

  const studentMurajaah = useMemo(
    () =>
      murajaahRecords
        .filter((r) => r.student_id === student.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [murajaahRecords, student.id]
  );

  const summary = useMemo(
    () =>
      calculateStudentHafalanSummary(
        student.id,
        filteredSetoran,
        studentMurajaah,
        targets,
        surahs,
        student.class_id,
        student.halaqah_id
      ),
    [student, filteredSetoran, studentMurajaah, targets, surahs]
  );

  const studentQuizzes = quizResults
    .filter((q) => q.student_id === student.id)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));

  const recentSetoran = [...filteredSetoran].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      {/* Quick Learning Entry Cards for Siswa */}
      {!isGuardianView && (
        <section aria-label="Menu Belajar Utama Siswa" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => onNavigateModule('murotal')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-emerald-800/15 bg-white p-4 text-left transition hover:border-emerald-700 hover:bg-emerald-50/40"
          >
            <span className="text-sm font-bold text-emerald-900">Smart Murotal</span>
            <span className="text-xs leading-relaxed text-slate-600">
              Dengarkan audio qari per ayat dengan pengulangan dan jeda.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('hifdzil')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-emerald-800/15 bg-white p-4 text-left transition hover:border-emerald-700 hover:bg-emerald-50/40"
          >
            <span className="text-sm font-bold text-emerald-900">Smart Hifdzil &amp; Duet</span>
            <span className="text-xs leading-relaxed text-slate-600">
              Latihan hafalan bertahap, sembunyikan ayat, dan Talking Duet.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('tajwid')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-emerald-800/15 bg-white p-4 text-left transition hover:border-emerald-700 hover:bg-emerald-50/40"
          >
            <span className="text-sm font-bold text-emerald-900">Belajar Tajwid</span>
            <span className="text-xs leading-relaxed text-slate-600">
              Materi hukum bacaan berwarna visual, contoh audio, dan latihan.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('mapsi')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-50/40 p-4 text-left transition hover:border-amber-600 hover:bg-amber-50"
          >
            <span className="text-sm font-bold text-amber-900">MAPSi Hifdzil Challenge</span>
            <span className="text-xs leading-relaxed text-slate-600">
              Tantangan sambung ayat, tebak surah, dan latihan simulasi.
            </span>
          </button>
        </section>
      )}

      {/* ADDENDUM 29: LAPORAN CAPAIAN HAFALAN SAYA */}
      <section
        aria-label="Laporan Capaian Hafalan"
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isGuardianView
                ? `Perkembangan Hafalan Ananda — ${student.full_name}`
                : 'Laporan Capaian Hafalan Saya'}
            </h2>
            <p className="text-xs text-slate-500">
              Hanya menghitung ayat unik dari setoran hafalan baru yang telah dinilai dan disahkan Lulus oleh guru.
            </p>
          </div>

          {memorizationRecords.some((r) => r.student_id === student.id) && (
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start">
              <button
                type="button"
                onClick={() => setPeriodFilter('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  periodFilter === 'all'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Periode
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('30d')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  periodFilter === '30d'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Hari Terakhir
              </button>
            </div>
          )}
        </div>

        {/* 4 Main KPI Metrics */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-900">
              <span>Surah Lulus</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-950 tabular-nums">
              {summary.total_completed_surahs}
            </p>
            <p className="mt-1 text-xs text-slate-600">Tuntas dan disahkan guru</p>
          </div>

          <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-900">
              <span>Ayat Unik Lulus</span>
              <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-950 tabular-nums">
              {summary.total_passed_unique_ayahs}
            </p>
            <p className="mt-1 text-xs text-slate-600">Tanpa penghitungan ganda</p>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-amber-900">
              <span>Capaian Target</span>
              <Target className="h-4 w-4 text-amber-700" aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-amber-950 tabular-nums">
              {summary.target_percentage}%
            </p>
            <p className="mt-1 text-xs text-slate-600 tabular-nums">
              {summary.target_realized_ayahs} / {summary.target_ayah_count || 0} ayat target
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700">
              <span>Setoran Terakhir</span>
              <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </div>
            <p className="mt-2 truncate text-sm font-bold text-slate-900">
              {summary.last_submission_range ?? 'Belum ada setoran'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {summary.last_submission_status
                ? `Status: ${STATUS_LABEL[summary.last_submission_status]}`
                : 'Ayo mulai setoran pertama'}
            </p>
          </div>
        </div>

        {/* Target Progress Bar */}
        {summary.target_ayah_count > 0 && (
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-800">
                {summary.target_period_label ?? 'Target Periode Berjalan'}
              </span>
              <span className="font-mono font-semibold text-emerald-800 tabular-nums">
                {summary.target_realized_ayahs} dari {summary.target_ayah_count} ayat ({summary.target_percentage}%)
              </span>
            </div>
            <div
              className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={summary.target_percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Persentase capaian target hafalan"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-amber-500 transition-all"
                style={{ width: `${summary.target_percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Surah Breakdown Cards & Visual Bar Chart */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Grafik Capaian Ayat Lulus per Surah</h3>
            {summary.surah_breakdown.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Belum ada setoran berstatus Lulus pada periode ini.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {summary.surah_breakdown.map((sb) => {
                  const pct = Math.min(100, Math.round((sb.passed_unique_ayahs / sb.total_ayahs) * 100));
                  return (
                    <div key={sb.surah_number} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">
                          {sb.surah_number}. {sb.surah_name}
                        </span>
                        <span className="font-mono text-slate-600 tabular-nums">
                          {sb.passed_unique_ayahs}/{sb.total_ayahs} ayat ·{' '}
                          {sb.is_completed ? 'Selesai' : 'Sedang dipelajari'}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            sb.is_completed ? 'bg-emerald-700' : 'bg-amber-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeline Setoran Hafalan Baru */}
          <div>
            <h3 className="text-sm font-bold text-slate-900">Riwayat Setoran Hafalan Baru</h3>
            {recentSetoran.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Belum ada riwayat setoran hafalan baru.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {recentSetoran.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {rec.surah_name} · Ayat {rec.ayah_start}–{rec.ayah_end}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          rec.status === 'lulus'
                            ? 'text-emerald-700'
                            : rec.status === 'perlu_perbaikan'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {STATUS_LABEL[rec.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {rec.date} · {rec.teacher_name}
                    </p>
                    {rec.teacher_note && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                        Catatan guru: {rec.teacher_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Riwayat Murajaah Terpisah & Hasil Latihan */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <RefreshCw className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">Riwayat Murajaah (Terpisah)</h3>
          </div>
          {studentMurajaah.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada catatan murajaah.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {studentMurajaah.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      {m.surah_name} · Ayat {m.ayah_start}–{m.ayah_end}
                    </span>
                    <span className="text-xs font-medium text-emerald-800">{STATUS_LABEL[m.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {m.date} · {m.teacher_note ?? 'Murajaah terjadwal'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">Hasil Latihan Tajwid &amp; MAPSi</h3>
          </div>
          {studentQuizzes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada hasil kuis tersimpan.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {studentQuizzes.slice(0, 5).map((q) => (
                <div key={q.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{q.package_title}</span>
                    <span className="font-mono text-xs font-bold text-emerald-800 tabular-nums">
                      {q.accuracy_percent}% ({q.correct_count}/{q.total_questions})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Modul: {q.module === 'tajwid' ? 'Belajar Tajwid' : 'MAPSi Hifdzil'} ·{' '}
                    {q.completed_at.slice(0, 10)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Pengumuman Aktif */}
      <AnnouncementFeed
        announcements={announcements}
        reads={reads}
        userUid={userUid}
        onMarkRead={onMarkAnnouncementRead}
      />
    </div>
  );
};
