import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioCacheMetadata,
  LearningProgress,
  LocalAudioRecording,
  QariCatalogItem,
  QuranSurah,
  QuranVerse,
} from '../types/simtaq';
import {
  BookmarkCheck,
  Download,
  Eye,
  EyeOff,
  Mic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { clampAyahRangeForSurah, findSurahByNumber } from '../data/surahCatalog';
import { SurahSelector } from './SurahSelector';

interface SmartMurotalAndHifdzilViewProps {
  initialMode?: 'murotal' | 'hifdzil' | 'duet';
  studentId: string;
  surahs: QuranSurah[];
  verses: QuranVerse[];
  qaris: QariCatalogItem[];
  audioCacheMeta: AudioCacheMetadata[];
  localRecordings: LocalAudioRecording[];
  latestProgress?: LearningProgress | null;
  onSaveProgress: (
    activityType: 'listening' | 'smart_hifdzil' | 'talking_duet',
    surahNum: number,
    ayahNum: number,
    note: string
  ) => void;
  onSaveAudioCacheMeta: (meta: AudioCacheMetadata) => Promise<void>;
  onDeleteAudioCacheForSurah: (qariId: string, surahNumber: number) => Promise<void>;
  onSaveLocalRecording: (rec: LocalAudioRecording) => Promise<void>;
  onDeleteLocalRecording: (id: string) => Promise<void>;
}

function buildAyahAudioUrl(qari: QariCatalogItem, surahNum: number, ayahNum: number): string {
  const s3 = String(surahNum).padStart(3, '0');
  const a3 = String(ayahNum).padStart(3, '0');
  return qari.audio_url_template.replace('{surah3}', s3).replace('{ayah3}', a3);
}

const OFFLINE_AUDIO_CACHE_NAME = 'simtaq-qari-audio-v1';

const LocalRecordingRow: React.FC<{
  rec: LocalAudioRecording;
  onDelete: (id: string) => Promise<void>;
}> = ({ rec, onDelete }) => {
  const [objectUrl, setObjectUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(rec.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [rec.blob]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
      <div>
        <p className="font-semibold text-slate-900">
          {rec.surah_name} · Ayat {rec.ayah_number}
        </p>
        <p className="text-slate-500 tabular-nums">
          Durasi {rec.duration_seconds} dtk · {rec.created_at.slice(0, 16).replace('T', ' ')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {objectUrl && <audio controls src={objectUrl} className="h-8 max-w-44" />}
        <button
          type="button"
          onClick={() => void onDelete(rec.id)}
          aria-label={`Hapus rekaman ${rec.surah_name} ayat ${rec.ayah_number}`}
          className="rounded-lg border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export const SmartMurotalAndHifdzilView: React.FC<SmartMurotalAndHifdzilViewProps> = ({
  initialMode = 'murotal',
  studentId,
  surahs,
  verses,
  qaris,
  audioCacheMeta,
  localRecordings,
  latestProgress = null,
  onSaveProgress,
  onSaveAudioCacheMeta,
  onDeleteAudioCacheForSurah,
  onSaveLocalRecording,
  onDeleteLocalRecording,
}) => {
  const [mode, setMode] = useState<'murotal' | 'hifdzil' | 'duet'>(initialMode);
  const [selectedSurah, setSelectedSurah] = useState<number>(112);
  const [selectedQariId, setSelectedQariId] = useState<string>(qaris[0]?.id ?? 'alafasy');
  const [ayahStart, setAyahStart] = useState<number>(1);
  const [ayahEnd, setAyahEnd] = useState<number>(4);
  const [repeatLimit, setRepeatLimit] = useState<number>(1); // 0 means unlimited
  const [pauseSeconds, setPauseSeconds] = useState<number>(2);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [hideAyahText, setHideAyahText] = useState<boolean>(false);
  const [revealedVerseIds, setRevealedVerseIds] = useState<Record<string, boolean>>({});
  const [hifdzilMethod, setHifdzilMethod] = useState<
    'lihat_dengar' | 'dengar_ulangi' | 'sembunyikan' | 'sambung_ayat'
  >('lihat_dengar');

  const [activeAyahIdx, setActiveAyahIdx] = useState<number>(0);
  const [currentRepetition, setCurrentRepetition] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duetTurn, setDuetTurn] = useState<'idle' | 'qari' | 'student_pause' | 'recording'>('idle');
  const [duetCountdown, setDuetCountdown] = useState<number>(0);
  const [audioStatusMsg, setAudioStatusMsg] = useState<string | null>(null);
  const [downloadingSurah, setDownloadingSurah] = useState<boolean>(false);
  const [storageEstimateText, setStorageEstimateText] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const activeVerseElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const surahMeta = useMemo(
    () => findSurahByNumber(selectedSurah, surahs) ?? surahs[0],
    [surahs, selectedSurah]
  );

  const surahVerses = useMemo(() => {
    const verseByAyah = new Map<number, QuranVerse>();
    for (const v of verses) {
      if (v.surah_number === selectedSurah) {
        verseByAyah.set(v.ayah_number, v);
      }
    }
    const maxAyah = surahMeta?.ayah_count ?? 4;
    const boundedStart = Math.max(1, Math.min(ayahStart, maxAyah));
    const boundedEnd = Math.max(boundedStart, Math.min(ayahEnd, maxAyah));

    const slots: Array<QuranVerse & { hasCachedText: boolean }> = [];
    for (let ayahNum = boundedStart; ayahNum <= boundedEnd; ayahNum += 1) {
      const existing = verseByAyah.get(ayahNum);
      if (existing) {
        slots.push({ ...existing, hasCachedText: true });
      } else {
        slots.push({
          id: `${selectedSurah}:${ayahNum}`,
          surah_number: selectedSurah,
          surah_name: surahMeta?.name_latin ?? `Surah ${selectedSurah}`,
          ayah_number: ayahNum,
          arabic_text: '',
          source_reference: 'Audio Qari EveryAyah per-ayat',
          verification_status: 'verified',
          hasCachedText: false,
        });
      }
    }
    return slots;
  }, [verses, selectedSurah, surahMeta, ayahStart, ayahEnd]);

  const activeQari = useMemo(
    () => qaris.find((q) => q.id === selectedQariId) ?? qaris[0],
    [qaris, selectedQariId]
  );

  const handleSelectSurah = (surahNum: number) => {
    const meta = findSurahByNumber(surahNum, surahs);
    const maxAyah = meta?.ayah_count ?? 7;
    setSelectedSurah(surahNum);
    setAyahStart(1);
    setAyahEnd(maxAyah);
    setActiveAyahIdx(0);
    setCurrentRepetition(1);
    setRevealedVerseIds({});
    stopPlayback();
  };

  const handleResumeLastProgress = () => {
    if (!latestProgress?.surah_number) return;
    const targetSurah = latestProgress.surah_number;
    const meta = findSurahByNumber(targetSurah, surahs);
    const maxAyah = meta?.ayah_count ?? 7;
    const targetAyah = Math.max(1, Math.min(latestProgress.ayah_number ?? 1, maxAyah));
    setSelectedSurah(targetSurah);
    setAyahStart(1);
    setAyahEnd(maxAyah);
    setActiveAyahIdx(Math.max(0, targetAyah - 1));
    setCurrentRepetition(1);
    setRevealedVerseIds({});
    stopPlayback();
    setAudioStatusMsg(
      `Melanjutkan posisi terakhir: ${meta?.surah_number ?? targetSurah}. ${meta?.name_latin ?? `Surah ${targetSurah}`} Ayat ${targetAyah}.`
    );
  };

  // Storage estimate check
  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          const usedMb = ((est.usage ?? 0) / (1024 * 1024)).toFixed(1);
          setStorageEstimateText(`${usedMb} MB terpakai di penyimpanan lokal browser`);
        })
        .catch(() => {});
    }
  }, [audioCacheMeta.length, localRecordings.length]);

  useEffect(() => {
    if (activeVerseElRef.current) {
      activeVerseElRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeAyahIdx]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const clearTimers = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopPlayback = () => {
    clearTimers();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setDuetTurn('idle');
    setDuetCountdown(0);
  };

  const playVerseAtIndex = async (idx: number, repNum = 1) => {
    const verse = surahVerses[idx];
    if (!verse || !activeQari) {
      stopPlayback();
      return;
    }

    setActiveAyahIdx(idx);
    setCurrentRepetition(repNum);
    setAudioStatusMsg(null);
    setIsPlaying(true);
    if (mode === 'duet') setDuetTurn('qari');

    const remoteUrl = buildAyahAudioUrl(activeQari, verse.surah_number, verse.ayah_number);
    let srcToPlay = remoteUrl;

    try {
      if ('caches' in window) {
        const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
        const cachedResp = await cache.match(remoteUrl);
        if (cachedResp) {
          const blob = await cachedResp.blob();
          srcToPlay = URL.createObjectURL(blob);
        }
      }
    } catch {
      // Fallback to remote URL if Cache API is unavailable
    }

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = srcToPlay;
    audio.playbackRate = playbackRate;

    audio.onended = () => {
      onSaveProgress(
        mode === 'murotal' ? 'listening' : mode === 'hifdzil' ? 'smart_hifdzil' : 'talking_duet',
        verse.surah_number,
        verse.ayah_number,
        `Memutar ${verse.surah_name} ayat ${verse.ayah_number}`
      );

      const handleNextStep = () => {
        if (repeatLimit === 0 || repNum < repeatLimit) {
          void playVerseAtIndex(idx, repNum + 1);
        } else if (idx + 1 < surahVerses.length) {
          void playVerseAtIndex(idx + 1, 1);
        } else {
          stopPlayback();
        }
      };

      const effectivePause = mode === 'duet' ? Math.max(3, pauseSeconds) : pauseSeconds;
      if (effectivePause > 0) {
        if (mode === 'duet') setDuetTurn('student_pause');
        setDuetCountdown(effectivePause);
        let remaining = effectivePause;
        clearTimers();
        timerRef.current = window.setInterval(() => {
          remaining -= 1;
          setDuetCountdown(Math.max(0, remaining));
          if (remaining <= 0) {
            clearTimers();
            handleNextStep();
          }
        }, 1000);
      } else {
        handleNextStep();
      }
    };

    audio.onerror = () => {
      setIsPlaying(false);
      setDuetTurn('idle');
      setAudioStatusMsg(
        'Audio qari tidak dapat dimuat (periksa koneksi internet atau unduh audio untuk penggunaan offline).'
      );
    };

    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
      setDuetTurn('idle');
      setAudioStatusMsg(
        'Pemutaran audio memerlukan interaksi tombol Putar atau koneksi jaringan ke sumber qari.'
      );
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      clearTimers();
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      void playVerseAtIndex(activeAyahIdx, currentRepetition);
    }
  };

  const handleDownloadSurahOffline = async () => {
    if (!activeQari?.offline_allowed) {
      setAudioStatusMsg('Qari ini belum memiliki izin unduhan offline terverifikasi.');
      return;
    }
    if (!('caches' in window)) {
      setAudioStatusMsg('Browser ini tidak mendukung Cache API offline.');
      return;
    }
    setDownloadingSurah(true);
    setAudioStatusMsg('Mengunduh audio ayat ke penyimpanan lokal...');
    let successCount = 0;
    try {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      for (const v of surahVerses) {
        const url = buildAyahAudioUrl(activeQari, v.surah_number, v.ayah_number);
        const resp = await fetch(url);
        if (resp.ok) {
          const clone = resp.clone();
          const blob = await resp.blob();
          await cache.put(url, clone);
          await onSaveAudioCacheMeta({
            key: `${activeQari.id}:${v.surah_number}:${v.ayah_number}`,
            qari_id: activeQari.id,
            surah_number: v.surah_number,
            ayah_number: v.ayah_number,
            url,
            size_bytes: blob.size,
            cached_at: new Date().toISOString(),
          });
          successCount += 1;
        }
      }
      setAudioStatusMsg(`${successCount} ayat berhasil disimpan untuk pemutaran offline.`);
    } catch {
      setAudioStatusMsg(
        `Unduhan terhenti (${successCount} ayat tersimpan). Periksa koneksi atau kebijakan CORS CDN audio.`
      );
    } finally {
      setDownloadingSurah(false);
    }
  };

  const handleClearOfflineSurah = async () => {
    if (!activeQari) return;
    if ('caches' in window) {
      const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
      for (const v of surahVerses) {
        await cache.delete(buildAyahAudioUrl(activeQari, v.surah_number, v.ayah_number));
      }
    }
    await onDeleteAudioCacheForSurah(activeQari.id, selectedSurah);
    setAudioStatusMsg(`Cache audio lokal untuk Surah ${surahMeta?.name_latin ?? selectedSurah} telah dihapus.`);
  };

  const handleStartStudentRecording = async () => {
    const activeVerse = surahVerses[activeAyahIdx];
    if (!activeVerse) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAudioStatusMsg('Perangkat atau browser ini tidak mendukung perekaman mikrofon.');
      return;
    }

    try {
      stopPlayback();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      const startedAt = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        stream.getTracks().forEach((t) => t.stop());
        setDuetTurn('idle');
        void onSaveLocalRecording({
          id: `rec-${Date.now()}`,
          student_id: studentId,
          surah_number: activeVerse.surah_number,
          surah_name: activeVerse.surah_name,
          ayah_number: activeVerse.ayah_number,
          mime_type: blob.type || 'audio/webm',
          duration_seconds: durationSec,
          blob,
          created_at: new Date().toISOString(),
        });
        setAudioStatusMsg('Rekaman suara tersimpan lokal di perangkat Anda (tidak diunggah ke internet).');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setDuetTurn('recording');
    } catch {
      setAudioStatusMsg('Izin mikrofon ditolak atau tidak tersedia.');
      setDuetTurn('idle');
    }
  };

  const handleStopStudentRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cachedForCurrentSurah = audioCacheMeta.filter(
    (m) => m.qari_id === selectedQariId && m.surah_number === selectedSurah
  ).length;

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('murotal')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition ${
              mode === 'murotal' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Smart Murotal
          </button>
          <button
            type="button"
            onClick={() => setMode('hifdzil')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition ${
              mode === 'hifdzil' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Smart Hifdzil
          </button>
          <button
            type="button"
            onClick={() => setMode('duet')}
            className={`rounded-md px-3.5 py-2 text-xs font-semibold transition ${
              mode === 'duet' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Talking Duet
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {latestProgress?.surah_number && (
            <button
              type="button"
              onClick={handleResumeLastProgress}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Lanjutkan Terakhir (S.{latestProgress.surah_number}:A.{latestProgress.ayah_number ?? 1})
            </button>
          )}
          <p className="text-xs text-slate-500">
            Catatan: Memutar atau mengulang audio dihitung sebagai aktivitas latihan, bukan setoran lulus.
          </p>
        </div>
      </div>

      {/* Controls Grid */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <SurahSelector
          label="Pilih Surat Latihan (Juz 30 & Juz 29)"
          surahs={surahs}
          selectedSurah={selectedSurah}
          onSelectSurah={handleSelectSurah}
          allowSupplementary={true}
          testIdPrefix="murotal-surah-selector"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="murotal-qari" className="block text-xs font-semibold text-slate-700">
              Qari
            </label>
            <select
              id="murotal-qari"
              value={selectedQariId}
              onChange={(e) => setSelectedQariId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {qaris.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="ayah-start" className="block text-xs font-semibold text-slate-700">
                Ayat Awal
              </label>
              <input
                id="ayah-start"
                type="number"
                min={1}
                max={surahMeta?.ayah_count ?? 7}
                value={ayahStart}
                onChange={(e) => {
                  const clamped = clampAyahRangeForSurah(
                    selectedSurah,
                    Number(e.target.value),
                    ayahEnd,
                    surahs
                  );
                  setAyahStart(clamped.ayahStart);
                  setAyahEnd(clamped.ayahEnd);
                  setActiveAyahIdx(0);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="ayah-end" className="block text-xs font-semibold text-slate-700">
                Ayat Akhir
              </label>
              <input
                id="ayah-end"
                type="number"
                min={ayahStart}
                max={surahMeta?.ayah_count ?? 7}
                value={ayahEnd}
                onChange={(e) => {
                  const clamped = clampAyahRangeForSurah(
                    selectedSurah,
                    ayahStart,
                    Number(e.target.value),
                    surahs
                  );
                  setAyahEnd(clamped.ayahEnd);
                  setActiveAyahIdx(0);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="repeat-select" className="block text-xs font-semibold text-slate-700">
                Ulang
              </label>
              <select
                id="repeat-select"
                value={repeatLimit}
                onChange={(e) => setRepeatLimit(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-mono tabular-nums"
              >
                <option value={1}>1x</option>
                <option value={3}>3x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
                <option value={20}>20x</option>
                <option value={0}>∞</option>
              </select>
            </div>
            <div>
              <label htmlFor="pause-select" className="block text-xs font-semibold text-slate-700">
                Jeda (dtk)
              </label>
              <input
                id="pause-select"
                type="number"
                min={0}
                max={60}
                value={pauseSeconds}
                onChange={(e) => setPauseSeconds(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="speed-select" className="block text-xs font-semibold text-slate-700">
                Kecepatan
              </label>
              <select
                id="speed-select"
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-mono tabular-nums"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
              </select>
            </div>
          </div>
        </div>

        {/* Hifdzil Mode Sub-toolbar */}
        {mode === 'hifdzil' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Metode Smart Hifdzil:</span>
              {(
                [
                  ['lihat_dengar', 'Lihat & Dengar'],
                  ['dengar_ulangi', 'Dengar & Ulangi'],
                  ['sembunyikan', 'Sembunyikan Ayat'],
                  ['sambung_ayat', 'Latihan Sambung Ayat'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setHifdzilMethod(key);
                    setHideAyahText(key === 'sembunyikan');
                    if (key === 'dengar_ulangi') setRepeatLimit(3);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    hifdzilMethod === key
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setHideAyahText((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {hideAyahText ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {hideAyahText ? 'Tampilkan Teks Ayat' : 'Sembunyikan Teks Ayat'}
            </button>
          </div>
        )}

        {/* Audio Player Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-800/15 bg-emerald-50/60 p-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void playVerseAtIndex(Math.max(0, activeAyahIdx - 1), 1)}
              aria-label="Ayat sebelumnya"
              className="rounded-lg border border-emerald-800/15 bg-white p-2.5 text-emerald-900 hover:bg-emerald-100"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Jeda audio' : 'Putar audio'}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Jeda' : 'Putar'}
            </button>
            <button
              type="button"
              onClick={stopPlayback}
              aria-label="Hentikan pemutaran"
              className="rounded-lg border border-emerald-800/15 bg-white p-2.5 text-slate-700 hover:bg-slate-100"
            >
              <Square className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void playVerseAtIndex(Math.min(surahVerses.length - 1, activeAyahIdx + 1), 1)}
              aria-label="Ayat berikutnya"
              className="rounded-lg border border-emerald-800/15 bg-white p-2.5 text-emerald-900 hover:bg-emerald-100"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="text-xs text-slate-700 tabular-nums">
            <span className="font-semibold text-emerald-950">
              Ayat {surahVerses[activeAyahIdx]?.ayah_number ?? '-'} / {surahMeta?.ayah_count ?? '-'}
            </span>{' '}
            · Ulangan {currentRepetition}/{repeatLimit === 0 ? '∞' : repeatLimit} · Sinkronisasi: Mode Per-Ayat
          </div>

          {mode === 'duet' && (
            <div className="flex items-center gap-2">
              {duetTurn === 'recording' ? (
                <button
                  type="button"
                  onClick={handleStopStudentRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  <Square className="h-3.5 w-3.5" />
                  Selesai Rekam
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStartStudentRecording()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                >
                  <Mic className="h-3.5 w-3.5 text-amber-700" />
                  Rekam Tiruan (Lokal)
                </button>
              )}
            </div>
          )}
        </div>

        {mode === 'duet' && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
            <strong>Status Talking Duet:</strong>{' '}
            {duetTurn === 'qari'
              ? 'Giliran Qari membaca...'
              : duetTurn === 'student_pause'
                ? `Giliran Siswa menirukan bacaan (${duetCountdown} detik tersisa)...`
                : duetTurn === 'recording'
                  ? 'Merekam suara secara lokal dengan izin Anda...'
                  : 'Tekan Putar untuk memulai duet bergantian, atau tekan Rekam Tiruan untuk berlatih suara lokal.'}{' '}
            Rekaman disimpan 100% lokal dan tidak dinilai otomatis.
          </div>
        )}

        {audioStatusMsg && (
          <p className="mt-3 text-xs font-medium text-amber-800" role="status">
            {audioStatusMsg}
          </p>
        )}
      </section>

      {/* Verses Display */}
      <section aria-label="Daftar Ayat Al-Qur'an" className="space-y-3">
        {surahVerses.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Teks ayat untuk surah ini belum dimuat di cache lokal.
          </div>
        ) : (
          surahVerses.map((v, idx) => {
            const isActive = idx === activeAyahIdx;
            const verseRevealed = Boolean(revealedVerseIds[v.id]);
            const baseHidden =
              hideAyahText || (mode === 'hifdzil' && hifdzilMethod === 'sambung_ayat' && idx > activeAyahIdx);
            const shouldHide = baseHidden && !verseRevealed;
            return (
              <div
                key={v.id}
                ref={isActive ? activeVerseElRef : null}
                className={`rounded-2xl border p-5 transition ${
                  isActive
                    ? 'border-emerald-700 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-900 tabular-nums">
                    {v.surah_name} : Ayat {v.ayah_number}
                  </span>
                  <div className="flex items-center gap-2">
                    {baseHidden && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedVerseIds((prev) => ({ ...prev, [v.id]: !prev[v.id] }))
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        {verseRevealed ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                            Tutup Ayat
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Intip Ayat Ini
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void playVerseAtIndex(idx, 1)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                      Putar Ayat Ini
                    </button>
                  </div>
                </div>

                {shouldHide ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                    Teks ayat disembunyikan untuk latihan hafalan. Ucapkan hafalanmu, lalu klik
                    &ldquo;Intip Ayat Ini&rdquo; atau &ldquo;Tampilkan Teks Ayat&rdquo; untuk memeriksa.
                  </div>
                ) : v.hasCachedText ? (
                  <>
                    <p className="font-arabic mt-3 text-right text-3xl leading-[2.4] text-slate-900">
                      {v.arabic_text}
                    </p>
                    {v.translation_id && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {v.translation_id}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="mt-3 rounded-xl border border-emerald-800/10 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold text-emerald-900">
                      Mode Audio Per-Ayat Aktif — QS. {v.surah_name} ({v.surah_number}) Ayat{' '}
                      {v.ayah_number} dari {surahMeta?.ayah_count ?? '-'}.
                    </span>{' '}
                    Tekan <strong>Putar Ayat Ini</strong> untuk mendengarkan tilawah qari sambil
                    menyimak mushaf Al-Qur&rsquo;an.
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Local Talking Duet Recordings & Offline Audio Cache Management */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Audio Offline Qari &amp; Atribusi</h3>
            <span className="text-xs text-slate-500">{storageEstimateText}</span>
          </div>
          {activeQari && (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>
                <strong>Sumber:</strong> {activeQari.source_name} ({activeQari.style})
              </p>
              <p>
                <strong>Lisensi &amp; Atribusi:</strong> {activeQari.license_type} —{' '}
                {activeQari.attribution_text}
              </p>
              <p>
                <strong>Cache Surah Ini:</strong>{' '}
                <span className="font-mono tabular-nums">
                  {cachedForCurrentSurah}/{surahVerses.length} ayat
                </span>
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={downloadingSurah || !activeQari.offline_allowed}
                  onClick={() => void handleDownloadSurahOffline()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingSurah ? 'Mengunduh...' : 'Simpan Surah Offline'}
                </button>
                {cachedForCurrentSurah > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleClearOfflineSurah()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Cache Surah
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">
            Rekaman Talking Duet Lokal (Privat di Perangkat)
          </h3>
          {localRecordings.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Belum ada rekaman lokal. Rekaman suara anak disimpan privat di IndexedDB dan tidak
              pernah diunggah otomatis.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {localRecordings.map((rec) => (
                <LocalRecordingRow key={rec.id} rec={rec} onDelete={onDeleteLocalRecording} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
