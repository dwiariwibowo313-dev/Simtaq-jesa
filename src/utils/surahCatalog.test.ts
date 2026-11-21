import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_QURAN_SURAHS,
  clampAyahRangeForSurah,
  findSurahByNumber,
  getPrimaryTahfidzSurahs,
  getSurahsByJuz,
  isSurahCatalogCompleteAndAligned,
  JUZ_29_SURAH_COUNT,
  JUZ_30_SURAH_COUNT,
  normalizeSurahCatalog,
  PRIMARY_TAHFIDZ_SURAH_COUNT,
} from '../data/surahCatalog';
import { SEED_SURAHS } from '../data/seedData';
import { MemorizationRecord, SCHOOL_ID, TahfidzTarget } from '../types/simtaq';
import { calculateStudentHafalanSummary, expandUniqueAyahKeys } from './tahfidzMetrics';

const EXPECTED_JUZ_30: Array<[number, string, number]> = [
  [78, "An-Naba'", 40],
  [79, "An-Nazi'at", 46],
  [80, 'Abasa', 42],
  [81, 'At-Takwir', 29],
  [82, 'Al-Infitar', 19],
  [83, 'Al-Mutaffifin', 36],
  [84, 'Al-Insyiqaq', 25],
  [85, 'Al-Buruj', 22],
  [86, 'At-Tariq', 17],
  [87, "Al-A'la", 19],
  [88, 'Al-Ghasyiyah', 26],
  [89, 'Al-Fajr', 30],
  [90, 'Al-Balad', 20],
  [91, 'Asy-Syams', 15],
  [92, 'Al-Lail', 21],
  [93, 'Ad-Duha', 11],
  [94, 'Asy-Syarh', 8],
  [95, 'At-Tin', 8],
  [96, 'Al-Alaq', 19],
  [97, 'Al-Qadr', 5],
  [98, 'Al-Bayyinah', 8],
  [99, 'Az-Zalzalah', 8],
  [100, 'Al-Adiyat', 11],
  [101, "Al-Qari'ah", 11],
  [102, 'At-Takatsur', 8],
  [103, 'Al-Asr', 3],
  [104, 'Al-Humazah', 9],
  [105, 'Al-Fil', 5],
  [106, 'Quraisy', 4],
  [107, "Al-Ma'un", 7],
  [108, 'Al-Kautsar', 3],
  [109, 'Al-Kafirun', 6],
  [110, 'An-Nasr', 3],
  [111, 'Al-Lahab / Al-Masad', 5],
  [112, 'Al-Ikhlas', 4],
  [113, 'Al-Falaq', 5],
  [114, 'An-Nas', 6],
];

const EXPECTED_JUZ_29: Array<[number, string, number]> = [
  [67, 'Al-Mulk', 30],
  [68, 'Al-Qalam', 52],
  [69, 'Al-Haqqah', 52],
  [70, "Al-Ma'arij", 44],
  [71, 'Nuh', 28],
  [72, 'Al-Jinn', 28],
  [73, 'Al-Muzzammil', 20],
  [74, 'Al-Muddassir', 56],
  [75, 'Al-Qiyamah', 40],
  [76, 'Al-Insan', 31],
  [77, 'Al-Mursalat', 50],
];

test('SEED_SURAHS references the exact single source of truth CANONICAL_QURAN_SURAHS', () => {
  assert.equal(SEED_SURAHS, CANONICAL_QURAN_SURAHS);
});

test('Juz 30 contains exactly 37 ordered surahs (78..114) with authentic ayah counts', () => {
  const juz30 = getSurahsByJuz(30);
  assert.equal(juz30.length, JUZ_30_SURAH_COUNT);
  assert.equal(juz30.length, 37);
  assert.deepEqual(
    juz30.map((s) => [s.surah_number, s.name_latin, s.ayah_count]),
    EXPECTED_JUZ_30
  );
  // Al-Fatihah must NOT exist in Juz 30
  assert.equal(juz30.some((s) => s.surah_number === 1), false);
});

test('Juz 29 contains exactly 11 ordered surahs (67..77) with authentic ayah counts', () => {
  const juz29 = getSurahsByJuz(29);
  assert.equal(juz29.length, JUZ_29_SURAH_COUNT);
  assert.equal(juz29.length, 11);
  assert.deepEqual(
    juz29.map((s) => [s.surah_number, s.name_latin, s.ayah_count]),
    EXPECTED_JUZ_29
  );
  // Al-Fatihah must NOT exist in Juz 29
  assert.equal(juz29.some((s) => s.surah_number === 1), false);
});

test('Primary tahfidz catalog totals exactly 48 unique surahs and separates Al-Fatihah into tambahan', () => {
  const primary = getPrimaryTahfidzSurahs();
  assert.equal(primary.length, PRIMARY_TAHFIDZ_SURAH_COUNT);
  assert.equal(primary.length, 48);

  const uniqueNumbers = new Set(primary.map((s) => s.surah_number));
  assert.equal(uniqueNumbers.size, 48);
  assert.equal(uniqueNumbers.has(1), false);

  const tambahan = getSurahsByJuz('tambahan');
  assert.deepEqual(
    tambahan.map((s) => s.surah_number),
    [1]
  );
});

test('normalizeSurahCatalog upgrades incomplete legacy cached surahs to full 48+1 canonical catalog without duplicates', () => {
  const legacyIncomplete = [
    CANONICAL_QURAN_SURAHS.find((s) => s.surah_number === 1)!,
    {
      surah_number: 106,
      name_latin: 'Quraysh',
      name_arabic: 'قريش',
      ayah_count: 4,
      juz_group: 30 as const,
      revelation_type: 'Makkiyah' as const,
      source_reference: 'Old',
    },
    CANONICAL_QURAN_SURAHS.find((s) => s.surah_number === 114)!,
  ];

  assert.equal(isSurahCatalogCompleteAndAligned(legacyIncomplete), false);
  const upgraded = normalizeSurahCatalog(legacyIncomplete);
  assert.equal(isSurahCatalogCompleteAndAligned(upgraded), true);
  assert.equal(getSurahsByJuz(30, upgraded).length, 37);
  assert.equal(getSurahsByJuz(29, upgraded).length, 11);
  assert.equal(findSurahByNumber(106, upgraded)?.name_latin, 'Quraisy');
});

test('first, middle, and last surah selection & ayah range clamping work across Juz 30 and Juz 29', () => {
  // Juz 30: first (78 An-Naba'), middle (96 Al-Alaq), last (114 An-Nas)
  assert.deepEqual(clampAyahRangeForSurah(78, 1, 999), { ayahStart: 1, ayahEnd: 40, maxAyah: 40 });
  assert.deepEqual(clampAyahRangeForSurah(96, 5, 19), { ayahStart: 5, ayahEnd: 19, maxAyah: 19 });
  assert.deepEqual(clampAyahRangeForSurah(114, 1, 6), { ayahStart: 1, ayahEnd: 6, maxAyah: 6 });

  // Juz 29: first (67 Al-Mulk), middle (72 Al-Jinn), last (77 Al-Mursalat)
  assert.deepEqual(clampAyahRangeForSurah(67, 1, 30), { ayahStart: 1, ayahEnd: 30, maxAyah: 30 });
  assert.deepEqual(clampAyahRangeForSurah(72, 1, 28), { ayahStart: 1, ayahEnd: 28, maxAyah: 28 });
  assert.deepEqual(clampAyahRangeForSurah(77, 1, 50), { ayahStart: 1, ayahEnd: 50, maxAyah: 50 });
});

test('tahfidz progress & target summary accurately track Juz 29 and Juz 30 memorization records', () => {
  const records: MemorizationRecord[] = [
    {
      id: 'm-mulk',
      school_id: SCHOOL_ID,
      student_id: 'stu-1',
      teacher_uid: 'tch-1',
      teacher_name: 'Ustadz Ahmad',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      date: '2026-11-20',
      surah_number: 67,
      surah_name: 'Al-Mulk',
      ayah_start: 1,
      ayah_end: 30,
      unique_ayah_keys: expandUniqueAyahKeys(67, 1, 30),
      status: 'lulus',
      audit_trail: [],
      whatsapp_share_status: 'belum_dibagikan',
      updated_at: '2026-11-20T08:00:00Z',
    },
    {
      id: 'm-naba',
      school_id: SCHOOL_ID,
      student_id: 'stu-1',
      teacher_uid: 'tch-1',
      teacher_name: 'Ustadz Ahmad',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      date: '2026-11-21',
      surah_number: 78,
      surah_name: "An-Naba'",
      ayah_start: 1,
      ayah_end: 20,
      unique_ayah_keys: expandUniqueAyahKeys(78, 1, 20),
      status: 'lulus',
      audit_trail: [],
      whatsapp_share_status: 'belum_dibagikan',
      updated_at: '2026-11-21T08:00:00Z',
    },
  ];

  const targets: TahfidzTarget[] = [
    {
      id: 'tgt-juz29',
      school_id: SCHOOL_ID,
      scope: 'student',
      target_ref_id: 'stu-1',
      period_label: 'Target Juz 29 & 30',
      start_date: '2026-11-01',
      end_date: '2026-12-31',
      surah_number: 67,
      ayah_start: 1,
      ayah_end: 30,
      target_ayah_count: 50,
    },
  ];

  const summary = calculateStudentHafalanSummary(
    'stu-1',
    records,
    [],
    targets,
    CANONICAL_QURAN_SURAHS,
    'cls-4a',
    'hal-1'
  );

  assert.equal(summary.total_passed_unique_ayahs, 50);
  assert.equal(summary.total_completed_surahs, 1); // Al-Mulk 30/30 complete; An-Naba' 20/40 partial
  assert.equal(summary.target_percentage, 100);
});
