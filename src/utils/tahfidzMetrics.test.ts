import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStudentHafalanSummary,
  calculateTeacherMonitoringSummary,
  expandUniqueAyahKeys,
} from './tahfidzMetrics';
import {
  MemorizationRecord,
  MurajaahRecord,
  QuranSurah,
  SCHOOL_ID,
  Student,
  TahfidzTarget,
  TeacherAssignment,
} from '../types/simtaq';

const sampleSurahs: QuranSurah[] = [
  {
    surah_number: 112,
    name_latin: 'Al-Ikhlas',
    name_arabic: 'الإخلاص',
    ayah_count: 4,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil',
  },
  {
    surah_number: 113,
    name_latin: 'Al-Falaq',
    name_arabic: 'الفلق',
    ayah_count: 5,
    juz_group: 30,
    revelation_type: 'Makkiyah',
    source_reference: 'Tanzil',
  },
];

const sampleTargets: TahfidzTarget[] = [
  {
    id: 'tgt-1',
    school_id: SCHOOL_ID,
    scope: 'class',
    target_ref_id: 'cls-4a',
    period_label: 'Semester 1 2026/2027',
    start_date: '2026-07-01',
    end_date: '2026-12-31',
    surah_number: 112,
    ayah_start: 1,
    ayah_end: 4,
    target_ayah_count: 9,
  },
];

test('expandUniqueAyahKeys expands inclusive ranges and handles reversed ranges safely', () => {
  assert.deepEqual(expandUniqueAyahKeys(112, 1, 4), ['112:1', '112:2', '112:3', '112:4']);
  assert.deepEqual(expandUniqueAyahKeys(112, 4, 2), ['112:2', '112:3', '112:4']);
});

test('student summary deduplicates overlapping passed ayahs and excludes pending/revision/murajaah', () => {
  const memorization: MemorizationRecord[] = [
    {
      id: 'm1',
      school_id: SCHOOL_ID,
      student_id: 'stu-1',
      teacher_uid: 'tch-1',
      teacher_name: 'Ustadz Ahmad',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      date: '2026-10-01',
      surah_number: 112,
      surah_name: 'Al-Ikhlas',
      ayah_start: 1,
      ayah_end: 2,
      unique_ayah_keys: ['112:1', '112:2'],
      status: 'lulus',
      audit_trail: [],
      whatsapp_share_status: 'belum_dibagikan',
      updated_at: '2026-10-01T08:00:00Z',
    },
    // Overlapping re-submission of ayahs 1-4: total unique passed ayahs in Al-Ikhlas must be 4, NOT 6
    {
      id: 'm2',
      school_id: SCHOOL_ID,
      student_id: 'stu-1',
      teacher_uid: 'tch-1',
      teacher_name: 'Ustadz Ahmad',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      date: '2026-10-05',
      surah_number: 112,
      surah_name: 'Al-Ikhlas',
      ayah_start: 1,
      ayah_end: 4,
      unique_ayah_keys: ['112:1', '112:2', '112:3', '112:4'],
      status: 'lulus',
      audit_trail: [],
      whatsapp_share_status: 'belum_dibagikan',
      updated_at: '2026-10-05T08:00:00Z',
    },
    // Pending & revision must NOT count as passed
    {
      id: 'm3',
      school_id: SCHOOL_ID,
      student_id: 'stu-1',
      teacher_uid: 'tch-1',
      teacher_name: 'Ustadz Ahmad',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      date: '2026-10-10',
      surah_number: 113,
      surah_name: 'Al-Falaq',
      ayah_start: 1,
      ayah_end: 5,
      unique_ayah_keys: ['113:1', '113:2', '113:3', '113:4', '113:5'],
      status: 'perlu_perbaikan',
      audit_trail: [],
      whatsapp_share_status: 'belum_dibagikan',
      updated_at: '2026-10-10T08:00:00Z',
    },
    {
      id: 'm4',
      school_id: SCHOOL_ID,
      student_id: 'stu-1',
      teacher_uid: 'tch-1',
      teacher_name: 'Ustadz Ahmad',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      date: '2026-10-12',
      surah_number: 113,
      surah_name: 'Al-Falaq',
      ayah_start: 1,
      ayah_end: 3,
      unique_ayah_keys: ['113:1', '113:2', '113:3'],
      status: 'menunggu_penilaian',
      audit_trail: [],
      whatsapp_share_status: 'belum_dibagikan',
      updated_at: '2026-10-12T08:00:00Z',
    },
  ];

  const murajaah: MurajaahRecord[] = [
    {
      id: 'mr1',
      school_id: SCHOOL_ID,
      student_id: 'stu-1',
      teacher_uid: 'tch-1',
      teacher_name: 'Ustadz Ahmad',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      date: '2026-10-13',
      surah_number: 113,
      surah_name: 'Al-Falaq',
      ayah_start: 1,
      ayah_end: 5,
      status: 'lulus',
      whatsapp_share_status: 'belum_dibagikan',
      updated_at: '2026-10-13T08:00:00Z',
    },
  ];

  const summary = calculateStudentHafalanSummary(
    'stu-1',
    memorization,
    murajaah,
    sampleTargets,
    sampleSurahs,
    'cls-4a',
    'hal-1'
  );

  assert.equal(summary.total_passed_unique_ayahs, 4);
  assert.equal(summary.total_completed_surahs, 1);
  assert.equal(summary.pending_count, 1);
  assert.equal(summary.needs_revision_count, 1);
  assert.equal(summary.murajaah_count, 1);
  assert.equal(summary.target_realized_ayahs, 4);
  assert.equal(summary.target_percentage, 44); // 4 / 9 = 44%
});

test('teacher monitoring restricts students strictly to teacher assignment scope', () => {
  const assignment: TeacherAssignment = {
    id: 'assign-1',
    school_id: SCHOOL_ID,
    teacher_uid: 'tch-1',
    teacher_name: 'Ustadz Ahmad',
    class_ids: ['cls-4a'],
    halaqah_ids: [],
    student_ids: [],
    can_announce: true,
    can_manage_guardian_contacts: true,
  };

  const students: Student[] = [
    {
      id: 'stu-1',
      school_id: SCHOOL_ID,
      nis_local: '001',
      full_name: 'Aisyah',
      class_id: 'cls-4a',
      halaqah_id: 'hal-1',
      guardian_ids: [],
      status: 'aktif',
    },
    {
      id: 'stu-other',
      school_id: SCHOOL_ID,
      nis_local: '002',
      full_name: 'Budi (Kelas Lain)',
      class_id: 'cls-5a',
      halaqah_id: 'hal-2',
      guardian_ids: [],
      status: 'aktif',
    },
  ];

  const summary = calculateTeacherMonitoringSummary(
    assignment,
    students,
    [],
    [],
    sampleTargets,
    sampleSurahs
  );

  assert.equal(summary.assigned_students_count, 1);
  assert.equal(summary.student_rows[0].student.id, 'stu-1');
});
