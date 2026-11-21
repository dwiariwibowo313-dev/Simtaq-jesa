import { SCHOOL_ID } from '../types/simtaq';

export interface SimtaqBackupPayload {
  schema_version: string;
  school_id: string;
  exported_at: string;
  data: {
    classes: unknown[];
    halaqahs: unknown[];
    students: unknown[];
    guardians: unknown[];
    teacher_assignments: unknown[];
    tahfidz_targets: unknown[];
    memorization_records: unknown[];
    murajaah_records: unknown[];
    announcements: unknown[];
    quiz_results: unknown[];
    learning_progress: unknown[];
  };
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  summary?: {
    students: number;
    memorization_records: number;
    murajaah_records: number;
    announcements: number;
  };
}

export function validateBackupPayload(raw: unknown): BackupValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Format file backup bukan objek JSON yang valid.' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schema_version !== 'simtaq-v1') {
    return { valid: false, error: 'Versi skema backup tidak dikenali (harus simtaq-v1).' };
  }
  if (obj.school_id !== SCHOOL_ID) {
    return {
      valid: false,
      error: `Backup ditolak: school_id bukan milik ${SCHOOL_ID}.`,
    };
  }
  if (!obj.data || typeof obj.data !== 'object') {
    return { valid: false, error: 'Bagian data pada file backup tidak ditemukan.' };
  }

  const data = obj.data as Record<string, unknown>;
  const requiredArrays = [
    'classes',
    'halaqahs',
    'students',
    'guardians',
    'memorization_records',
    'murajaah_records',
    'announcements',
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      return { valid: false, error: `Struktur array '${key}' rusak atau hilang.` };
    }
  }

  return {
    valid: true,
    summary: {
      students: (data.students as unknown[]).length,
      memorization_records: (data.memorization_records as unknown[]).length,
      murajaah_records: (data.murajaah_records as unknown[]).length,
      announcements: (data.announcements as unknown[]).length,
    },
  };
}
