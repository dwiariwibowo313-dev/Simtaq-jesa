import Dexie, { Table } from 'dexie';
import {
  Announcement,
  AnnouncementRead,
  AudioCacheMetadata,
  AuditLogEntry,
  ClassRoom,
  Guardian,
  Halaqah,
  LearningProgress,
  LocalAudioRecording,
  MapsiQuestion,
  MemorizationRecord,
  MurajaahRecord,
  PendingSyncItem,
  QariCatalogItem,
  QuestionPackage,
  QuizResult,
  QuranSurah,
  QuranVerse,
  SCHOOL_ID,
  SchoolSettings,
  Student,
  SyncHistoryItem,
  TahfidzTarget,
  TajwidExample,
  TajwidQuestion,
  TajwidTopic,
  TeacherAssignment,
  UserAccount,
} from '../types/simtaq';
import {
  SEED_ANNOUNCEMENTS,
  SEED_AUDIT_LOGS,
  SEED_CLASSES,
  SEED_GUARDIANS,
  SEED_HALAQAHS,
  SEED_MAPSI_QUESTIONS,
  SEED_MEMORIZATION_RECORDS,
  SEED_MURAJAAH_RECORDS,
  SEED_QARIS,
  SEED_QUESTION_PACKAGES,
  SEED_QUIZ_RESULTS,
  SEED_SCHOOL_SETTINGS,
  SEED_STUDENTS,
  SEED_SURAHS,
  SEED_TAJWID_EXAMPLES,
  SEED_TAJWID_QUESTIONS,
  SEED_TAJWID_TOPICS,
  SEED_TARGETS,
  SEED_TEACHER_ASSIGNMENTS,
  SEED_USERS,
  SEED_VERSES,
} from '../data/seedData';
import { isSurahCatalogCompleteAndAligned } from '../data/surahCatalog';
import { SimtaqBackupPayload, validateBackupPayload } from '../utils/backupValidator';

export class SimtaqDatabase extends Dexie {
  school_settings!: Table<SchoolSettings, string>;
  cached_users!: Table<UserAccount, string>;
  cached_classes!: Table<ClassRoom, string>;
  cached_halaqahs!: Table<Halaqah, string>;
  cached_students!: Table<Student, string>;
  cached_guardians!: Table<Guardian, string>;
  cached_teacher_assignments!: Table<TeacherAssignment, string>;
  cached_targets!: Table<TahfidzTarget, string>;
  cached_memorization_records!: Table<MemorizationRecord, string>;
  cached_murajaah_records!: Table<MurajaahRecord, string>;
  cached_quran_surahs!: Table<QuranSurah, number>;
  cached_quran_verses!: Table<QuranVerse, string>;
  cached_qari_catalog!: Table<QariCatalogItem, string>;
  cached_audio_metadata!: Table<AudioCacheMetadata, string>;
  cached_tajwid_topics!: Table<TajwidTopic, string>;
  cached_tajwid_examples!: Table<TajwidExample, string>;
  cached_tajwid_questions!: Table<TajwidQuestion, string>;
  cached_mapsi_questions!: Table<MapsiQuestion, string>;
  cached_question_packages!: Table<QuestionPackage, string>;
  local_quiz_results!: Table<QuizResult, string>;
  local_learning_progress!: Table<LearningProgress, string>;
  local_audio_recordings!: Table<LocalAudioRecording, string>;
  cached_announcements!: Table<Announcement, string>;
  announcement_reads!: Table<AnnouncementRead, string>;
  pending_sync!: Table<PendingSyncItem, string>;
  sync_history!: Table<SyncHistoryItem, string>;
  local_audit_logs!: Table<AuditLogEntry, string>;

  constructor() {
    super('simtaq_sdn_jetiskarangpung1_db');
    this.version(1).stores({
      school_settings: 'id',
      cached_users: 'uid, role, email',
      cached_classes: 'id, grade_level',
      cached_halaqahs: 'id, teacher_id',
      cached_students: 'id, class_id, halaqah_id, status',
      cached_guardians: 'id, whatsapp_e164',
      cached_teacher_assignments: 'id, teacher_uid',
      cached_targets: 'id, scope, target_ref_id',
      cached_memorization_records: 'id, student_id, teacher_uid, date, surah_number, status',
      cached_murajaah_records: 'id, student_id, teacher_uid, date, surah_number',
      cached_quran_surahs: 'surah_number',
      cached_quran_verses: 'id, surah_number, ayah_number',
      cached_qari_catalog: 'id',
      cached_audio_metadata: 'key, qari_id, surah_number',
      cached_tajwid_topics: 'id, category_code, difficulty, order_index',
      cached_tajwid_examples: 'id, topic_id, surah_number',
      cached_tajwid_questions: 'id, topic_id, mode, difficulty',
      cached_mapsi_questions: 'id, question_type, difficulty, surah_number',
      cached_question_packages: 'id, module, status',
      local_quiz_results: 'id, student_id, module, completed_at',
      local_learning_progress: 'id, student_id, activity_type, updated_at',
      local_audio_recordings: 'id, student_id, surah_number, created_at',
      cached_announcements: 'id, target_audience, priority, is_published, is_archived',
      announcement_reads: 'id, announcement_id, user_uid',
      pending_sync: 'id, collection, status, created_at',
      sync_history: 'id, at',
      local_audit_logs: 'id, actor_uid, timestamp',
    });
  }
}

export const db = new SimtaqDatabase();

let seedPromise: Promise<void> | null = null;

export async function syncCanonicalSurahCatalogInDexie(): Promise<void> {
  const existingSurahs = await db.cached_quran_surahs.toArray();
  if (isSurahCatalogCompleteAndAligned(existingSurahs)) {
    return;
  }
  const canonicalNumbers = new Set(SEED_SURAHS.map((s) => s.surah_number));
  const obsoleteKeys = existingSurahs
    .map((s) => s.surah_number)
    .filter((num) => !canonicalNumbers.has(num));

  await db.transaction('rw', db.cached_quran_surahs, async () => {
    if (obsoleteKeys.length > 0) {
      await db.cached_quran_surahs.bulkDelete(obsoleteKeys);
    }
    await db.cached_quran_surahs.bulkPut(SEED_SURAHS);
  });
}

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const existingSettings = await db.school_settings.get(SCHOOL_ID);
    if (existingSettings) {
      await syncCanonicalSurahCatalogInDexie();
      return;
    }

    await db.transaction(
      'rw',
      [
        db.school_settings,
        db.cached_users,
        db.cached_classes,
        db.cached_halaqahs,
        db.cached_students,
        db.cached_guardians,
        db.cached_teacher_assignments,
        db.cached_targets,
        db.cached_memorization_records,
        db.cached_murajaah_records,
        db.cached_quran_surahs,
        db.cached_quran_verses,
        db.cached_qari_catalog,
        db.cached_tajwid_topics,
        db.cached_tajwid_examples,
        db.cached_tajwid_questions,
        db.cached_mapsi_questions,
        db.cached_question_packages,
        db.local_quiz_results,
        db.cached_announcements,
        db.local_audit_logs,
      ],
      async () => {
        await db.school_settings.put(SEED_SCHOOL_SETTINGS);
        await db.cached_users.bulkPut(SEED_USERS);
        await db.cached_classes.bulkPut(SEED_CLASSES);
        await db.cached_halaqahs.bulkPut(SEED_HALAQAHS);
        await db.cached_students.bulkPut(SEED_STUDENTS);
        await db.cached_guardians.bulkPut(SEED_GUARDIANS);
        await db.cached_teacher_assignments.bulkPut(SEED_TEACHER_ASSIGNMENTS);
        await db.cached_targets.bulkPut(SEED_TARGETS);
        await db.cached_memorization_records.bulkPut(SEED_MEMORIZATION_RECORDS);
        await db.cached_murajaah_records.bulkPut(SEED_MURAJAAH_RECORDS);
        await db.cached_quran_surahs.bulkPut(SEED_SURAHS);
        await db.cached_quran_verses.bulkPut(SEED_VERSES);
        await db.cached_qari_catalog.bulkPut(SEED_QARIS);
        await db.cached_tajwid_topics.bulkPut(SEED_TAJWID_TOPICS);
        await db.cached_tajwid_examples.bulkPut(SEED_TAJWID_EXAMPLES);
        await db.cached_tajwid_questions.bulkPut(SEED_TAJWID_QUESTIONS);
        await db.cached_mapsi_questions.bulkPut(SEED_MAPSI_QUESTIONS);
        await db.cached_question_packages.bulkPut(SEED_QUESTION_PACKAGES);
        await db.local_quiz_results.bulkPut(SEED_QUIZ_RESULTS);
        await db.cached_announcements.bulkPut(SEED_ANNOUNCEMENTS);
        await db.local_audit_logs.bulkPut(SEED_AUDIT_LOGS);
      }
    );
  })();
  return seedPromise;
}

export async function enqueueSyncMutation(
  collection: string,
  docId: string,
  operation: 'upsert' | 'delete',
  payload: unknown
): Promise<void> {
  const id = `${collection}:${docId}:${Date.now()}`;
  await db.pending_sync.put({
    id,
    collection,
    doc_id: docId,
    operation,
    payload,
    status: 'pending',
    retry_count: 0,
    created_at: new Date().toISOString(),
  });
}

export async function appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  await db.local_audit_logs.put({
    ...entry,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  });
}

export async function exportLocalBackup(): Promise<SimtaqBackupPayload> {
  const [
    classes,
    halaqahs,
    students,
    guardians,
    teacher_assignments,
    tahfidz_targets,
    memorization_records,
    murajaah_records,
    announcements,
    quiz_results,
    learning_progress,
  ] = await Promise.all([
    db.cached_classes.toArray(),
    db.cached_halaqahs.toArray(),
    db.cached_students.toArray(),
    db.cached_guardians.toArray(),
    db.cached_teacher_assignments.toArray(),
    db.cached_targets.toArray(),
    db.cached_memorization_records.toArray(),
    db.cached_murajaah_records.toArray(),
    db.cached_announcements.toArray(),
    db.local_quiz_results.toArray(),
    db.local_learning_progress.toArray(),
  ]);

  return {
    schema_version: 'simtaq-v1',
    school_id: SCHOOL_ID,
    exported_at: new Date().toISOString(),
    data: {
      classes,
      halaqahs,
      students,
      guardians,
      teacher_assignments,
      tahfidz_targets,
      memorization_records,
      murajaah_records,
      announcements,
      quiz_results,
      learning_progress,
    },
  };
}

export async function restoreLocalBackup(rawJson: unknown): Promise<{ ok: boolean; message: string }> {
  const check = validateBackupPayload(rawJson);
  if (!check.valid) {
    return { ok: false, message: check.error ?? 'Backup tidak valid.' };
  }
  const payload = rawJson as SimtaqBackupPayload;

  await db.transaction(
    'rw',
    [
      db.cached_classes,
      db.cached_halaqahs,
      db.cached_students,
      db.cached_guardians,
      db.cached_teacher_assignments,
      db.cached_targets,
      db.cached_memorization_records,
      db.cached_murajaah_records,
      db.cached_announcements,
      db.local_quiz_results,
      db.local_learning_progress,
    ],
    async () => {
      await db.cached_classes.clear();
      await db.cached_halaqahs.clear();
      await db.cached_students.clear();
      await db.cached_guardians.clear();
      await db.cached_teacher_assignments.clear();
      await db.cached_targets.clear();
      await db.cached_memorization_records.clear();
      await db.cached_murajaah_records.clear();
      await db.cached_announcements.clear();

      await db.cached_classes.bulkPut(payload.data.classes as ClassRoom[]);
      await db.cached_halaqahs.bulkPut(payload.data.halaqahs as Halaqah[]);
      await db.cached_students.bulkPut(payload.data.students as Student[]);
      await db.cached_guardians.bulkPut(payload.data.guardians as Guardian[]);
      if (Array.isArray(payload.data.teacher_assignments)) {
        await db.cached_teacher_assignments.bulkPut(payload.data.teacher_assignments as TeacherAssignment[]);
      }
      if (Array.isArray(payload.data.tahfidz_targets)) {
        await db.cached_targets.bulkPut(payload.data.tahfidz_targets as TahfidzTarget[]);
      }
      await db.cached_memorization_records.bulkPut(payload.data.memorization_records as MemorizationRecord[]);
      await db.cached_murajaah_records.bulkPut(payload.data.murajaah_records as MurajaahRecord[]);
      await db.cached_announcements.bulkPut(payload.data.announcements as Announcement[]);
      if (Array.isArray(payload.data.quiz_results)) {
        await db.local_quiz_results.bulkPut(payload.data.quiz_results as QuizResult[]);
      }
      if (Array.isArray(payload.data.learning_progress)) {
        await db.local_learning_progress.bulkPut(payload.data.learning_progress as LearningProgress[]);
      }
    }
  );

  return {
    ok: true,
    message: `Restore berhasil (${check.summary?.students ?? 0} siswa, ${check.summary?.memorization_records ?? 0} setoran).`,
  };
}
