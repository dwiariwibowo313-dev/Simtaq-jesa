import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BLUEPRINT_LIMITS,
  evaluateMemorizationWriteRule,
  evaluateSuperAdminBootstrapRule,
  evaluateUserCreateRule,
  hasOnlyAllowedKeys,
  isValidFirestoreId,
} from './src/utils/firestoreSecurityValidator';
import { SCHOOL_ID, SUPER_ADMIN_EMAIL } from './src/types/simtaq';

test('Dirty Dozen #1: rejects spoofed Super Admin email when email_verified is false', () => {
  const res = evaluateSuperAdminBootstrapRule(
    { uid: 'uid-spoof', email: SUPER_ADMIN_EMAIL, email_verified: false },
    'super_admin',
    {
      super_admin_uid: 'uid-spoof',
      email: SUPER_ADMIN_EMAIL,
      school_id: SCHOOL_ID,
      bootstrapped_at: 'SERVER_TIME',
    },
    false,
    true
  );
  assert.equal(res.allowed, false);
});

test('Dirty Dozen #2: rejects duplicate Super Admin bootstrap after lock exists', () => {
  const res = evaluateSuperAdminBootstrapRule(
    { uid: 'uid-real', email: SUPER_ADMIN_EMAIL, email_verified: true },
    'super_admin',
    {
      super_admin_uid: 'uid-real',
      email: SUPER_ADMIN_EMAIL,
      school_id: SCHOOL_ID,
      bootstrapped_at: 'SERVER_TIME',
    },
    true,
    true
  );
  assert.equal(res.allowed, false);
});

test('Dirty Dozen #3: rejects self-role escalation to super_admin or active teacher', () => {
  const escalateSuper = evaluateUserCreateRule(
    { uid: 'stu-uid-1', email: 'siswa@example.com', email_verified: true },
    'stu-uid-1',
    {
      uid: 'stu-uid-1',
      email: 'siswa@example.com',
      display_name: 'Hacker',
      role: 'super_admin',
      school_id: SCHOOL_ID,
      is_active: true,
      linked_entity_id: '',
      email_verified: true,
      created_at: 'SERVER_TIME',
      updated_at: 'SERVER_TIME',
    },
    false
  );
  assert.equal(escalateSuper.allowed, false);
});

test('Dirty Dozen #4: rejects shadow/ghost field injection (isAdmin: true)', () => {
  const shadow = evaluateUserCreateRule(
    { uid: 'stu-uid-1', email: 'siswa@example.com', email_verified: true },
    'stu-uid-1',
    {
      uid: 'stu-uid-1',
      email: 'siswa@example.com',
      display_name: 'Siswa',
      role: 'student',
      school_id: SCHOOL_ID,
      is_active: false,
      linked_entity_id: '',
      email_verified: true,
      created_at: 'SERVER_TIME',
      updated_at: 'SERVER_TIME',
      isAdmin: true,
    },
    false
  );
  assert.equal(shadow.allowed, false);
});

test('Dirty Dozen #5: rejects foreign school_id writes', () => {
  const foreign = evaluateMemorizationWriteRule(
    { uid: 'adm-1', email: 'adm@example.com', email_verified: true },
    'mem-evil',
    'create',
    {
      school_id: 'other-school',
      unique_ayah_keys: ['114:1'],
      created_at: 'SERVER_TIME',
      updated_at: 'SERVER_TIME',
    },
    null,
    ['tch-1'],
    'school_admin'
  );
  assert.equal(foreign.allowed, false);
});

test('Dirty Dozen #6: rejects poisoned path IDs (>128 chars or invalid characters)', () => {
  assert.equal(isValidFirestoreId('../evil/path'), false);
  assert.equal(isValidFirestoreId('a'.repeat(129)), false);
  assert.equal(isValidFirestoreId('valid_id-123'), true);
});

test('Dirty Dozen #7: rejects memorization creation by unassigned teacher', () => {
  const unassigned = evaluateMemorizationWriteRule(
    { uid: 'tch-other', email: 'tch2@example.com', email_verified: true },
    'mem-99',
    'create',
    {
      school_id: SCHOOL_ID,
      teacher_uid: 'tch-other',
      unique_ayah_keys: ['114:1'],
      created_at: 'SERVER_TIME',
      updated_at: 'SERVER_TIME',
    },
    null,
    ['tch-1'],
    'teacher'
  );
  assert.equal(unassigned.allowed, false);
});

test('Dirty Dozen #8 & #12: firestore.rules enforces zero get/exists in allow list and blocks audit_logs mutation', () => {
  const rulesText = fs.readFileSync('firestore.rules', 'utf8');
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
  assert.ok(rulesText.includes("request.auth.token.email_verified == true"));

  // Extract every allow list statement block and verify zero get() or exists() calls
  const listMatches = [...rulesText.matchAll(/allow list:[\s\S]*?;/g)];
  assert.ok(listMatches.length >= 10);
  for (const m of listMatches) {
    assert.equal(/\b(get|exists|existsAfter)\s*\(/.test(m[0]), false, `Forbidden get/exists in allow list: ${m[0]}`);
  }

  // Audit logs immutable
  assert.ok(/match \/audit_logs\/\{logId\}[\s\S]*?allow update, delete: if false;/.test(rulesText));
});

test('Dirty Dozen #9: rejects grade tampering after memorization status reaches terminal lulus', () => {
  const existing = {
    school_id: SCHOOL_ID,
    teacher_uid: 'tch-1',
    status: 'lulus',
    kelancaran: 'Mumtaz (Sangat Baik)',
    unique_ayah_keys: ['114:1'],
  };
  const tamper = evaluateMemorizationWriteRule(
    { uid: 'tch-1', email: 'guru@example.com', email_verified: true },
    'mem-1',
    'update',
    { ...existing, status: 'perlu_perbaikan', updated_at: 'SERVER_TIME' },
    existing,
    ['tch-1'],
    'teacher'
  );
  assert.equal(tamper.allowed, false);

  // Sharing WhatsApp after lulus IS allowed
  const shareOnly = evaluateMemorizationWriteRule(
    { uid: 'tch-1', email: 'guru@example.com', email_verified: true },
    'mem-1',
    'update',
    { ...existing, whatsapp_share_status: 'whatsapp_dibuka', updated_at: 'SERVER_TIME' },
    existing,
    ['tch-1'],
    'teacher'
  );
  assert.equal(shareOnly.allowed, true);
});

test('Dirty Dozen #10 & #11: rejects forged client timestamps and oversized arrays', () => {
  const forgedTime = evaluateUserCreateRule(
    { uid: 'u-1', email: 'u1@example.com', email_verified: true },
    'u-1',
    {
      uid: 'u-1',
      email: 'u1@example.com',
      display_name: 'U1',
      role: 'student',
      school_id: SCHOOL_ID,
      is_active: false,
      linked_entity_id: '',
      email_verified: true,
      created_at: '2020-01-01T00:00:00Z',
      updated_at: '2020-01-01T00:00:00Z',
    },
    false
  );
  assert.equal(forgedTime.allowed, false);

  const oversized = evaluateMemorizationWriteRule(
    { uid: 'adm-1', email: 'adm@example.com', email_verified: true },
    'mem-big',
    'create',
    {
      school_id: SCHOOL_ID,
      unique_ayah_keys: Array.from({ length: BLUEPRINT_LIMITS.maxUniqueAyahKeys + 1 }, (_, i) => `2:${i + 1}`),
      created_at: 'SERVER_TIME',
      updated_at: 'SERVER_TIME',
    },
    null,
    [],
    'school_admin'
  );
  assert.equal(oversized.allowed, false);
  assert.equal(hasOnlyAllowedKeys({ a: 1, ghost: 2 }, ['a']), false);
});

import { validateMasterDataPayload } from './src/utils/firestoreSecurityValidator';

test('Phase 3 Master Data validation: accepts valid classes, targets, and school_settings; rejects oversized logos or invalid grades', () => {
  const validClass = validateMasterDataPayload('classes', 'cls-4b', {
    id: 'cls-4b',
    school_id: SCHOOL_ID,
    name: 'Kelas 4B',
    grade_level: 4,
    academic_year: '2026/2027',
  });
  assert.equal(validClass.allowed, true);

  const invalidGrade = validateMasterDataPayload('classes', 'cls-9', {
    id: 'cls-9',
    school_id: SCHOOL_ID,
    name: 'Kelas 9',
    grade_level: 9,
    academic_year: '2026/2027',
  });
  assert.equal(invalidGrade.allowed, false);

  const validTarget = validateMasterDataPayload('tahfidz_targets', 'tgt-1', {
    id: 'tgt-1',
    school_id: SCHOOL_ID,
    scope: 'class',
    target_ref_id: 'cls-4a',
    period_label: 'Semester 2',
    start_date: '2027-01-01',
    end_date: '2027-06-30',
    surah_number: 112,
    ayah_start: 1,
    ayah_end: 4,
    target_ayah_count: 25,
  });
  assert.equal(validTarget.allowed, true);

  const oversizedLogo = validateMasterDataPayload('school_settings', SCHOOL_ID, {
    id: SCHOOL_ID,
    school_id: SCHOOL_ID,
    school_name: 'SDN Jetiskarangpung 1',
    slogan: 'Sekolah Para Juara',
    logo_data_url: 'x'.repeat(BLUEPRINT_LIMITS.logoDataUrlMaxLength + 1),
    app_version: '1.2.0-phase3',
    auto_sync_enabled: true,
    sync_interval_minutes: 10,
    updated_by: 'Admin',
    updated_at: 'SERVER_TIME',
  });
  assert.equal(oversizedLogo.allowed, false);
});

