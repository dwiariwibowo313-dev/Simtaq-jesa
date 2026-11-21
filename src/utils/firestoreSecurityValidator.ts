import { SCHOOL_ID, SUPER_ADMIN_EMAIL } from '../types/simtaq';

export const FIRESTORE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export const BLUEPRINT_LIMITS = {
  idMaxLength: 128,
  emailMaxLength: 160,
  displayNameMaxLength: 120,
  schoolNameMaxLength: 120,
  sloganMaxLength: 200,
  logoDataUrlMaxLength: 400000,
  teacherNoteMaxLength: 500,
  announcementTitleMaxLength: 160,
  announcementBodyMaxLength: 1500,
  auditSummaryMaxLength: 400,
  maxUniqueAyahKeys: 286,
  maxGuardiansPerStudent: 4,
  maxAssignedTeachers: 10,
} as const;

export interface AuthContextMock {
  uid: string;
  email: string;
  email_verified: boolean;
}

export type RuleEvalResult = { allowed: boolean; reason: string };

export function isValidFirestoreId(id: unknown): id is string {
  return typeof id === 'string' && FIRESTORE_ID_REGEX.test(id);
}

export function sanitizeFirestoreString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function hasOnlyAllowedKeys(obj: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(obj).every((k) => allowed.has(k));
}

export function evaluateSuperAdminBootstrapRule(
  auth: AuthContextMock | null,
  docId: string,
  payload: Record<string, unknown>,
  alreadyBootstrapped: boolean,
  hasAtomicBatch: boolean
): RuleEvalResult {
  if (!auth || !auth.email_verified) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Verified email required' };
  }
  if (docId !== 'super_admin' || !isValidFirestoreId(docId)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid bootstrap docId' };
  }
  if (auth.email !== SUPER_ADMIN_EMAIL) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Unauthorized email for Super Admin bootstrap' };
  }
  if (alreadyBootstrapped) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Super Admin bootstrap is one-time only' };
  }
  if (!hasAtomicBatch) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Atomic admins & users writes required' };
  }
  if (
    !hasOnlyAllowedKeys(payload, ['super_admin_uid', 'email', 'school_id', 'bootstrapped_at']) ||
    payload.super_admin_uid !== auth.uid ||
    payload.email !== SUPER_ADMIN_EMAIL ||
    payload.school_id !== SCHOOL_ID ||
    payload.bootstrapped_at !== 'SERVER_TIME'
  ) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid bootstrap payload' };
  }
  return { allowed: true, reason: 'OK' };
}

export function evaluateUserCreateRule(
  auth: AuthContextMock | null,
  uid: string,
  payload: Record<string, unknown>,
  isCallerAdmin: boolean
): RuleEvalResult {
  if (!auth || !auth.email_verified) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Unverified user' };
  }
  if (!isValidFirestoreId(uid)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid UID' };
  }
  const allowedKeys = [
    'uid',
    'email',
    'display_name',
    'role',
    'school_id',
    'is_active',
    'linked_entity_id',
    'email_verified',
    'created_at',
    'updated_at',
  ] as const;
  if (!hasOnlyAllowedKeys(payload, allowedKeys)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Shadow field detected' };
  }
  if (payload.school_id !== SCHOOL_ID || payload.uid !== uid) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid school_id or uid' };
  }
  if (payload.created_at !== 'SERVER_TIME' || payload.updated_at !== 'SERVER_TIME') {
    return { allowed: false, reason: 'PERMISSION_DENIED: Client-forged timestamp rejected' };
  }
  const isSuperEmail = auth.email === SUPER_ADMIN_EMAIL && uid === auth.uid;
  if (isSuperEmail && payload.role === 'super_admin' && payload.is_active === true) {
    return { allowed: true, reason: 'OK' };
  }
  if (
    uid === auth.uid &&
    (payload.role === 'student' || payload.role === 'guardian') &&
    payload.is_active === false &&
    payload.linked_entity_id === ''
  ) {
    return { allowed: true, reason: 'OK' };
  }
  if (isCallerAdmin && payload.role !== 'super_admin') {
    return { allowed: true, reason: 'OK' };
  }
  return { allowed: false, reason: 'PERMISSION_DENIED: Self-role escalation blocked' };
}

export function evaluateMemorizationWriteRule(
  auth: AuthContextMock | null,
  recordId: string,
  operation: 'create' | 'update',
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  studentAssignedTeacherUids: string[],
  callerRole: 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'guardian'
): RuleEvalResult {
  if (!auth || !auth.email_verified) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Verified user required' };
  }
  if (!isValidFirestoreId(recordId)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid recordId' };
  }
  if (incoming.school_id !== SCHOOL_ID) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Single-school lock violated' };
  }
  const keys = incoming.unique_ayah_keys;
  if (
    !Array.isArray(keys) ||
    keys.length > BLUEPRINT_LIMITS.maxUniqueAyahKeys ||
    (keys.length > 0 && typeof keys[0] !== 'string')
  ) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid or oversized unique_ayah_keys' };
  }
  if (operation === 'create') {
    if (incoming.created_at !== 'SERVER_TIME' || incoming.updated_at !== 'SERVER_TIME') {
      return { allowed: false, reason: 'PERMISSION_DENIED: Must use server timestamp' };
    }
    if (callerRole === 'super_admin' || callerRole === 'school_admin') {
      return { allowed: true, reason: 'OK' };
    }
    if (
      callerRole === 'teacher' &&
      incoming.teacher_uid === auth.uid &&
      studentAssignedTeacherUids.includes(auth.uid)
    ) {
      return { allowed: true, reason: 'OK' };
    }
    return { allowed: false, reason: 'PERMISSION_DENIED: Teacher not assigned to student' };
  }

  // Update path
  if (!existing) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Missing existing doc' };
  }
  if (callerRole === 'super_admin' || callerRole === 'school_admin') {
    return { allowed: true, reason: 'OK' };
  }
  if (callerRole === 'teacher' && existing.teacher_uid === auth.uid) {
    if (existing.status === 'lulus') {
      const changed = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
      const allowedPostLulus = new Set(['whatsapp_share_status', 'whatsapp_shared_at', 'updated_at']);
      if (changed.some((k) => !allowedPostLulus.has(k))) {
        return { allowed: false, reason: 'PERMISSION_DENIED: Terminal state lulus locked against grade mutation' };
      }
    }
    return { allowed: true, reason: 'OK' };
  }
  return { allowed: false, reason: 'PERMISSION_DENIED: Unauthorized update' };
}

export function validateMasterDataPayload(
  collectionName:
    | 'school_settings'
    | 'classes'
    | 'halaqahs'
    | 'teacher_assignments'
    | 'tahfidz_targets'
    | 'announcement_reads',
  docId: string,
  payload: Record<string, unknown>
): RuleEvalResult {
  if (!isValidFirestoreId(docId)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid docId format' };
  }
  if (collectionName === 'announcement_reads') {
    const allowedKeys = ['id', 'announcement_id', 'user_uid', 'read_at'] as const;
    if (!hasOnlyAllowedKeys(payload, allowedKeys)) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Unexpected keys in announcement_reads' };
    }
    if (
      payload.id !== docId ||
      !isValidFirestoreId(payload.announcement_id) ||
      !isValidFirestoreId(payload.user_uid) ||
      payload.read_at !== 'SERVER_TIME'
    ) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Invalid announcement_reads payload' };
    }
    return { allowed: true, reason: 'OK' };
  }

  if (payload.school_id !== SCHOOL_ID || payload.id !== docId) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Single-school lock or ID mismatch' };
  }

  if (collectionName === 'school_settings') {
    const allowedKeys = [
      'id',
      'school_id',
      'school_name',
      'slogan',
      'logo_data_url',
      'app_version',
      'auto_sync_enabled',
      'sync_interval_minutes',
      'updated_by',
      'updated_at',
    ] as const;
    if (!hasOnlyAllowedKeys(payload, allowedKeys)) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Unexpected keys in school_settings' };
    }
    if (
      docId !== SCHOOL_ID ||
      typeof payload.school_name !== 'string' ||
      typeof payload.slogan !== 'string' ||
      typeof payload.auto_sync_enabled !== 'boolean' ||
      typeof payload.sync_interval_minutes !== 'number' ||
      payload.sync_interval_minutes < 1 ||
      payload.sync_interval_minutes > 120 ||
      payload.updated_at !== 'SERVER_TIME'
    ) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Invalid school_settings values' };
    }
    if (
      payload.logo_data_url !== undefined &&
      (typeof payload.logo_data_url !== 'string' ||
        payload.logo_data_url.length > BLUEPRINT_LIMITS.logoDataUrlMaxLength)
    ) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Logo payload exceeds 400KB limit' };
    }
    return { allowed: true, reason: 'OK' };
  }

  if (collectionName === 'classes') {
    const allowedKeys = [
      'id',
      'school_id',
      'name',
      'grade_level',
      'academic_year',
      'homeroom_teacher_id',
    ] as const;
    if (!hasOnlyAllowedKeys(payload, allowedKeys)) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Unexpected keys in classes' };
    }
    if (
      typeof payload.name !== 'string' ||
      payload.name.length < 1 ||
      typeof payload.grade_level !== 'number' ||
      payload.grade_level < 1 ||
      payload.grade_level > 6
    ) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Invalid class grade_level or name' };
    }
    return { allowed: true, reason: 'OK' };
  }

  if (collectionName === 'halaqahs') {
    const allowedKeys = [
      'id',
      'school_id',
      'name',
      'teacher_id',
      'class_ids',
      'schedule_note',
    ] as const;
    if (!hasOnlyAllowedKeys(payload, allowedKeys)) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Unexpected keys in halaqahs' };
    }
    if (
      typeof payload.name !== 'string' ||
      payload.name.length < 1 ||
      typeof payload.teacher_id !== 'string' ||
      payload.teacher_id.length < 1 ||
      !Array.isArray(payload.class_ids) ||
      payload.class_ids.length > 20
    ) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Invalid halaqah payload' };
    }
    return { allowed: true, reason: 'OK' };
  }

  if (collectionName === 'teacher_assignments') {
    const allowedKeys = [
      'id',
      'school_id',
      'teacher_uid',
      'teacher_name',
      'class_ids',
      'halaqah_ids',
      'student_ids',
      'admin_uids',
      'can_announce',
      'can_manage_guardian_contacts',
    ] as const;
    if (!hasOnlyAllowedKeys(payload, allowedKeys)) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Unexpected keys in teacher_assignments' };
    }
    if (
      !isValidFirestoreId(payload.teacher_uid) ||
      typeof payload.teacher_name !== 'string' ||
      payload.teacher_name.length < 2 ||
      !Array.isArray(payload.class_ids) ||
      !Array.isArray(payload.halaqah_ids) ||
      !Array.isArray(payload.student_ids) ||
      !Array.isArray(payload.admin_uids)
    ) {
      return { allowed: false, reason: 'PERMISSION_DENIED: Invalid teacher_assignment payload' };
    }
    return { allowed: true, reason: 'OK' };
  }

  // tahfidz_targets
  const allowedKeys = [
    'id',
    'school_id',
    'scope',
    'target_ref_id',
    'period_label',
    'start_date',
    'end_date',
    'surah_number',
    'ayah_start',
    'ayah_end',
    'target_ayah_count',
  ] as const;
  if (!hasOnlyAllowedKeys(payload, allowedKeys)) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Unexpected keys in tahfidz_targets' };
  }
  if (
    !['student', 'class', 'halaqah'].includes(String(payload.scope)) ||
    typeof payload.surah_number !== 'number' ||
    payload.surah_number < 1 ||
    payload.surah_number > 114 ||
    typeof payload.ayah_start !== 'number' ||
    payload.ayah_start < 1 ||
    typeof payload.ayah_end !== 'number' ||
    payload.ayah_end < payload.ayah_start ||
    typeof payload.target_ayah_count !== 'number' ||
    payload.target_ayah_count < 1
  ) {
    return { allowed: false, reason: 'PERMISSION_DENIED: Invalid tahfidz_target bounds' };
  }
  return { allowed: true, reason: 'OK' };
}

