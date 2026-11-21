import {
  ClassRoom,
  Halaqah,
  MapsiQuestion,
  MemorizationRecord,
  MurajaahRecord,
  QuestionPackage,
  QuizResult,
  QuranSurah,
  Student,
  TahfidzTarget,
  TajwidQuestion,
  TajwidTopic,
} from '../types/simtaq';
import { calculateStudentHafalanSummary } from './tahfidzMetrics';

export interface GroupAnalyticsRow {
  id: string;
  name: string;
  student_count: number;
  passed_unique_ayahs: number;
  completed_surahs: number;
  avg_target_percentage: number;
}

export interface SchoolAnalyticsSummary {
  total_students: number;
  active_students: number;
  inactive_students: number;
  total_passed_unique_ayahs: number;
  total_completed_surahs: number;
  pending_assessment_count: number;
  needs_revision_count: number;
  murajaah_count: number;
  whatsapp_shared_count: number;
  avg_quiz_accuracy: number;
  class_breakdown: GroupAnalyticsRow[];
  halaqah_breakdown: GroupAnalyticsRow[];
  weak_tajwid_topics: { topic: string; count: number }[];
  weak_mapsi_surahs: { surah: string; count: number }[];
}

export function calculateSchoolAnalytics(
  classes: ClassRoom[],
  halaqahs: Halaqah[],
  students: Student[],
  memorizationRecords: MemorizationRecord[],
  murajaahRecords: MurajaahRecord[],
  targets: TahfidzTarget[],
  surahs: QuranSurah[],
  quizResults: QuizResult[]
): SchoolAnalyticsSummary {
  const activeStudents = students.filter((s) => s.status === 'aktif');
  const inactiveStudents = students.length - activeStudents.length;

  const studentSummaryMap = new Map(
    students.map((s) => [
      s.id,
      calculateStudentHafalanSummary(
        s.id,
        memorizationRecords,
        murajaahRecords,
        targets,
        surahs,
        s.class_id,
        s.halaqah_id
      ),
    ])
  );

  let totalPassedUniqueAyahs = 0;
  let totalCompletedSurahs = 0;
  for (const s of activeStudents) {
    const sum = studentSummaryMap.get(s.id);
    if (sum) {
      totalPassedUniqueAyahs += sum.total_passed_unique_ayahs;
      totalCompletedSurahs += sum.total_completed_surahs;
    }
  }

  const classBreakdown: GroupAnalyticsRow[] = classes.map((cls) => {
    const groupStudents = activeStudents.filter((s) => s.class_id === cls.id);
    let ayahs = 0;
    let completed = 0;
    let pctSum = 0;
    for (const s of groupStudents) {
      const sum = studentSummaryMap.get(s.id);
      if (sum) {
        ayahs += sum.total_passed_unique_ayahs;
        completed += sum.total_completed_surahs;
        pctSum += sum.target_percentage;
      }
    }
    return {
      id: cls.id,
      name: cls.name,
      student_count: groupStudents.length,
      passed_unique_ayahs: ayahs,
      completed_surahs: completed,
      avg_target_percentage:
        groupStudents.length > 0 ? Math.round(pctSum / groupStudents.length) : 0,
    };
  });

  const halaqahBreakdown: GroupAnalyticsRow[] = halaqahs.map((hal) => {
    const groupStudents = activeStudents.filter((s) => s.halaqah_id === hal.id);
    let ayahs = 0;
    let completed = 0;
    let pctSum = 0;
    for (const s of groupStudents) {
      const sum = studentSummaryMap.get(s.id);
      if (sum) {
        ayahs += sum.total_passed_unique_ayahs;
        completed += sum.total_completed_surahs;
        pctSum += sum.target_percentage;
      }
    }
    return {
      id: hal.id,
      name: hal.name,
      student_count: groupStudents.length,
      passed_unique_ayahs: ayahs,
      completed_surahs: completed,
      avg_target_percentage:
        groupStudents.length > 0 ? Math.round(pctSum / groupStudents.length) : 0,
    };
  });

  const weakTopicMap = new Map<string, number>();
  const weakSurahMap = new Map<string, number>();
  for (const qr of quizResults) {
    for (const wt of qr.weak_topics) {
      weakTopicMap.set(wt, (weakTopicMap.get(wt) ?? 0) + 1);
    }
    for (const ws of qr.weak_surahs) {
      weakSurahMap.set(ws, (weakSurahMap.get(ws) ?? 0) + 1);
    }
  }

  const weakTajwidTopics = Array.from(weakTopicMap.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  const weakMapsiSurahs = Array.from(weakSurahMap.entries())
    .map(([surah, count]) => ({ surah, count }))
    .sort((a, b) => b.count - a.count);

  const avgQuizAccuracy =
    quizResults.length > 0
      ? Math.round(
          quizResults.reduce((acc, q) => acc + q.accuracy_percent, 0) / quizResults.length
        )
      : 0;

  return {
    total_students: students.length,
    active_students: activeStudents.length,
    inactive_students: inactiveStudents,
    total_passed_unique_ayahs: totalPassedUniqueAyahs,
    total_completed_surahs: totalCompletedSurahs,
    pending_assessment_count: memorizationRecords.filter(
      (r) => r.status === 'menunggu_penilaian'
    ).length,
    needs_revision_count: memorizationRecords.filter(
      (r) => r.status === 'perlu_perbaikan'
    ).length,
    murajaah_count: murajaahRecords.length,
    whatsapp_shared_count: memorizationRecords.filter(
      (r) => r.whatsapp_share_status !== 'belum_dibagikan'
    ).length,
    avg_quiz_accuracy: avgQuizAccuracy,
    class_breakdown: classBreakdown,
    halaqah_breakdown: halaqahBreakdown,
    weak_tajwid_topics: weakTajwidTopics,
    weak_mapsi_surahs: weakMapsiSurahs,
  };
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  // Neutralize spreadsheet formula injection (=, +, -, @)
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  const escaped = neutralized.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates a strictly non-PII CSV progress report for school administrators.
 * Explicitly excludes guardian WhatsApp numbers, personal emails, and Firebase UIDs.
 */
export function generateSchoolProgressCsv(
  classes: ClassRoom[],
  halaqahs: Halaqah[],
  students: Student[],
  memorizationRecords: MemorizationRecord[],
  murajaahRecords: MurajaahRecord[],
  targets: TahfidzTarget[],
  surahs: QuranSurah[]
): string {
  const classLookup = new Map(classes.map((c) => [c.id, c.name]));
  const halaqahLookup = new Map(halaqahs.map((h) => [h.id, h.name]));

  const headers = [
    'NIS Lokal',
    'Nama Siswa',
    'Kelas',
    'Halaqah',
    'Status Siswa',
    'Surah Tuntas',
    'Ayat Unik Lulus',
    'Capaian Target (%)',
    'Jumlah Murajaah',
    'Setoran Terakhir',
    'Status Terakhir',
  ];

  const rows = students.map((student) => {
    const summary = calculateStudentHafalanSummary(
      student.id,
      memorizationRecords,
      murajaahRecords,
      targets,
      surahs,
      student.class_id,
      student.halaqah_id
    );
    return [
      escapeCsvCell(student.nis_local),
      escapeCsvCell(student.full_name),
      escapeCsvCell(classLookup.get(student.class_id) ?? student.class_id),
      escapeCsvCell(halaqahLookup.get(student.halaqah_id) ?? student.halaqah_id),
      escapeCsvCell(student.status),
      escapeCsvCell(summary.total_completed_surahs),
      escapeCsvCell(summary.total_passed_unique_ayahs),
      escapeCsvCell(summary.target_percentage),
      escapeCsvCell(summary.murajaah_count),
      escapeCsvCell(summary.last_submission_range ?? '-'),
      escapeCsvCell(summary.last_submission_status ?? '-'),
    ].join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export interface StudentTajwidInsights {
  mastered_topics: string[];
  needs_practice_topics: string[];
  latest_accuracy: number | null;
}

export function analyzeStudentTajwidInsights(
  studentId: string,
  quizResults: QuizResult[],
  topics: TajwidTopic[]
): StudentTajwidInsights {
  const tajwidRuns = quizResults
    .filter((q) => q.student_id === studentId && q.module === 'tajwid')
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));

  if (tajwidRuns.length === 0) {
    return {
      mastered_topics: [],
      needs_practice_topics: [],
      latest_accuracy: null,
    };
  }

  const weakSet = new Set<string>();
  for (const run of tajwidRuns.slice(0, 5)) {
    for (const wt of run.weak_topics) {
      weakSet.add(wt);
    }
  }

  const latestRun = tajwidRuns[0];
  const mastered =
    latestRun.accuracy_percent >= 70
      ? topics
          .filter((t) => !weakSet.has(t.title))
          .slice(0, 4)
          .map((t) => t.title)
      : [];

  return {
    mastered_topics: mastered,
    needs_practice_topics: Array.from(weakSet),
    latest_accuracy: latestRun.accuracy_percent,
  };
}

export function resolvePackageQuestions(
  pkg: QuestionPackage,
  tajwidQuestions: TajwidQuestion[],
  mapsiQuestions: MapsiQuestion[]
): { tajwid: TajwidQuestion[]; mapsi: MapsiQuestion[] } {
  const idSet = new Set(pkg.question_ids);
  if (pkg.module === 'tajwid') {
    const matched = tajwidQuestions.filter((q) => idSet.has(q.id));
    return {
      tajwid: matched.length > 0 ? matched : tajwidQuestions,
      mapsi: [],
    };
  }
  const matched = mapsiQuestions.filter((q) => idSet.has(q.id));
  return {
    tajwid: [],
    mapsi: matched.length > 0 ? matched : mapsiQuestions,
  };
}
