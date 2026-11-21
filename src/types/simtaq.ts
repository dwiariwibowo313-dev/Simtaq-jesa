export const SCHOOL_ID = 'sdn-jetiskarangpung-1' as const;
export const SCHOOL_NAME = 'SDN JETISKARANGPUNG 1';
export const SCHOOL_SLOGAN = 'Sekolah Negeri Berkarakter Islami, Sekolah Para Juara';
export const APP_VERSION = '1.2.0-phase3';
export const SUPER_ADMIN_EMAIL = 'dwiariwibowo313@gmail.com';

export const CREATOR_INFO = {
  name: 'Dwi Apriyono Ariwibowo, S.Pd.',
  role: 'Guru SDN Jetiskarangpung 1, Kalijambe, Sragen',
  description:
    'SIMTAQ dikembangkan sebagai ikhtiar menghadirkan pengelolaan tahfidz dan pembelajaran Al-Qur’an yang lebih terarah, interaktif, dan mudah diakses. Aplikasi ini diharapkan membantu guru mendampingi siswa dalam belajar, menghafal, murajaah, dan memahami kaidah bacaan Al-Qur’an.',
} as const;

export const DONATION_ACCOUNT = {
  bankName: 'Bank Jateng',
  accountNumber: '3010033050',
  accountHolder: 'DWI APRIYONO ARIWIBOWO',
  voluntaryStatement:
    'SIMTAQ dikembangkan untuk mendukung pembelajaran Al-Qur’an dan pengelolaan tahfidz di sekolah. Dukungan donasi bersifat sukarela dan akan membantu pengembangan, pemeliharaan, serta penyempurnaan aplikasi.',
  transferNotice:
    'Pastikan nama penerima dan nomor rekening sesuai sebelum menyelesaikan transfer.',
  manualNotice:
    'Donasi dilakukan secara manual melalui transfer bank. Donasi bersifat sukarela dan tidak memberikan hak akses khusus atau perlakuan berbeda terhadap siswa.',
} as const;

export type UserRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'guardian';

export type VerificationStatus = 'pending_review' | 'verified';

export type AssessmentStatus = 'menunggu_penilaian' | 'perlu_perbaikan' | 'lulus';

export type QualityGrade = 'Mumtaz (Sangat Baik)' | 'Jayyid Jiddan (Baik Sekali)' | 'Jayyid (Baik)' | 'Perlu Bimbingan';

export type WhatsAppShareStatus = 'belum_dibagikan' | 'whatsapp_dibuka' | 'dikonfirmasi_terkirim';

export interface SchoolSettings {
  id: string;
  school_id: typeof SCHOOL_ID;
  school_name: string;
  slogan: string;
  logo_data_url?: string;
  app_version: string;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  updated_by: string;
  updated_at: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  display_name: string;
  role: UserRole;
  school_id: typeof SCHOOL_ID;
  is_active: boolean;
  linked_entity_id?: string;
  email_verified?: boolean;
  created_at: string;
}

export interface ClassRoom {
  id: string;
  school_id: typeof SCHOOL_ID;
  name: string;
  grade_level: number;
  academic_year: string;
  homeroom_teacher_id?: string;
}

export interface Halaqah {
  id: string;
  school_id: typeof SCHOOL_ID;
  name: string;
  teacher_id: string;
  class_ids: string[];
  schedule_note: string;
}

export interface GuardianContactHistoryItem {
  previous_e164: string;
  new_e164: string;
  changed_by: string;
  changed_at: string;
  reason: string;
}

export interface Guardian {
  id: string;
  school_id: typeof SCHOOL_ID;
  full_name: string;
  relationship: 'Ayah' | 'Ibu' | 'Wali';
  whatsapp_raw: string;
  whatsapp_e164: string;
  verification_status: 'belum_diverifikasi' | 'terverifikasi';
  communication_consent: boolean;
  consent_updated_at: string;
  student_ids: string[];
  contact_history: GuardianContactHistoryItem[];
  updated_at: string;
}

export interface Student {
  id: string;
  school_id: typeof SCHOOL_ID;
  nis_local: string;
  full_name: string;
  class_id: string;
  halaqah_id: string;
  guardian_ids: string[];
  status: 'aktif' | 'lulus' | 'pindah';
}

export interface TeacherAssignment {
  id: string;
  school_id: typeof SCHOOL_ID;
  teacher_uid: string;
  teacher_name: string;
  class_ids: string[];
  halaqah_ids: string[];
  student_ids: string[];
  can_announce: boolean;
  can_manage_guardian_contacts: boolean;
}

export interface TahfidzTarget {
  id: string;
  school_id: typeof SCHOOL_ID;
  scope: 'student' | 'class' | 'halaqah';
  target_ref_id: string;
  period_label: string;
  start_date: string;
  end_date: string;
  surah_number: number;
  ayah_start: number;
  ayah_end: number;
  target_ayah_count: number;
}

export interface RecordAuditEntry {
  action: 'created' | 'updated' | 'status_changed' | 'whatsapp_shared';
  by_name: string;
  at: string;
  note: string;
}

export interface MemorizationRecord {
  id: string;
  school_id: typeof SCHOOL_ID;
  student_id: string;
  teacher_uid: string;
  teacher_name: string;
  class_id: string;
  halaqah_id: string;
  date: string;
  surah_number: number;
  surah_name: string;
  ayah_start: number;
  ayah_end: number;
  unique_ayah_keys: string[];
  kelancaran?: QualityGrade;
  ketepatan_bacaan?: QualityGrade;
  tajwid?: QualityGrade;
  makhraj?: QualityGrade;
  status: AssessmentStatus;
  teacher_note?: string;
  audit_trail: RecordAuditEntry[];
  whatsapp_share_status: WhatsAppShareStatus;
  whatsapp_shared_at?: string;
  updated_at: string;
}

export interface MurajaahRecord {
  id: string;
  school_id: typeof SCHOOL_ID;
  student_id: string;
  teacher_uid: string;
  teacher_name: string;
  class_id: string;
  halaqah_id: string;
  date: string;
  surah_number: number;
  surah_name: string;
  ayah_start: number;
  ayah_end: number;
  kelancaran?: QualityGrade;
  ketepatan_bacaan?: QualityGrade;
  tajwid?: QualityGrade;
  makhraj?: QualityGrade;
  status: AssessmentStatus;
  teacher_note?: string;
  whatsapp_share_status: WhatsAppShareStatus;
  whatsapp_shared_at?: string;
  updated_at: string;
}

export type SurahJuzGroup = 30 | 29 | 'tambahan';

export interface QuranSurah {
  surah_number: number;
  name_latin: string;
  name_arabic: string;
  ayah_count: number;
  juz_group: SurahJuzGroup;
  revelation_type: 'Makkiyah' | 'Madaniyah';
  source_reference: string;
}

export interface QuranVerse {
  id: string; // e.g. "112:1"
  surah_number: number;
  surah_name: string;
  ayah_number: number;
  arabic_text: string;
  translation_id?: string;
  source_reference: string;
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;
}

export interface QariCatalogItem {
  id: string;
  name: string;
  style: string;
  source_name: string;
  license_type: string;
  attribution_text: string;
  per_ayah_available: boolean;
  timestamps_available: boolean;
  download_allowed: boolean;
  offline_allowed: boolean;
  audio_url_template: string; // e.g. https://everyayah.com/data/Alafasy_128kbps/{surah3}{ayah3}.mp3
  verification_status: VerificationStatus;
}

export interface AudioCacheMetadata {
  key: string; // `${qari_id}:${surah_number}:${ayah_number}`
  qari_id: string;
  surah_number: number;
  ayah_number: number;
  url: string;
  size_bytes: number;
  cached_at: string;
}

export type TajwidDifficulty = 'Sangat Mudah' | 'Mudah' | 'Sedang' | 'Sulit' | 'Tantangan';

export interface TajwidTopic {
  id: string;
  category_code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  category_name: string;
  title: string;
  difficulty: TajwidDifficulty;
  order_index: number;
  simple_definition: string;
  sd_explanation: string;
  trigger_letters: string;
  how_to_recognize: string;
  how_to_read: string;
  color_hex: string;
  color_label: string;
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;
}

export interface TajwidExample {
  id: string;
  topic_id: string;
  hukum_tajwid: string;
  surah_number: number;
  surah_name: string;
  ayah_number: number;
  word_reference: string;
  // Pre-validated split parts so Arabic shaping is tested and segment color stays consistent
  arabic_prefix: string;
  highlighted_segment: string;
  arabic_suffix: string;
  explanation: string;
  comparison_note?: string;
  audio_surah: number;
  audio_ayah: number;
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;
}

export interface TajwidQuestion {
  id: string;
  topic_id: string;
  mode: 'visual' | 'audio' | 'mixed';
  difficulty: TajwidDifficulty;
  prompt: string;
  surah_number: number;
  surah_name: string;
  ayah_number: number;
  arabic_prefix?: string;
  highlighted_segment?: string;
  arabic_suffix?: string;
  options: [string, string, string, string];
  correct_index: 0 | 1 | 2 | 3;
  explanation: string;
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;
}

export type MapsiQuestionType =
  | 'Tebak Nama Surah'
  | 'Tebak Nomor Ayat'
  | 'Tebak Lanjutan Ayat'
  | 'Tebak Potongan Ayat'
  | 'Tebak Akhir Ayat'
  | 'Identifikasi Surah dan Ayat'
  | 'Ayat Sebelum'
  | 'Ayat Sesudah'
  | 'Ayat Mirip'
  | 'Sambung Ayat Lisan'
  | 'Simulasi MAPSi'
  | 'Kuis Identifikasi Hukum Tajwid';

export type MapsiDifficulty = 'Pemula' | 'Menengah' | 'Mahir' | 'Simulasi MAPSi';

export interface MapsiQuestion {
  id: string;
  question_type: MapsiQuestionType;
  difficulty: MapsiDifficulty;
  surah_number: number;
  surah_name: string;
  ayah_number: number;
  prompt: string;
  arabic_snippet?: string;
  options: [string, string, string, string];
  correct_index: 0 | 1 | 2 | 3;
  explanation: string;
  verification_status: VerificationStatus;
  verified_by?: string;
}

export interface QuestionPackage {
  id: string;
  title: string;
  module: 'tajwid' | 'mapsi';
  difficulty: string;
  question_ids: string[];
  duration_seconds: number;
  audio_replay_limit: number;
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  created_at: string;
}

export interface QuizResult {
  id: string;
  student_id: string;
  module: 'tajwid' | 'mapsi';
  package_title: string;
  total_questions: number;
  correct_count: number;
  accuracy_percent: number;
  duration_seconds: number;
  weak_topics: string[];
  weak_surahs: string[];
  completed_at: string;
}

export interface LearningProgress {
  id: string;
  student_id: string;
  activity_type: 'listening' | 'smart_hifdzil' | 'talking_duet' | 'tajwid_study';
  surah_number?: number;
  ayah_number?: number;
  topic_id?: string;
  note: string;
  updated_at: string;
}

export interface LocalAudioRecording {
  id: string;
  student_id: string;
  surah_number: number;
  surah_name: string;
  ayah_number: number;
  mime_type: string;
  duration_seconds: number;
  blob: Blob;
  created_at: string;
}

export type AnnouncementPriority = 'Normal' | 'Penting' | 'Mendesak';
export type AnnouncementCategory =
  | 'Informasi umum'
  | 'Pengumuman penting'
  | 'Jadwal kegiatan'
  | 'Pengingat target hafalan'
  | 'Informasi pembelajaran'
  | 'Motivasi belajar';

export type AnnouncementAudience = 'all' | 'teacher' | 'student' | 'guardian' | 'class' | 'halaqah';

export interface Announcement {
  id: string;
  school_id: typeof SCHOOL_ID;
  title: string;
  body: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  target_audience: AnnouncementAudience;
  target_ref_id?: string;
  author_uid: string;
  author_name: string;
  start_at: string;
  end_at: string;
  is_published: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementRead {
  id: string; // `${announcement_id}:${user_uid}`
  announcement_id: string;
  user_uid: string;
  read_at: string;
}

export interface PendingSyncItem {
  id: string;
  collection: string;
  doc_id: string;
  operation: 'upsert' | 'delete';
  payload: unknown;
  status: 'pending' | 'retrying' | 'synced' | 'error';
  retry_count: number;
  created_at: string;
  last_error?: string;
}

export interface SyncHistoryItem {
  id: string;
  triggered_by: 'auto' | 'manual';
  synced_count: number;
  pending_remaining: number;
  status: 'success' | 'offline_deferred' | 'partial_error';
  message: string;
  at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_uid: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  target: string;
  summary: string;
  timestamp: string;
}
