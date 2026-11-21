import { QuranSurah, SurahJuzGroup } from '../types/simtaq';

/**
 * Single Source of Truth untuk seluruh daftar surat Al-Qur'an di SIMTAQ.
 * - Materi Tahfidz Utama: Juz 29 (11 surat: 67–77) + Juz 30 (37 surat: 78–114) = 48 surat.
 * - Al-Fatihah (1) dipisahkan pada kategori 'tambahan' dan tidak masuk Juz 29 maupun Juz 30.
 */
export const CANONICAL_QURAN_SURAHS: QuranSurah[] = [
  // Kategori Surat Tambahan (di luar materi utama Juz 29 & Juz 30)
  {
    surah_number: 1,
    name_latin: 'Al-Fatihah',
    name_arabic: 'الفاتحة',
    ayah_count: 7,
    juz_group: 'tambahan',
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },

  // Juz 29 (11 Surat: 67 Al-Mulk s/d 77 Al-Mursalat)
  {
    surah_number: 67,
    name_latin: 'Al-Mulk',
    name_arabic: 'الملك',
    ayah_count: 30,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 68,
    name_latin: 'Al-Qalam',
    name_arabic: 'القلم',
    ayah_count: 52,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 69,
    name_latin: 'Al-Haqqah',
    name_arabic: 'الحاقة',
    ayah_count: 52,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 70,
    name_latin: "Al-Ma'arij",
    name_arabic: 'المعارج',
    ayah_count: 44,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 71,
    name_latin: 'Nuh',
    name_arabic: 'نوح',
    ayah_count: 28,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 72,
    name_latin: 'Al-Jinn',
    name_arabic: 'الجن',
    ayah_count: 28,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 73,
    name_latin: 'Al-Muzzammil',
    name_arabic: 'المزمل',
    ayah_count: 20,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 74,
    name_latin: 'Al-Muddassir',
    name_arabic: 'المدثر',
    ayah_count: 56,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 75,
    name_latin: 'Al-Qiyamah',
    name_arabic: 'القيامة',
    ayah_count: 40,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 76,
    name_latin: 'Al-Insan',
    name_arabic: 'الإنسان',
    ayah_count: 31,
    juz_group: 29,
    revelation_type: 'Madaniyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 77,
    name_latin: 'Al-Mursalat',
    name_arabic: 'المرسلات',
    ayah_count: 50,
    juz_group: 29,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },

  // Juz 30 (37 Surat: 78 An-Naba' s/d 114 An-Nas)
  {
    surah_number: 78,
    name_latin: "An-Naba'",
    name_arabic: 'النبأ',
    ayah_count: 40,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 79,
    name_latin: "An-Nazi'at",
    name_arabic: 'النازعات',
    ayah_count: 46,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 80,
    name_latin: 'Abasa',
    name_arabic: 'عبس',
    ayah_count: 42,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 81,
    name_latin: 'At-Takwir',
    name_arabic: 'التكوير',
    ayah_count: 29,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 82,
    name_latin: 'Al-Infitar',
    name_arabic: 'الانفطار',
    ayah_count: 19,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 83,
    name_latin: 'Al-Mutaffifin',
    name_arabic: 'المطففين',
    ayah_count: 36,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 84,
    name_latin: 'Al-Insyiqaq',
    name_arabic: 'الانشقاق',
    ayah_count: 25,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 85,
    name_latin: 'Al-Buruj',
    name_arabic: 'البروج',
    ayah_count: 22,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 86,
    name_latin: 'At-Tariq',
    name_arabic: 'الطارق',
    ayah_count: 17,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 87,
    name_latin: "Al-A'la",
    name_arabic: 'الأعلى',
    ayah_count: 19,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 88,
    name_latin: 'Al-Ghasyiyah',
    name_arabic: 'الغاشية',
    ayah_count: 26,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 89,
    name_latin: 'Al-Fajr',
    name_arabic: 'الفجر',
    ayah_count: 30,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 90,
    name_latin: 'Al-Balad',
    name_arabic: 'البلد',
    ayah_count: 20,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 91,
    name_latin: 'Asy-Syams',
    name_arabic: 'الشمس',
    ayah_count: 15,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 92,
    name_latin: 'Al-Lail',
    name_arabic: 'الليل',
    ayah_count: 21,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 93,
    name_latin: 'Ad-Duha',
    name_arabic: 'الضحى',
    ayah_count: 11,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 94,
    name_latin: 'Asy-Syarh',
    name_arabic: 'الشرح',
    ayah_count: 8,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 95,
    name_latin: 'At-Tin',
    name_arabic: 'التين',
    ayah_count: 8,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 96,
    name_latin: 'Al-Alaq',
    name_arabic: 'العلق',
    ayah_count: 19,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 97,
    name_latin: 'Al-Qadr',
    name_arabic: 'القدر',
    ayah_count: 5,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 98,
    name_latin: 'Al-Bayyinah',
    name_arabic: 'البينة',
    ayah_count: 8,
    juz_group: 30,
    revelation_type: 'Madaniyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 99,
    name_latin: 'Az-Zalzalah',
    name_arabic: 'الزلزلة',
    ayah_count: 8,
    juz_group: 30,
    revelation_type: 'Madaniyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 100,
    name_latin: 'Al-Adiyat',
    name_arabic: 'العاديات',
    ayah_count: 11,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 101,
    name_latin: "Al-Qari'ah",
    name_arabic: 'القارعة',
    ayah_count: 11,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 102,
    name_latin: 'At-Takatsur',
    name_arabic: 'التكاثر',
    ayah_count: 8,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 103,
    name_latin: 'Al-Asr',
    name_arabic: 'العصر',
    ayah_count: 3,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 104,
    name_latin: 'Al-Humazah',
    name_arabic: 'الهمزة',
    ayah_count: 9,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 105,
    name_latin: 'Al-Fil',
    name_arabic: 'الفيل',
    ayah_count: 5,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 106,
    name_latin: 'Quraisy',
    name_arabic: 'قريش',
    ayah_count: 4,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 107,
    name_latin: "Al-Ma'un",
    name_arabic: 'الماعون',
    ayah_count: 7,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 108,
    name_latin: 'Al-Kautsar',
    name_arabic: 'الكوثر',
    ayah_count: 3,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 109,
    name_latin: 'Al-Kafirun',
    name_arabic: 'الكافرون',
    ayah_count: 6,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 110,
    name_latin: 'An-Nasr',
    name_arabic: 'النصر',
    ayah_count: 3,
    juz_group: 30,
    revelation_type: 'Madaniyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 111,
    name_latin: 'Al-Lahab / Al-Masad',
    name_arabic: 'المسد',
    ayah_count: 5,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 112,
    name_latin: 'Al-Ikhlas',
    name_arabic: 'الإخلاص',
    ayah_count: 4,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 113,
    name_latin: 'Al-Falaq',
    name_arabic: 'الفلق',
    ayah_count: 5,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
  {
    surah_number: 114,
    name_latin: 'An-Nas',
    name_arabic: 'الناس',
    ayah_count: 6,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil Metadata',
  },
];

export const JUZ_30_SURAH_COUNT = 37;
export const JUZ_29_SURAH_COUNT = 11;
export const PRIMARY_TAHFIDZ_SURAH_COUNT = JUZ_30_SURAH_COUNT + JUZ_29_SURAH_COUNT; // 48

export function inferSurahJuzGroup(surahNumber: number): SurahJuzGroup {
  if (surahNumber >= 78 && surahNumber <= 114) return 30;
  if (surahNumber >= 67 && surahNumber <= 77) return 29;
  return 'tambahan';
}

/**
 * Menjamin katalog surat selalu unik per surah_number, lengkap (48 surat utama + Al-Fatihah tambahan),
 * dan terurut menaik sesuai nomor surat.
 */
export function normalizeSurahCatalog(existingSurahs: QuranSurah[] = []): QuranSurah[] {
  const byNumber = new Map<number, QuranSurah>();

  for (const existing of existingSurahs) {
    if (
      existing &&
      Number.isInteger(existing.surah_number) &&
      existing.surah_number >= 1 &&
      existing.surah_number <= 114
    ) {
      byNumber.set(existing.surah_number, {
        ...existing,
        juz_group: inferSurahJuzGroup(existing.surah_number),
      });
    }
  }

  // Canonical catalog selalu menimpa agar jumlah ayat, nama surat, dan klasifikasi juz akurat
  for (const canonical of CANONICAL_QURAN_SURAHS) {
    byNumber.set(canonical.surah_number, canonical);
  }

  return Array.from(byNumber.values()).sort((a, b) => a.surah_number - b.surah_number);
}

export function getSurahsByJuz(
  juz: SurahJuzGroup,
  surahs: QuranSurah[] = CANONICAL_QURAN_SURAHS
): QuranSurah[] {
  return normalizeSurahCatalog(surahs).filter((s) => s.juz_group === juz);
}

export function getPrimaryTahfidzSurahs(
  surahs: QuranSurah[] = CANONICAL_QURAN_SURAHS
): QuranSurah[] {
  return normalizeSurahCatalog(surahs).filter(
    (s) => s.juz_group === 29 || s.juz_group === 30
  );
}

export function findSurahByNumber(
  surahNumber: number,
  surahs: QuranSurah[] = CANONICAL_QURAN_SURAHS
): QuranSurah | undefined {
  return normalizeSurahCatalog(surahs).find((s) => s.surah_number === surahNumber);
}

export function clampAyahRangeForSurah(
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number,
  surahs: QuranSurah[] = CANONICAL_QURAN_SURAHS
): { ayahStart: number; ayahEnd: number; maxAyah: number } {
  const surah = findSurahByNumber(surahNumber, surahs);
  const maxAyah = surah?.ayah_count ?? 7;
  const start = Math.max(1, Math.min(Math.trunc(ayahStart) || 1, maxAyah));
  const end = Math.max(start, Math.min(Math.trunc(ayahEnd) || maxAyah, maxAyah));
  return { ayahStart: start, ayahEnd: end, maxAyah };
}

export function isSurahCatalogCompleteAndAligned(surahs: QuranSurah[]): boolean {
  const canonicalByNum = new Map(CANONICAL_QURAN_SURAHS.map((s) => [s.surah_number, s]));
  if (surahs.length !== canonicalByNum.size) return false;
  for (const item of surahs) {
    const canon = canonicalByNum.get(item.surah_number);
    if (!canon) return false;
    if (
      item.name_latin !== canon.name_latin ||
      item.name_arabic !== canon.name_arabic ||
      item.ayah_count !== canon.ayah_count ||
      item.juz_group !== canon.juz_group
    ) {
      return false;
    }
  }
  return true;
}
