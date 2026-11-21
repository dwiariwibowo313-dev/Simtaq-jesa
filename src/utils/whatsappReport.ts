import { AssessmentStatus, MemorizationRecord, MurajaahRecord } from '../types/simtaq';

export interface PhoneNormalizationResult {
  valid: boolean;
  e164: string;
  waDigits: string;
  error?: string;
}

export function normalizeIndonesianWhatsApp(rawInput: string): PhoneNormalizationResult {
  const cleaned = rawInput.replace(/[\s\-().]/g, '').trim();
  if (!cleaned) {
    return { valid: false, e164: '', waDigits: '', error: 'Nomor WhatsApp wajib diisi.' };
  }

  if (!/^\+?\d+$/.test(cleaned)) {
    return {
      valid: false,
      e164: '',
      waDigits: '',
      error: 'Nomor WhatsApp hanya boleh berisi angka dan awalan +.',
    };
  }

  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  if (digits.startsWith('08')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  } else if (!digits.startsWith('628')) {
    return {
      valid: false,
      e164: '',
      waDigits: '',
      error: 'Gunakan nomor seluler Indonesia yang valid (mis. 0812xxxxxxxx atau +62812xxxxxxxx).',
    };
  }

  // Indonesian mobile numbers after 628 typically have 10 to 15 total digits (62 + 8xxxxxxxx)
  if (digits.length < 11 || digits.length > 15) {
    return {
      valid: false,
      e164: '',
      waDigits: '',
      error: 'Panjang digit nomor WhatsApp tidak valid (minimal 10 digit lokal).',
    };
  }

  return {
    valid: true,
    e164: `+${digits}`,
    waDigits: digits,
  };
}

function formatStatusLabel(status: AssessmentStatus): string {
  switch (status) {
    case 'lulus':
      return 'Lulus';
    case 'perlu_perbaikan':
      return 'Perlu Perbaikan';
    case 'menunggu_penilaian':
    default:
      return 'Menunggu Penilaian';
  }
}

export interface BuildReportInput {
  studentName: string;
  classOrHalaqah: string;
  teacherName: string;
  activityType: 'Hafalan Baru' | 'Murajaah';
  record: Pick<
    MemorizationRecord | MurajaahRecord,
    | 'date'
    | 'surah_name'
    | 'ayah_start'
    | 'ayah_end'
    | 'kelancaran'
    | 'ketepatan_bacaan'
    | 'tajwid'
    | 'makhraj'
    | 'status'
    | 'teacher_note'
  >;
}

export function buildWhatsAppReportText(input: BuildReportInput): string {
  const { studentName, classOrHalaqah, teacherName, activityType, record } = input;

  const lines: string[] = [
    'Assalamu’alaikum warahmatullahi wabarakatuh.',
    '',
    `Yth. Bapak/Ibu Orang Tua/Wali dari ${studentName},`,
    '',
    'Berikut laporan perkembangan setoran hafalan Al-Qur’an:',
    '',
    'SDN JETISKARANGPUNG 1',
    'LAPORAN SETORAN HAFALAN',
    '',
    `Nama Siswa: ${studentName}`,
    `Kelas/Halaqah: ${classOrHalaqah}`,
    `Tanggal: ${record.date}`,
    '',
    'Detail Setoran',
    `Surah: ${record.surah_name}`,
    `Ayat: ${record.ayah_start}–${record.ayah_end}`,
    `Jenis: ${activityType}`,
    '',
    'Hasil Penilaian',
    `Kelancaran: ${record.kelancaran ?? 'Belum dinilai'}`,
    `Ketepatan Bacaan: ${record.ketepatan_bacaan ?? 'Belum dinilai'}`,
    `Tajwid: ${record.tajwid ?? 'Belum dinilai'}`,
    `Makhraj: ${record.makhraj ?? 'Belum dinilai'}`,
    `Status: ${formatStatusLabel(record.status)}`,
  ];

  const trimmedNote = record.teacher_note?.trim();
  if (trimmedNote) {
    lines.push('', `Catatan Guru: ${trimmedNote}`);
  }

  lines.push(
    '',
    'Terima kasih atas pendampingan Bapak/Ibu di rumah. Semoga ananda semakin semangat belajar, menjaga hafalan, dan mencintai Al-Qur’an.',
    '',
    'Wassalamu’alaikum warahmatullahi wabarakatuh.',
    '',
    teacherName,
    'SDN Jetiskarangpung 1'
  );

  return lines.join('\n');
}

export function buildWhatsAppClickToChatUrl(e164OrRaw: string, messageText: string): string | null {
  const norm = normalizeIndonesianWhatsApp(e164OrRaw);
  if (!norm.valid) return null;
  return `https://wa.me/${norm.waDigits}?text=${encodeURIComponent(messageText)}`;
}
