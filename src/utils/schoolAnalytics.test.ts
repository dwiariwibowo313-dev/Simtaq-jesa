import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeStudentTajwidInsights,
  calculateSchoolAnalytics,
  generateSchoolProgressCsv,
  resolvePackageQuestions,
} from './schoolAnalytics';
import {
  SEED_CLASSES,
  SEED_HALAQAHS,
  SEED_MAPSI_QUESTIONS,
  SEED_MEMORIZATION_RECORDS,
  SEED_MURAJAAH_RECORDS,
  SEED_QUESTION_PACKAGES,
  SEED_QUIZ_RESULTS,
  SEED_STUDENTS,
  SEED_SURAHS,
  SEED_TAJWID_QUESTIONS,
  SEED_TAJWID_TOPICS,
  SEED_TARGETS,
} from '../data/seedData';
import { SCHOOL_ID } from '../types/simtaq';

test('calculateSchoolAnalytics computes accurate factual metrics from lulus records only', () => {
  const summary = calculateSchoolAnalytics(
    SEED_CLASSES,
    SEED_HALAQAHS,
    SEED_STUDENTS,
    SEED_MEMORIZATION_RECORDS,
    SEED_MURAJAAH_RECORDS,
    SEED_TARGETS,
    SEED_SURAHS,
    SEED_QUIZ_RESULTS
  );

  assert.equal(summary.total_students, SEED_STUDENTS.length);
  assert.equal(summary.active_students, SEED_STUDENTS.length);
  assert.ok(summary.total_passed_unique_ayahs > 0);
  assert.equal(summary.class_breakdown.length, SEED_CLASSES.length);
  assert.equal(summary.halaqah_breakdown.length, SEED_HALAQAHS.length);
});

test('generateSchoolProgressCsv exports safe progress metrics without PII phone/email and neutralizes formulas', () => {
  const csv = generateSchoolProgressCsv(
    SEED_CLASSES,
    SEED_HALAQAHS,
    [
      ...SEED_STUDENTS,
      {
        id: 'stu-formula',
        school_id: SCHOOL_ID,
        nis_local: '20269999',
        full_name: '=CMD|calc',
        class_id: 'cls-4a',
        halaqah_id: 'hal-1',
        guardian_ids: [],
        status: 'aktif',
      },
    ],
    SEED_MEMORIZATION_RECORDS,
    SEED_MURAJAAH_RECORDS,
    SEED_TARGETS,
    SEED_SURAHS
  );

  assert.ok(csv.includes('NIS Lokal'));
  assert.ok(csv.includes('Fatimah Az-Zahra'));
  // Must neutralize spreadsheet formula injection
  assert.ok(csv.includes("'=CMD|calc"));
  // Must NEVER include WhatsApp numbers or emails
  assert.equal(csv.includes('+62'), false);
  assert.equal(csv.includes('081234567890'), false);
  assert.equal(csv.includes('@'), false);
});

test('analyzeStudentTajwidInsights separates mastered vs needs-practice topics', () => {
  const insights = analyzeStudentTajwidInsights(
    'stu-1',
    [
      {
        id: 'qr-1',
        student_id: 'stu-1',
        module: 'tajwid',
        package_title: 'Latihan Nun Sukun',
        total_questions: 5,
        correct_count: 4,
        accuracy_percent: 80,
        duration_seconds: 40,
        weak_topics: ['Ikhfa Haqiqi'],
        weak_surahs: [],
        completed_at: '2026-11-20T10:00:00Z',
      },
    ],
    SEED_TAJWID_TOPICS
  );

  assert.equal(insights.latest_accuracy, 80);
  assert.deepEqual(insights.needs_practice_topics, ['Ikhfa Haqiqi']);
  assert.equal(insights.mastered_topics.includes('Ikhfa Haqiqi'), false);
  assert.ok(insights.mastered_topics.length > 0);
});

test('resolvePackageQuestions returns matching package questions', () => {
  const mapsiPkg = SEED_QUESTION_PACKAGES.find((p) => p.module === 'mapsi');
  assert.ok(mapsiPkg);
  const resolved = resolvePackageQuestions(
    mapsiPkg,
    SEED_TAJWID_QUESTIONS,
    SEED_MAPSI_QUESTIONS
  );
  assert.equal(resolved.tajwid.length, 0);
  assert.ok(resolved.mapsi.length > 0);
});
