import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapsiDifficulty,
  MapsiQuestion,
  QariCatalogItem,
  QuestionPackage,
  QuizResult,
  TajwidDifficulty,
  TajwidExample,
  TajwidQuestion,
  TajwidTopic,
} from '../types/simtaq';
import { analyzeStudentTajwidInsights, resolvePackageQuestions } from '../utils/schoolAnalytics';
import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Volume2,
  XCircle,
} from 'lucide-react';

interface TajwidAndMapsiViewProps {
  initialSection?: 'tajwid' | 'mapsi';
  studentId: string;
  topics: TajwidTopic[];
  examples: TajwidExample[];
  tajwidQuestions: TajwidQuestion[];
  mapsiQuestions: MapsiQuestion[];
  questionPackages: QuestionPackage[];
  qaris: QariCatalogItem[];
  quizResults: QuizResult[];
  onSaveQuizResult: (result: QuizResult) => Promise<void>;
}

function formatTimerSeconds(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TajwidAndMapsiView: React.FC<TajwidAndMapsiViewProps> = ({
  initialSection = 'tajwid',
  studentId,
  topics,
  examples,
  tajwidQuestions,
  mapsiQuestions,
  questionPackages,
  qaris,
  quizResults,
  onSaveQuizResult,
}) => {
  const [section, setSection] = useState<'tajwid' | 'mapsi'>(initialSection);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    () => [...topics].sort((a, b) => a.order_index - b.order_index)[0]?.id ?? 'tjw-ghunnah'
  );
  const [tajwidDifficultyFilter, setTajwidDifficultyFilter] = useState<TajwidDifficulty | 'Semua'>('Semua');
  const [tajwidQuizMode, setTajwidQuizMode] = useState<'visual' | 'audio' | 'mixed'>('visual');
  const [tajwidQuizActive, setTajwidQuizActive] = useState<boolean>(false);
  const [tajwidAnswers, setTajwidAnswers] = useState<Record<string, number>>({});
  const [tajwidSubmitted, setTajwidSubmitted] = useState<boolean>(false);
  const [activeTajwidPackage, setActiveTajwidPackage] = useState<QuestionPackage | null>(null);

  // MAPSi states
  const [mapsiDifficulty, setMapsiDifficulty] = useState<MapsiDifficulty | 'Semua'>('Semua');
  const [mapsiActive, setMapsiActive] = useState<boolean>(false);
  const [mapsiAnswers, setMapsiAnswers] = useState<Record<string, number>>({});
  const [mapsiSubmitted, setMapsiSubmitted] = useState<boolean>(false);
  const [activeMapsiPackage, setActiveMapsiPackage] = useState<QuestionPackage | null>(null);

  // Shared Package Timer & Replay Limits
  const [quizStartTime, setQuizStartTime] = useState<number>(Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [replayCounts, setReplayCounts] = useState<Record<string, number>>({});
  const [audioMsg, setAudioMsg] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const sortedTopics = useMemo(
    () =>
      [...topics]
        .sort((a, b) => a.order_index - b.order_index)
        .filter((t) => tajwidDifficultyFilter === 'Semua' || t.difficulty === tajwidDifficultyFilter),
    [topics, tajwidDifficultyFilter]
  );

  const activeTopic = useMemo(
    () => sortedTopics.find((t) => t.id === selectedTopicId) ?? sortedTopics[0] ?? topics[0],
    [topics, selectedTopicId, sortedTopics]
  );

  const topicExamples = useMemo(
    () => examples.filter((e) => e.topic_id === activeTopic?.id),
    [examples, activeTopic]
  );

  const tajwidInsights = useMemo(
    () => analyzeStudentTajwidInsights(studentId, quizResults, topics),
    [studentId, quizResults, topics]
  );

  const publishedTajwidPackages = useMemo(
    () => questionPackages.filter((p) => p.module === 'tajwid' && p.status === 'published'),
    [questionPackages]
  );

  const publishedMapsiPackages = useMemo(
    () => questionPackages.filter((p) => p.module === 'mapsi' && p.status === 'published'),
    [questionPackages]
  );

  const activeTajwidQuestions = useMemo(() => {
    if (activeTajwidPackage) {
      return resolvePackageQuestions(activeTajwidPackage, tajwidQuestions, mapsiQuestions).tajwid;
    }
    const byMode = tajwidQuestions.filter(
      (q) => tajwidQuizMode === 'mixed' || q.mode === tajwidQuizMode
    );
    return byMode.length > 0 ? byMode : tajwidQuestions;
  }, [activeTajwidPackage, tajwidQuestions, mapsiQuestions, tajwidQuizMode]);

  const activeMapsiQuestions = useMemo(() => {
    if (activeMapsiPackage) {
      return resolvePackageQuestions(activeMapsiPackage, tajwidQuestions, mapsiQuestions).mapsi;
    }
    const filtered = mapsiQuestions.filter(
      (q) => mapsiDifficulty === 'Semua' || q.difficulty === mapsiDifficulty
    );
    return filtered.length > 0 ? filtered : mapsiQuestions;
  }, [activeMapsiPackage, tajwidQuestions, mapsiQuestions, mapsiDifficulty]);

  const playQuestionOrExampleAudio = (
    surah: number,
    ayah: number,
    questionId?: string,
    replayLimit?: number
  ) => {
    setAudioMsg(null);
    if (questionId && replayLimit && replayLimit > 0) {
      const used = replayCounts[questionId] ?? 0;
      if (used >= replayLimit) {
        setAudioMsg(`Batas putar ulang audio soal ini (${replayLimit}x) telah tercapai.`);
        return;
      }
      setReplayCounts((prev) => ({ ...prev, [questionId]: used + 1 }));
    }

    const qari = qaris[0];
    if (!qari) return;
    const s3 = String(surah).padStart(3, '0');
    const a3 = String(ayah).padStart(3, '0');
    const url = qari.audio_url_template.replace('{surah3}', s3).replace('{ayah3}', a3);
    const audio = audioPlayerRef.current ?? new Audio();
    audioPlayerRef.current = audio;
    audio.src = url;
    audio.onerror = () => {
      setAudioMsg('Contoh audio belum bisa diputar (periksa koneksi atau cache offline).');
    };
    void audio.play().catch(() => {
      setAudioMsg('Audio qari memerlukan jaringan online atau cache offline surah terkait.');
    });
  };

  const handleSubmitTajwidQuiz = async () => {
    if (tajwidSubmitted) return;
    let correct = 0;
    const weakTopics = new Set<string>();
    for (const q of activeTajwidQuestions) {
      if (tajwidAnswers[q.id] === q.correct_index) {
        correct += 1;
      } else {
        const t = topics.find((item) => item.id === q.topic_id);
        if (t) weakTopics.add(t.title);
      }
    }
    const total = activeTajwidQuestions.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const durSec = Math.max(1, Math.round((Date.now() - quizStartTime) / 1000));
    setTajwidSubmitted(true);
    setRemainingSeconds(null);

    await onSaveQuizResult({
      id: `qr-tjw-${Date.now()}`,
      student_id: studentId,
      module: 'tajwid',
      package_title:
        activeTajwidPackage?.title ?? `Latihan Tajwid (${tajwidQuizMode.toUpperCase()})`,
      total_questions: total,
      correct_count: correct,
      accuracy_percent: accuracy,
      duration_seconds: durSec,
      weak_topics: Array.from(weakTopics),
      weak_surahs: [],
      completed_at: new Date().toISOString(),
    });
  };

  const handleSubmitMapsiQuiz = async () => {
    if (mapsiSubmitted) return;
    let correct = 0;
    const weakSurahs = new Set<string>();
    for (const q of activeMapsiQuestions) {
      if (mapsiAnswers[q.id] === q.correct_index) {
        correct += 1;
      } else {
        weakSurahs.add(q.surah_name);
      }
    }
    const total = activeMapsiQuestions.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const durSec = Math.max(1, Math.round((Date.now() - quizStartTime) / 1000));
    setMapsiSubmitted(true);
    setRemainingSeconds(null);

    await onSaveQuizResult({
      id: `qr-mapsi-${Date.now()}`,
      student_id: studentId,
      module: 'mapsi',
      package_title: activeMapsiPackage?.title ?? `MAPSi Challenge (${mapsiDifficulty})`,
      total_questions: total,
      correct_count: correct,
      accuracy_percent: accuracy,
      duration_seconds: durSec,
      weak_topics: [],
      weak_surahs: Array.from(weakSurahs),
      completed_at: new Date().toISOString(),
    });
  };

  // Countdown timer for active QuestionPackage runs
  useEffect(() => {
    const isRunning =
      remainingSeconds !== null &&
      remainingSeconds > 0 &&
      ((tajwidQuizActive && !tajwidSubmitted) || (mapsiActive && !mapsiSubmitted));
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          window.clearInterval(timer);
          if (tajwidQuizActive && !tajwidSubmitted) {
            void handleSubmitTajwidQuiz();
          } else if (mapsiActive && !mapsiSubmitted) {
            void handleSubmitMapsiQuiz();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remainingSeconds, tajwidQuizActive, tajwidSubmitted, mapsiActive, mapsiSubmitted]);

  return (
    <div className="space-y-6">
      {/* Module Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSection('tajwid')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
              section === 'tajwid' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Belajar Tajwid Interaktif
          </button>
          <button
            type="button"
            onClick={() => setSection('mapsi')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
              section === 'mapsi' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            MAPSi Hifdzil Challenge
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Nilai kuis latihan membantu pemahaman dan tidak otomatis menggantikan uji setoran guru.
        </p>
      </div>

      {section === 'tajwid' ? (
        <div className="space-y-6">
          {/* Student Tajwid Insight Summary */}
          {tajwidInsights.latest_accuracy !== null && (
            <section className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-3 text-xs">
              <div>
                <p className="font-semibold text-emerald-900">Akurasi Tajwid Terakhir</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-950 tabular-nums">
                  {tajwidInsights.latest_accuracy}%
                </p>
              </div>
              <div>
                <p className="font-semibold text-emerald-900">Materi Dikuasai</p>
                <p className="mt-1 text-slate-700">
                  {tajwidInsights.mastered_topics.length > 0
                    ? tajwidInsights.mastered_topics.join(', ')
                    : 'Selesaikan latihan untuk memetakan materi.'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-amber-900">Perlu Diulang Lagi</p>
                <p className="mt-1 text-amber-950">
                  {tajwidInsights.needs_practice_topics.length > 0
                    ? tajwidInsights.needs_practice_topics.join(', ')
                    : 'Bagus! Tidak ada topik keliru pada latihan terakhir.'}
                </p>
              </div>
            </section>
          )}

          {/* Tajwid Curriculum + Lesson */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Topic List */}
            <aside className="lg:col-span-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">Materi Tajwid (A–I)</h2>
                <select
                  aria-label="Filter tingkat kesulitan tajwid"
                  value={tajwidDifficultyFilter}
                  onChange={(e) => setTajwidDifficultyFilter(e.target.value as TajwidDifficulty | 'Semua')}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="Semua">Semua Tingkat</option>
                  <option value="Sangat Mudah">Sangat Mudah</option>
                  <option value="Mudah">Mudah</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Sulit">Sulit</option>
                  <option value="Tantangan">Tantangan</option>
                </select>
              </div>

              <div className="space-y-1.5 max-h-[540px] overflow-y-auto pr-1">
                {sortedTopics.map((topic) => {
                  const active = topic.id === activeTopic?.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                        setTajwidQuizActive(false);
                        setActiveTajwidPackage(null);
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-emerald-700 bg-emerald-50/70'
                          : 'border-slate-100 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-semibold" style={{ color: topic.color_hex }}>
                          {topic.category_code}. {topic.category_name}
                        </span>
                        <span>{topic.difficulty}</span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-900">{topic.title}</p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Lesson Detail & Interactive Quiz */}
            <div className="lg:col-span-8 space-y-6">
              {activeTopic && !tajwidQuizActive && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Kategori {activeTopic.category_code} · {activeTopic.difficulty} · Status:{' '}
                        {activeTopic.verification_status === 'verified'
                          ? 'Terverifikasi Kurikulum'
                          : 'Menunggu Verifikasi Guru'}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">{activeTopic.title}</h2>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: activeTopic.color_hex }}
                        aria-hidden="true"
                      />
                      <span>Legenda: {activeTopic.color_label}</span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                      <h3 className="text-xs font-bold text-emerald-900">Pengertian Sederhana</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">
                        {activeTopic.simple_definition}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/50 p-4">
                      <h3 className="text-xs font-bold text-emerald-900">Penjelasan Ramah Siswa SD</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-800">
                        {activeTopic.sd_explanation}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 text-sm">
                    <div className="rounded-xl border border-slate-100 p-3.5">
                      <p className="text-xs font-bold text-slate-500">Huruf / Kondisi Penyebab</p>
                      {/[a-zA-Z]/.test(activeTopic.trigger_letters) ? (
                        <p dir="auto" className="mt-1.5 text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
                          {activeTopic.trigger_letters}
                        </p>
                      ) : (
                        <p className="mt-1 font-arabic text-xl text-right text-slate-900">
                          {activeTopic.trigger_letters}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3.5">
                      <p className="text-xs font-bold text-slate-500">Cara Mengenali</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        {activeTopic.how_to_recognize}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3.5">
                      <p className="text-xs font-bold text-slate-500">Cara Membaca</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        {activeTopic.how_to_read}
                      </p>
                    </div>
                  </div>

                  {/* Visual Ayat Examples */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Contoh Visual Ayat Al-Qur’an &amp; Audio
                    </h3>
                    {topicExamples.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Contoh ayat tervalidasi untuk topik ini sedang disiapkan guru.
                      </p>
                    ) : (
                      topicExamples.map((ex) => (
                        <div
                          key={ex.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-800">
                              QS. {ex.surah_name} ({ex.surah_number}) : Ayat {ex.ayah_number} ·{' '}
                              {ex.hukum_tajwid}
                            </span>
                            <button
                              type="button"
                              onClick={() => playQuestionOrExampleAudio(ex.audio_surah, ex.audio_ayah)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                            >
                              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Dengarkan Contoh
                            </button>
                          </div>

                          <p className="font-arabic text-right text-3xl leading-[2.4] text-slate-900">
                            <span>{ex.arabic_prefix}</span>
                            <span
                              className="tajwid-seg underline decoration-2 underline-offset-8"
                              style={{ color: activeTopic.color_hex }}
                            >
                              {ex.highlighted_segment}
                            </span>
                            <span>{ex.arabic_suffix}</span>
                          </p>

                          <p className="text-xs leading-relaxed text-slate-700">{ex.explanation}</p>
                          {ex.comparison_note && (
                            <p className="text-xs text-amber-800">Pembanding: {ex.comparison_note}</p>
                          )}
                        </div>
                      ))
                    )}
                    {audioMsg && <p className="text-xs font-medium text-amber-800">{audioMsg}</p>}
                  </div>

                  {/* Start Tajwid Quiz Bar */}
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-700">Mode Kuis:</span>
                        {(['visual', 'audio', 'mixed'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setTajwidQuizMode(m)}
                            className={`rounded-md border px-2.5 py-1 font-semibold ${
                              tajwidQuizMode === m
                                ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {m === 'visual' ? 'Tebak Visual' : m === 'audio' ? 'Tebak Audio' : 'Campuran'}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTajwidPackage(null);
                          setTajwidAnswers({});
                          setTajwidSubmitted(false);
                          setReplayCounts({});
                          setRemainingSeconds(null);
                          setQuizStartTime(Date.now());
                          setTajwidQuizActive(true);
                        }}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        Mulai Latihan Tajwid
                      </button>
                    </div>

                    {publishedTajwidPackages.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <span className="font-semibold text-slate-600">Paket Kuis Guru:</span>
                        {publishedTajwidPackages.map((pkg) => (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => {
                              setActiveTajwidPackage(pkg);
                              setTajwidAnswers({});
                              setTajwidSubmitted(false);
                              setReplayCounts({});
                              setRemainingSeconds(pkg.duration_seconds);
                              setQuizStartTime(Date.now());
                              setTajwidQuizActive(true);
                            }}
                            className="rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-900 hover:bg-emerald-100"
                          >
                            {pkg.title} ({Math.round(pkg.duration_seconds / 60)} mnt)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Tajwid Interactive Multiple Choice Quiz */}
              {tajwidQuizActive && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {activeTajwidPackage
                          ? activeTajwidPackage.title
                          : `Latihan Identifikasi Tajwid (${tajwidQuizMode.toUpperCase()})`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Pilih satu jawaban yang paling tepat (A–D).
                        {activeTajwidPackage
                          ? ` Batas putar audio: ${activeTajwidPackage.audio_replay_limit}x per soal.`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {remainingSeconds !== null && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 font-mono text-xs font-bold text-amber-900 tabular-nums">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatTimerSeconds(remainingSeconds)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setTajwidQuizActive(false);
                          setRemainingSeconds(null);
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Kembali ke Materi
                      </button>
                    </div>
                  </div>

                  {audioMsg && <p className="text-xs font-medium text-amber-800">{audioMsg}</p>}

                  {activeTajwidQuestions.map((q, qIdx) => {
                    const selected = tajwidAnswers[q.id];
                    const isCorrect = selected === q.correct_index;
                    const limit = activeTajwidPackage?.audio_replay_limit;
                    const used = replayCounts[q.id] ?? 0;
                    return (
                      <div key={q.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">
                            Soal {qIdx + 1} · {q.difficulty} · QS. {q.surah_name} : {q.ayah_number}
                          </span>
                          {q.mode !== 'visual' && (
                            <button
                              type="button"
                              onClick={() =>
                                playQuestionOrExampleAudio(q.surah_number, q.ayah_number, q.id, limit)
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                              Audio Soal {limit ? `(${used}/${limit})` : ''}
                            </button>
                          )}
                        </div>

                        <p className="text-sm font-semibold text-slate-900">{q.prompt}</p>

                        {(q.mode !== 'audio' || tajwidSubmitted) && q.highlighted_segment && (
                          <p className="font-arabic rounded-xl bg-slate-50 px-4 py-2 text-right text-2xl leading-[2.2] text-slate-900">
                            <span>{q.arabic_prefix}</span>
                            <span className="tajwid-seg text-emerald-700 underline decoration-2 underline-offset-8">
                              {q.highlighted_segment}
                            </span>
                            <span>{q.arabic_suffix}</span>
                          </p>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          {q.options.map((opt, oIdx) => {
                            const letter = ['A', 'B', 'C', 'D'][oIdx];
                            const chosen = selected === oIdx;
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                disabled={tajwidSubmitted}
                                onClick={() => setTajwidAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                                className={`rounded-lg border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                                  tajwidSubmitted
                                    ? oIdx === q.correct_index
                                      ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                                      : chosen
                                        ? 'border-red-400 bg-red-50 text-red-900'
                                        : 'border-slate-200 text-slate-500'
                                    : chosen
                                      ? 'border-emerald-700 bg-emerald-700 text-white'
                                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                }`}
                              >
                                {letter}. {opt}
                              </button>
                            );
                          })}
                        </div>

                        {tajwidSubmitted && (
                          <div
                            className={`rounded-lg p-3 text-xs ${
                              isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'
                            }`}
                          >
                            <p className="font-bold flex items-center gap-1.5">
                              {isCorrect ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-emerald-700" /> Jawaban Benar
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-red-600" /> Jawaban Tepat:{' '}
                                  {q.options[q.correct_index]}
                                </>
                              )}
                            </p>
                            <p className="mt-1 leading-relaxed">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!tajwidSubmitted ? (
                    <button
                      type="button"
                      onClick={() => void handleSubmitTajwidQuiz()}
                      className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Periksa &amp; Simpan Hasil Tajwid
                    </button>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                      Hasil latihan tajwid tersimpan di perangkat Anda.
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* MAPSi Hifdzil Challenge */
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <Award className="h-4 w-4" aria-hidden="true" />
                  <span>MAPSi Hifdzil Challenge (Latihan Internal Sekolah)</span>
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Kuis Hafalan &amp; Simulasi Lomba MAPSi
                </h2>
                <p className="text-xs text-slate-600">
                  Catatan: Format simulasi ini adalah latihan persiapan internal sekolah dan bukan klaim
                  format resmi panitia lomba sebelum diverifikasi pedoman MAPSi yang berlaku.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {remainingSeconds !== null && mapsiActive && !mapsiSubmitted && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-mono text-xs font-bold text-amber-900 tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatTimerSeconds(remainingSeconds)}
                  </span>
                )}
                <select
                  aria-label="Tingkat kesulitan MAPSi"
                  value={mapsiDifficulty}
                  onChange={(e) => setMapsiDifficulty(e.target.value as MapsiDifficulty | 'Semua')}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="Semua">Semua Tingkat</option>
                  <option value="Pemula">Pemula</option>
                  <option value="Menengah">Menengah</option>
                  <option value="Mahir">Mahir</option>
                  <option value="Simulasi MAPSi">Simulasi MAPSi</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMapsiPackage(null);
                    setMapsiAnswers({});
                    setMapsiSubmitted(false);
                    setReplayCounts({});
                    setRemainingSeconds(null);
                    setQuizStartTime(Date.now());
                    setMapsiActive(true);
                  }}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                >
                  Mulai Latihan Bebas
                </button>
              </div>
            </div>

            {/* Published Question Packages for MAPSi */}
            {publishedMapsiPackages.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
                <p className="text-xs font-bold text-amber-950">
                  Paket Simulasi MAPSi Terjadwal (Dengan Timer &amp; Batas Putar Audio)
                </p>
                <div className="flex flex-wrap gap-2">
                  {publishedMapsiPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => {
                        setActiveMapsiPackage(pkg);
                        setMapsiAnswers({});
                        setMapsiSubmitted(false);
                        setReplayCounts({});
                        setRemainingSeconds(pkg.duration_seconds);
                        setQuizStartTime(Date.now());
                        setMapsiActive(true);
                      }}
                      className="rounded-lg border border-amber-400/50 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                    >
                      {pkg.title} · {pkg.question_ids.length} Soal · {Math.round(pkg.duration_seconds / 60)} mnt · Audio maks {pkg.audio_replay_limit}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {audioMsg && <p className="text-xs font-medium text-amber-800">{audioMsg}</p>}

            {mapsiActive && (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                {activeMapsiPackage && (
                  <p className="text-xs font-bold text-emerald-900">
                    Paket Aktif: {activeMapsiPackage.title} ({activeMapsiPackage.difficulty})
                  </p>
                )}
                {activeMapsiQuestions.map((q, idx) => {
                  const chosenIdx = mapsiAnswers[q.id];
                  const isCorrect = chosenIdx === q.correct_index;
                  const limit = activeMapsiPackage?.audio_replay_limit;
                  const used = replayCounts[q.id] ?? 0;
                  return (
                    <div key={q.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-emerald-800">
                          Soal {idx + 1} · {q.question_type} · {q.difficulty}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            playQuestionOrExampleAudio(q.surah_number, q.ayah_number, q.id, limit)
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Volume2 className="h-3.5 w-3.5 text-emerald-700" />
                          Audio Ayat {limit ? `(${used}/${limit})` : ''}
                        </button>
                      </div>

                      <p className="text-sm font-semibold text-slate-900">{q.prompt}</p>
                      {q.arabic_snippet && (
                        <p className="font-arabic rounded-xl bg-slate-50 px-4 py-2 text-right text-2xl text-slate-900">
                          {q.arabic_snippet}
                        </p>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map((opt, oIdx) => {
                          const letter = ['A', 'B', 'C', 'D'][oIdx];
                          const isArabicOpt = /[\u0600-\u06FF]/.test(opt);
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              disabled={mapsiSubmitted}
                              onClick={() => setMapsiAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                              className={`rounded-lg border px-3.5 py-2.5 text-left transition ${
                                isArabicOpt ? 'font-arabic text-xl text-right' : 'text-xs font-semibold'
                              } ${
                                mapsiSubmitted
                                  ? oIdx === q.correct_index
                                    ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                                    : chosenIdx === oIdx
                                      ? 'border-red-400 bg-red-50 text-red-900'
                                      : 'border-slate-200 text-slate-500'
                                  : chosenIdx === oIdx
                                    ? 'border-emerald-700 bg-emerald-700 text-white'
                                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                              }`}
                            >
                              {letter}. {opt}
                            </button>
                          );
                        })}
                      </div>

                      {mapsiSubmitted && (
                        <div
                          className={`rounded-lg p-3 text-xs ${
                            isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'
                          }`}
                        >
                          <p className="font-bold">
                            {isCorrect ? 'Tepat!' : `Jawaban Benar: ${q.options[q.correct_index]}`}
                          </p>
                          <p className="mt-1">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!mapsiSubmitted && (
                  <button
                    type="button"
                    onClick={() => void handleSubmitMapsiQuiz()}
                    className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Selesai &amp; Hitung Nilai MAPSi
                  </button>
                )}
              </div>
            )}
          </section>

          {/* MAPSi Analytics History */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <BookOpenCheck className="h-4 w-4 text-emerald-700" />
              <h3 className="text-base font-bold text-slate-900">Riwayat &amp; Analitik MAPSi / Tajwid</h3>
            </div>
            {quizResults.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Belum ada riwayat kuis.</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quizResults.slice(0, 6).map((res) => (
                  <div key={res.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs">
                    <p className="font-bold text-slate-900">{res.package_title}</p>
                    <p className="mt-1 font-mono text-lg font-bold text-emerald-800 tabular-nums">
                      {res.accuracy_percent}% ({res.correct_count}/{res.total_questions})
                    </p>
                    <p className="mt-1 text-slate-500 tabular-nums">
                      Waktu: {res.duration_seconds} dtk · {res.completed_at.slice(0, 10)}
                    </p>
                    {(res.weak_surahs.length > 0 || res.weak_topics.length > 0) && (
                      <p className="mt-1.5 text-amber-800">
                        Perlu diulang: {[...res.weak_surahs, ...res.weak_topics].join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
