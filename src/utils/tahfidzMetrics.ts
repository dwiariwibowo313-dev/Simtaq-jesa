import {
  MemorizationRecord,
  MurajaahRecord,
  QuranSurah,
  Student,
  TahfidzTarget,
  TeacherAssignment,
} from '../types/simtaq';

export function expandUniqueAyahKeys(
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number
): string[] {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return [];
  }
  const start = Math.max(1, Math.min(ayahStart, ayahEnd));
  const end = Math.max(start, Math.max(ayahStart, ayahEnd));
  const keys: string[] = [];
  for (let ayah = start; ayah <= end; ayah++) {
    keys.push(`${surahNumber}:${ayah}`);
  }
  return keys;
}

export interface SurahProgressDetail {
  surah_number: number;
  surah_name: string;
  total_ayahs: number;
  passed_unique_ayahs: number;
  is_completed: boolean;
}

export interface StudentHafalanSummary {
  student_id: string;
  total_passed_unique_ayahs: number;
  total_completed_surahs: number;
  active_surah_name: string | null;
  last_submission_range: string | null;
  last_submission_status: MemorizationRecord['status'] | null;
  target_ayah_count: number;
  target_realized_ayahs: number;
  target_percentage: number;
  target_period_label: string | null;
  surah_breakdown: SurahProgressDetail[];
  pending_count: number;
  needs_revision_count: number;
  murajaah_count: number;
}

export function calculateStudentHafalanSummary(
  studentId: string,
  memorizationRecords: MemorizationRecord[],
  murajaahRecords: MurajaahRecord[],
  targets: TahfidzTarget[],
  surahs: QuranSurah[],
  studentClassId?: string,
  studentHalaqahId?: string
): StudentHafalanSummary {
  const studentSetoran = memorizationRecords
    .filter((r) => r.student_id === studentId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updated_at.localeCompare(a.updated_at));

  const studentMurajaah = murajaahRecords.filter((r) => r.student_id === studentId);

  // ONLY records approved as 'lulus' count toward official passed unique ayahs
  const passedRecords = studentSetoran.filter((r) => r.status === 'lulus');

  const uniqueKeys = new Set<string>();
  const surahAyahMap = new Map<number, Set<number>>();

  for (const rec of passedRecords) {
    const keys =
      rec.unique_ayah_keys && rec.unique_ayah_keys.length > 0
        ? rec.unique_ayah_keys
        : expandUniqueAyahKeys(rec.surah_number, rec.ayah_start, rec.ayah_end);

    for (const k of keys) {
      uniqueKeys.add(k);
      const [sStr, aStr] = k.split(':');
      const sNum = Number(sStr);
      const aNum = Number(aStr);
      if (Number.isFinite(sNum) && Number.isFinite(aNum)) {
        if (!surahAyahMap.has(sNum)) {
          surahAyahMap.set(sNum, new Set<number>());
        }
        surahAyahMap.get(sNum)!.add(aNum);
      }
    }
  }

  const surahLookup = new Map(surahs.map((s) => [s.surah_number, s]));
  const surahBreakdown: SurahProgressDetail[] = [];

  for (const [surahNum, ayahSet] of surahAyahMap.entries()) {
    const meta = surahLookup.get(surahNum);
    const totalAyahs = meta?.ayah_count ?? ayahSet.size;
    surahBreakdown.push({
      surah_number: surahNum,
      surah_name: meta?.name_latin ?? `Surah ${surahNum}`,
      total_ayahs: totalAyahs,
      passed_unique_ayahs: ayahSet.size,
      is_completed: meta ? ayahSet.size >= meta.ayah_count : false,
    });
  }

  surahBreakdown.sort((a, b) => a.surah_number - b.surah_number);

  const completedSurahs = surahBreakdown.filter((s) => s.is_completed).length;
  const latestSetoran = studentSetoran[0] ?? null;

  // Match active target (student scope first, then halaqah, then class)
  const matchingTarget =
    targets.find((t) => t.scope === 'student' && t.target_ref_id === studentId) ??
    targets.find((t) => studentHalaqahId && t.scope === 'halaqah' && t.target_ref_id === studentHalaqahId) ??
    targets.find((t) => studentClassId && t.scope === 'class' && t.target_ref_id === studentClassId) ??
    null;

  const targetAyahCount = matchingTarget?.target_ayah_count ?? 0;
  let targetRealizedAyahs = 0;
  if (matchingTarget) {
    // Count unique passed ayahs within target period and/or overall target surah scope
    const targetPeriodKeys = new Set<string>();
    for (const rec of passedRecords) {
      if (rec.date >= matchingTarget.start_date && rec.date <= matchingTarget.end_date) {
        const keys =
          rec.unique_ayah_keys && rec.unique_ayah_keys.length > 0
            ? rec.unique_ayah_keys
            : expandUniqueAyahKeys(rec.surah_number, rec.ayah_start, rec.ayah_end);
        for (const k of keys) targetPeriodKeys.add(k);
      }
    }
    targetRealizedAyahs = targetPeriodKeys.size;
  }

  const targetPercentage =
    targetAyahCount > 0 ? Math.min(100, Math.round((targetRealizedAyahs / targetAyahCount) * 100)) : 0;

  return {
    student_id: studentId,
    total_passed_unique_ayahs: uniqueKeys.size,
    total_completed_surahs: completedSurahs,
    active_surah_name: latestSetoran?.surah_name ?? null,
    last_submission_range: latestSetoran
      ? `${latestSetoran.surah_name} (${latestSetoran.ayah_start}–${latestSetoran.ayah_end})`
      : null,
    last_submission_status: latestSetoran?.status ?? null,
    target_ayah_count: targetAyahCount,
    target_realized_ayahs: targetRealizedAyahs,
    target_percentage: targetPercentage,
    target_period_label: matchingTarget?.period_label ?? null,
    surah_breakdown: surahBreakdown,
    pending_count: studentSetoran.filter((r) => r.status === 'menunggu_penilaian').length,
    needs_revision_count: studentSetoran.filter((r) => r.status === 'perlu_perbaikan').length,
    murajaah_count: studentMurajaah.length,
  };
}

export interface TeacherFilterOptions {
  classId?: string;
  halaqahId?: string;
  studentId?: string;
  surahNumber?: number;
  status?: MemorizationRecord['status'] | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface StudentMonitoringRow {
  student: Student;
  summary: StudentHafalanSummary;
  needs_guidance: boolean;
}

export interface WeeklyChartBucket {
  label: string;
  passed_ayahs: number;
  submissions_count: number;
}

export interface TeacherMonitoringSummary {
  assigned_students_count: number;
  students_submitted_count: number;
  students_not_submitted_count: number;
  total_passed_unique_ayahs: number;
  total_completed_surahs: number;
  target_achieved_percentage: number;
  pending_assessment_count: number;
  needs_revision_count: number;
  student_rows: StudentMonitoringRow[];
  filtered_records: MemorizationRecord[];
  weekly_buckets: WeeklyChartBucket[];
}

export function getScopedStudentsForTeacher(
  assignment: TeacherAssignment | null,
  allStudents: Student[]
): Student[] {
  if (!assignment) return [];
  return allStudents.filter(
    (s) =>
      assignment.student_ids.includes(s.id) ||
      assignment.class_ids.includes(s.class_id) ||
      assignment.halaqah_ids.includes(s.halaqah_id)
  );
}

export function calculateTeacherMonitoringSummary(
  assignment: TeacherAssignment | null,
  allStudents: Student[],
  allMemorization: MemorizationRecord[],
  allMurajaah: MurajaahRecord[],
  targets: TahfidzTarget[],
  surahs: QuranSurah[],
  filters: TeacherFilterOptions = {}
): TeacherMonitoringSummary {
  const scopedStudents = getScopedStudentsForTeacher(assignment, allStudents).filter((s) => {
    if (filters.classId && filters.classId !== 'all' && s.class_id !== filters.classId) return false;
    if (filters.halaqahId && filters.halaqahId !== 'all' && s.halaqah_id !== filters.halaqahId) return false;
    if (filters.studentId && filters.studentId !== 'all' && s.id !== filters.studentId) return false;
    return true;
  });

  const scopedStudentIds = new Set(scopedStudents.map((s) => s.id));

  const filteredRecords = allMemorization
    .filter((r) => {
      if (!scopedStudentIds.has(r.student_id)) return false;
      if (filters.surahNumber && r.surah_number !== filters.surahNumber) return false;
      if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false;
      if (filters.dateFrom && r.date < filters.dateFrom) return false;
      if (filters.dateTo && r.date > filters.dateTo) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const studentRows: StudentMonitoringRow[] = scopedStudents.map((student) => {
    const summary = calculateStudentHafalanSummary(
      student.id,
      filteredRecords,
      allMurajaah,
      targets,
      surahs,
      student.class_id,
      student.halaqah_id
    );
    const needsGuidance =
      summary.needs_revision_count > 0 ||
      (summary.target_ayah_count > 0 && summary.target_percentage < 50 && summary.pending_count === 0);
    return { student, summary, needs_guidance: needsGuidance };
  });

  const submittedStudentIds = new Set(filteredRecords.map((r) => r.student_id));
  const totalPassedUniqueAyahs = studentRows.reduce((acc, row) => acc + row.summary.total_passed_unique_ayahs, 0);
  const totalCompletedSurahs = studentRows.reduce((acc, row) => acc + row.summary.total_completed_surahs, 0);

  const studentsWithTargets = studentRows.filter((r) => r.summary.target_ayah_count > 0);
  const achievedTargetCount = studentsWithTargets.filter((r) => r.summary.target_percentage >= 100).length;
  const targetAchievedPercentage =
    studentsWithTargets.length > 0 ? Math.round((achievedTargetCount / studentsWithTargets.length) * 100) : 0;

  // Group records by date for factual chart buckets (sorted ascending, max 6 recent dates)
  const dateMap = new Map<string, { passedKeys: Set<string>; count: number }>();
  for (const rec of filteredRecords) {
    if (!dateMap.has(rec.date)) {
      dateMap.set(rec.date, { passedKeys: new Set<string>(), count: 0 });
    }
    const bucket = dateMap.get(rec.date)!;
    bucket.count += 1;
    if (rec.status === 'lulus') {
      const keys =
        rec.unique_ayah_keys.length > 0
          ? rec.unique_ayah_keys
          : expandUniqueAyahKeys(rec.surah_number, rec.ayah_start, rec.ayah_end);
      for (const k of keys) bucket.passedKeys.add(`${rec.student_id}:${k}`);
    }
  }

  const weeklyBuckets: WeeklyChartBucket[] = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([date, val]) => ({
      label: date,
      passed_ayahs: val.passedKeys.size,
      submissions_count: val.count,
    }));

  return {
    assigned_students_count: scopedStudents.length,
    students_submitted_count: submittedStudentIds.size,
    students_not_submitted_count: Math.max(0, scopedStudents.length - submittedStudentIds.size),
    total_passed_unique_ayahs: totalPassedUniqueAyahs,
    total_completed_surahs: totalCompletedSurahs,
    target_achieved_percentage: targetAchievedPercentage,
    pending_assessment_count: filteredRecords.filter((r) => r.status === 'menunggu_penilaian').length,
    needs_revision_count: filteredRecords.filter((r) => r.status === 'perlu_perbaikan').length,
    student_rows: studentRows,
    filtered_records: filteredRecords,
    weekly_buckets: weeklyBuckets,
  };
}
