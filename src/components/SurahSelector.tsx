import React, { useEffect, useId, useMemo, useState } from 'react';
import { QuranSurah, SurahJuzGroup } from '../types/simtaq';
import {
  findSurahByNumber,
  getSurahsByJuz,
  inferSurahJuzGroup,
  PRIMARY_TAHFIDZ_SURAH_COUNT,
} from '../data/surahCatalog';
import { BookOpen, Search } from 'lucide-react';

interface SurahSelectorProps {
  label?: string;
  surahs: QuranSurah[];
  selectedSurah: number;
  onSelectSurah: (surahNumber: number) => void;
  disabled?: boolean;
  allowSupplementary?: boolean;
  compact?: boolean;
  maxListHeightClass?: string;
  testIdPrefix?: string;
}

export const SurahSelector: React.FC<SurahSelectorProps> = ({
  label = 'Pilih Surat Al-Qur’an',
  surahs,
  selectedSurah,
  onSelectSurah,
  disabled = false,
  allowSupplementary = true,
  compact = false,
  maxListHeightClass = 'max-h-72',
  testIdPrefix = 'surah-selector',
}) => {
  const instanceId = useId();
  const radioGroupName = `surah-radio-${instanceId}`;

  const [activeJuz, setActiveJuz] = useState<SurahJuzGroup>(() =>
    inferSurahJuzGroup(selectedSurah)
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Keep active Juz tab synced when selectedSurah changes externally (e.g. Lanjutkan Terakhir or Edit)
  useEffect(() => {
    const inferred = inferSurahJuzGroup(selectedSurah);
    if (inferred === 'tambahan' && !allowSupplementary) {
      setActiveJuz(30);
    } else {
      setActiveJuz(inferred);
    }
  }, [selectedSurah, allowSupplementary]);

  const juz30Surahs = useMemo(() => getSurahsByJuz(30, surahs), [surahs]);
  const juz29Surahs = useMemo(() => getSurahsByJuz(29, surahs), [surahs]);
  const supplementarySurahs = useMemo(
    () => (allowSupplementary ? getSurahsByJuz('tambahan', surahs) : []),
    [allowSupplementary, surahs]
  );

  const selectedSurahMeta = useMemo(
    () => findSurahByNumber(selectedSurah, surahs),
    [selectedSurah, surahs]
  );

  const activeJuzSurahs = useMemo(() => {
    if (activeJuz === 29) return juz29Surahs;
    if (activeJuz === 'tambahan' && allowSupplementary) return supplementarySurahs;
    return juz30Surahs;
  }, [activeJuz, allowSupplementary, juz29Surahs, juz30Surahs, supplementarySurahs]);

  const displayedSurahs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeJuzSurahs;
    return activeJuzSurahs.filter(
      (s) =>
        String(s.surah_number).includes(q) ||
        s.name_latin.toLowerCase().includes(q) ||
        s.name_arabic.includes(q)
    );
  }, [activeJuzSurahs, searchQuery]);

  const activeCategoryDescription =
    activeJuz === 30
      ? `Menampilkan ${juz30Surahs.length} surat Juz 30 (78. An-Naba' s.d. 114. An-Nas)`
      : activeJuz === 29
        ? `Menampilkan ${juz29Surahs.length} surat Juz 29 (67. Al-Mulk s.d. 77. Al-Mursalat)`
        : 'Surat tambahan di luar materi utama Juz 29 & Juz 30';

  return (
    <div
      data-testid={testIdPrefix}
      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-3"
    >
      {/* Header & Active Selection Summary */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-800">{label}</span>
          </div>
          <span className="whitespace-nowrap text-[11px] font-medium text-slate-500 tabular-nums">
            (Total Utama: {juz30Surahs.length + juz29Surahs.length || PRIMARY_TAHFIDZ_SURAH_COUNT} Surat)
          </span>
        </div>

        {selectedSurahMeta && (
          <div
            data-testid={`${testIdPrefix}-selected-summary`}
            className="self-start sm:self-auto rounded-lg border border-emerald-700/25 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-950 tabular-nums"
          >
            Terpilih: {selectedSurahMeta.surah_number}. {selectedSurahMeta.name_latin} (
            {selectedSurahMeta.ayah_count} ayat ·{' '}
            {selectedSurahMeta.juz_group === 'tambahan'
              ? 'Surat Tambahan'
              : `Juz ${selectedSurahMeta.juz_group}`}
            )
          </div>
        )}
      </div>

      {/* Category Switcher: Juz 30 (37 Surat), Juz 29 (11 Surat), optional Tambahan */}
      <div
        role="tablist"
        aria-label="Kategori Juz Surat"
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeJuz === 30}
          disabled={disabled}
          onClick={() => {
            setActiveJuz(30);
            setSearchQuery('');
          }}
          className={`min-h-[44px] whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold transition tabular-nums disabled:opacity-60 ${
            activeJuz === 30
              ? 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-950'
          }`}
        >
          Juz 30 ({juz30Surahs.length} Surat)
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeJuz === 29}
          disabled={disabled}
          onClick={() => {
            setActiveJuz(29);
            setSearchQuery('');
          }}
          className={`min-h-[44px] whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-bold transition tabular-nums disabled:opacity-60 ${
            activeJuz === 29
              ? 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-950'
          }`}
        >
          Juz 29 ({juz29Surahs.length} Surat)
        </button>

        {allowSupplementary && supplementarySurahs.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={activeJuz === 'tambahan'}
            disabled={disabled}
            onClick={() => {
              setActiveJuz('tambahan');
              setSearchQuery('');
            }}
            className={`col-span-2 sm:col-span-1 min-h-[44px] whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
              activeJuz === 'tambahan'
                ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-950'
            }`}
          >
            Surat Tambahan ({supplementarySurahs.length})
          </button>
        )}
      </div>

      {/* Info bar + Optional Search filter inside active Juz */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-medium text-slate-600 tabular-nums">
          {activeCategoryDescription}
        </p>

        {!disabled && activeJuzSurahs.length > 5 && (
          <div className="relative w-full sm:w-56">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Cari surat pada juz terpilih"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor atau nama surat..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Radio List of Ordered Surahs */}
      <fieldset disabled={disabled} className="min-w-0">
        <legend className="sr-only">
          Daftar Surat {activeJuz === 'tambahan' ? 'Tambahan' : `Juz ${activeJuz}`}
        </legend>

        {displayedSurahs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
            Surat &ldquo;{searchQuery}&rdquo; tidak ditemukan pada kategori{' '}
            {activeJuz === 'tambahan' ? 'Surat Tambahan' : `Juz ${activeJuz}`}.
          </div>
        ) : (
          <div
            data-testid={`${testIdPrefix}-list`}
            className={`grid gap-2 overflow-y-auto pr-1 ${maxListHeightClass} ${
              compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {displayedSurahs.map((s) => {
              const isSelected = selectedSurah === s.surah_number;
              const radioId = `${instanceId}-surah-${s.surah_number}`;
              return (
                <label
                  key={s.surah_number}
                  htmlFor={radioId}
                  className={`flex min-h-[48px] cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${
                    isSelected
                      ? 'border-emerald-700 bg-emerald-50/90 ring-1 ring-emerald-700/30'
                      : 'border-slate-200 bg-white hover:border-emerald-600/50 hover:bg-emerald-50/30'
                  } ${disabled ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <input
                      id={radioId}
                      type="radio"
                      name={radioGroupName}
                      value={s.surah_number}
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => onSelectSurah(s.surah_number)}
                      className="h-4 w-4 shrink-0 accent-emerald-700"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">
                        <span className="font-mono text-emerald-800 tabular-nums">
                          {s.surah_number}.
                        </span>{' '}
                        {s.name_latin}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {s.ayah_count} ayat · {s.revelation_type}
                      </p>
                    </div>
                  </div>
                  <span
                    className="font-arabic shrink-0 text-base text-slate-700"
                    lang="ar"
                    dir="rtl"
                  >
                    {s.name_arabic}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
};
