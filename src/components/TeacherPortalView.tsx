import React, { useMemo, useState } from 'react';
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementPriority,
  AssessmentStatus,
  ClassRoom,
  Guardian,
  Halaqah,
  MapsiQuestion,
  MemorizationRecord,
  MurajaahRecord,
  QualityGrade,
  QuestionPackage,
  QuizResult,
  QuranSurah,
  SCHOOL_ID,
  Student,
  TahfidzTarget,
  TajwidExample,
  TajwidQuestion,
  TajwidTopic,
  TeacherAssignment,
  WhatsAppShareStatus,
} from '../types/simtaq';
import {
  calculateTeacherMonitoringSummary,
  expandUniqueAyahKeys,
} from '../utils/tahfidzMetrics';
import { clampAyahRangeForSurah, findSurahByNumber, getSurahsByJuz } from '../data/surahCatalog';
import { SurahSelector } from './SurahSelector';
import {
  buildWhatsAppClickToChatUrl,
  buildWhatsAppReportText,
  normalizeIndonesianWhatsApp,
} from '../utils/whatsappReport';
import {
  Award,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Lock,
  Megaphone,
  MessageSquare,
  Phone,
  PlusCircle,
  Target,
  UserCheck,
} from 'lucide-react';

interface TeacherPortalViewProps {
  teacherAssignment: TeacherAssignment | null;
  classes: ClassRoom[];
  halaqahs: Halaqah[];
  students: Student[];
  guardians: Guardian[];
  surahs: QuranSurah[];
  targets: TahfidzTarget[];
  memorizationRecords: MemorizationRecord[];
  murajaahRecords: MurajaahRecord[];
  tajwidTopics: TajwidTopic[];
  tajwidExamples: TajwidExample[];
  tajwidQuestions: TajwidQuestion[];
  mapsiQuestions: MapsiQuestion[];
  questionPackages: QuestionPackage[];
  quizResults: QuizResult[];
  onSaveMemorization: (record: MemorizationRecord) => Promise<void>;
  onSaveMurajaah: (record: MurajaahRecord) => Promise<void>;
  onUpdateGuardianContact: (guardian: Guardian) => Promise<void>;
  onUpdateShareStatus: (
    type: 'memorization' | 'murajaah',
    recordId: string,
    status: WhatsAppShareStatus
  ) => Promise<void>;
  onSaveTarget: (target: TahfidzTarget) => Promise<void>;
  onCreateAnnouncement: (ann: Announcement) => Promise<void>;
  onVerifyCurriculumItem: (
    kind: 'tajwid_topic' | 'tajwid_example' | 'tajwid_question' | 'mapsi_question',
    id: string
  ) => Promise<void>;
  onSaveQuestionPackage: (pkg: QuestionPackage) => Promise<void>;
}

const QUALITY_OPTIONS: (QualityGrade | '')[] = [
  '',
  'Mumtaz (Sangat Baik)',
  'Jayyid Jiddan (Baik Sekali)',
  'Jayyid (Baik)',
  'Perlu Bimbingan',
];

type TeacherSubTab = 'monitoring' | 'pendampingan' | 'kurikulum';

export const TeacherPortalView: React.FC<TeacherPortalViewProps> = ({
  teacherAssignment,
  classes,
  halaqahs,
  students,
  guardians,
  surahs,
  targets,
  memorizationRecords,
  murajaahRecords,
  tajwidTopics,
  tajwidExamples,
  tajwidQuestions,
  mapsiQuestions,
  questionPackages,
  quizResults,
  onSaveMemorization,
  onSaveMurajaah,
  onUpdateGuardianContact,
  onUpdateShareStatus,
  onSaveTarget,
  onCreateAnnouncement,
  onVerifyCurriculumItem,
  onSaveQuestionPackage,
}) => {
  const [subTab, setSubTab] = useState<TeacherSubTab>('monitoring');

  // Monitoring filters (Addendum 30 + Surah filter)
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterHalaqah, setFilterHalaqah] = useState<string>('all');
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [filterSurah, setFilterSurah] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState<AssessmentStatus | 'all'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Detail Student Drawer/Modal
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  // Form states for input/edit Setoran / Murajaah
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formType, setFormType] = useState<'Hafalan Baru' | 'Murajaah'>('Hafalan Baru');
  const [formStudentId, setFormStudentId] = useState<string>(students[0]?.id ?? '');
  const [formSurahNum, setFormSurahNum] = useState<number>(112);
  const [formAyahStart, setFormAyahStart] = useState<number>(1);
  const [formAyahEnd, setFormAyahEnd] = useState<number>(4);
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formKelancaran, setFormKelancaran] = useState<QualityGrade | ''>('Mumtaz (Sangat Baik)');
  const [formKetepatan, setFormKetepatan] = useState<QualityGrade | ''>('Jayyid Jiddan (Baik Sekali)');
  const [formTajwid, setFormTajwid] = useState<QualityGrade | ''>('Jayyid Jiddan (Baik Sekali)');
  const [formMakhraj, setFormMakhraj] = useState<QualityGrade | ''>('Jayyid (Baik)');
  const [formStatus, setFormStatus] = useState<AssessmentStatus>('lulus');
  const [formNote, setFormNote] = useState<string>('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // WhatsApp Preview Modal State (Addendum 31)
  const [waPreviewRecord, setWaPreviewRecord] = useState<{
    type: 'memorization' | 'murajaah';
    record: MemorizationRecord | MurajaahRecord;
    student: Student;
  } | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Guardian Contact Editor State
  const [editingGuardianId, setEditingGuardianId] = useState<string>('');
  const [editGuardianPhone, setEditGuardianPhone] = useState<string>('');
  const [editGuardianConsent, setEditGuardianConsent] = useState<boolean>(true);
  const [guardianSaveMsg, setGuardianSaveMsg] = useState<string | null>(null);

  // Teacher Target Form
  const [tgtScope, setTgtScope] = useState<TahfidzTarget['scope']>('class');
  const [tgtRefId, setTgtRefId] = useState<string>(
    teacherAssignment?.class_ids[0] ?? classes[0]?.id ?? ''
  );
  const [tgtLabel, setTgtLabel] = useState('Target Pekanan Hafalan');
  const [tgtStart, setTgtStart] = useState(new Date().toISOString().slice(0, 10));
  const [tgtEnd, setTgtEnd] = useState('2027-06-30');
  const [tgtSurahNum, setTgtSurahNum] = useState(112);
  const [tgtAyahCount, setTgtAyahCount] = useState(15);
  const [tgtMsg, setTgtMsg] = useState<string | null>(null);

  // Teacher Announcement Form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annAudience, setAnnAudience] = useState<AnnouncementAudience>('class');
  const [annRefId, setAnnRefId] = useState(
    teacherAssignment?.class_ids[0] ?? classes[0]?.id ?? ''
  );
  const [annPriority, setAnnPriority] = useState<AnnouncementPriority>('Normal');
  const [annCat, setAnnCat] = useState<AnnouncementCategory>('Pengingat target hafalan');
  const [annMsg, setAnnMsg] = useState<string | null>(null);

  // QuestionPackage Authoring Form
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgModule, setPkgModule] = useState<'tajwid' | 'mapsi'>('mapsi');
  const [pkgDifficulty, setPkgDifficulty] = useState('Simulasi MAPSi');
  const [pkgDurationMin, setPkgDurationMin] = useState(10);
  const [pkgReplayLimit, setPkgReplayLimit] = useState(2);
  const [pkgSelectedIds, setPkgSelectedIds] = useState<string[]>([]);
  const [pkgMsg, setPkgMsg] = useState<string | null>(null);

  const monitoring = useMemo(
    () =>
      calculateTeacherMonitoringSummary(
        teacherAssignment,
        students,
        memorizationRecords,
        murajaahRecords,
        targets,
        surahs,
        {
          classId: filterClass,
          halaqahId: filterHalaqah,
          studentId: filterStudent,
          surahNumber: filterSurah > 0 ? filterSurah : undefined,
          status: filterStatus,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
        }
      ),
    [
      teacherAssignment,
      students,
      memorizationRecords,
      murajaahRecords,
      targets,
      surahs,
      filterClass,
      filterHalaqah,
      filterStudent,
      filterSurah,
      filterStatus,
      filterDateFrom,
      filterDateTo,
    ]
  );

  const scopedStudents = useMemo(
    () => monitoring.student_rows.map((r) => r.student),
    [monitoring.student_rows]
  );

  const scopedMurajaah = useMemo(() => {
    const ids = new Set(scopedStudents.map((s) => s.id));
    return murajaahRecords
      .filter((r) => ids.has(r.student_id))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [murajaahRecords, scopedStudents]);

  const surahAggregateRows = useMemo(() => {
    const map = new Map<number, { name: string; lulusCount: number; pendingCount: number }>();
    for (const rec of monitoring.filtered_records) {
      if (!map.has(rec.surah_number)) {
        map.set(rec.surah_number, { name: rec.surah_name, lulusCount: 0, pendingCount: 0 });
      }
      const entry = map.get(rec.surah_number)!;
      if (rec.status === 'lulus') entry.lulusCount += 1;
      else entry.pendingCount += 1;
    }
    return Array.from(map.entries())
      .map(([num, val]) => ({ surah_number: num, ...val }))
      .sort((a, b) => a.surah_number - b.surah_number);
  }, [monitoring.filtered_records]);

  const pendingCurriculumCount = useMemo(
    () =>
      tajwidTopics.filter((t) => t.verification_status === 'pending_review').length +
      tajwidExamples.filter((e) => e.verification_status === 'pending_review').length +
      tajwidQuestions.filter((q) => q.verification_status === 'pending_review').length +
      mapsiQuestions.filter((q) => q.verification_status === 'pending_review').length,
    [tajwidTopics, tajwidExamples, tajwidQuestions, mapsiQuestions]
  );

  const startEditMemorization = (rec: MemorizationRecord) => {
    if (rec.status === 'lulus') return;
    setEditingRecordId(rec.id);
    setFormType('Hafalan Baru');
    setFormStudentId(rec.student_id);
    setFormSurahNum(rec.surah_number);
    setFormAyahStart(rec.ayah_start);
    setFormAyahEnd(rec.ayah_end);
    setFormDate(rec.date);
    setFormKelancaran(rec.kelancaran ?? '');
    setFormKetepatan(rec.ketepatan_bacaan ?? '');
    setFormTajwid(rec.tajwid ?? '');
    setFormMakhraj(rec.makhraj ?? '');
    setFormStatus(rec.status);
    setFormNote(rec.teacher_note ?? '');
    setFormFeedback(`Menilai ulang setoran ${rec.surah_name} (${rec.ayah_start}–${rec.ayah_end}).`);
  };

  const resetRecordForm = () => {
    setEditingRecordId(null);
    setFormNote('');
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = scopedStudents.find((s) => s.id === formStudentId) ?? scopedStudents[0];
    const surah = surahs.find((s) => s.surah_number === formSurahNum);
    if (!student || !surah || !teacherAssignment) return;

    const nowIso = new Date().toISOString();
    const boundedStart = Math.max(1, Math.min(formAyahStart, surah.ayah_count));
    const boundedEnd = Math.max(boundedStart, Math.min(formAyahEnd, surah.ayah_count));

    if (formType === 'Hafalan Baru') {
      const existing = editingRecordId
        ? memorizationRecords.find((r) => r.id === editingRecordId)
        : undefined;
      if (existing && existing.status === 'lulus') {
        setFormFeedback('Setoran yang sudah Lulus terkunci dan tidak dapat diubah nilainya.');
        return;
      }

      const rec: MemorizationRecord = existing
        ? {
            ...existing,
            kelancaran: formKelancaran || undefined,
            ketepatan_bacaan: formKetepatan || undefined,
            tajwid: formTajwid || undefined,
            makhraj: formMakhraj || undefined,
            status: formStatus,
            teacher_note: formNote.trim() || undefined,
            audit_trail: [
              ...existing.audit_trail,
              {
                action: existing.status !== formStatus ? 'status_changed' : 'updated',
                by_name: teacherAssignment.teacher_name,
                at: nowIso,
                note: `Pembaruan penilaian menjadi ${formStatus}`,
              },
            ],
            updated_at: nowIso,
          }
        : {
            id: `mem-${Date.now()}`,
            school_id: SCHOOL_ID,
            student_id: student.id,
            teacher_uid: teacherAssignment.teacher_uid,
            teacher_name: teacherAssignment.teacher_name,
            class_id: student.class_id,
            halaqah_id: student.halaqah_id,
            date: formDate,
            surah_number: surah.surah_number,
            surah_name: surah.name_latin,
            ayah_start: boundedStart,
            ayah_end: boundedEnd,
            unique_ayah_keys: expandUniqueAyahKeys(surah.surah_number, boundedStart, boundedEnd),
            kelancaran: formKelancaran || undefined,
            ketepatan_bacaan: formKetepatan || undefined,
            tajwid: formTajwid || undefined,
            makhraj: formMakhraj || undefined,
            status: formStatus,
            teacher_note: formNote.trim() || undefined,
            audit_trail: [
              {
                action: 'created',
                by_name: teacherAssignment.teacher_name,
                at: nowIso,
                note: `Status awal: ${formStatus}`,
              },
            ],
            whatsapp_share_status: 'belum_dibagikan',
            updated_at: nowIso,
          };
      await onSaveMemorization(rec);
      setWaPreviewRecord({ type: 'memorization', record: rec, student });
    } else {
      const mrj: MurajaahRecord = {
        id: `mrj-${Date.now()}`,
        school_id: SCHOOL_ID,
        student_id: student.id,
        teacher_uid: teacherAssignment.teacher_uid,
        teacher_name: teacherAssignment.teacher_name,
        class_id: student.class_id,
        halaqah_id: student.halaqah_id,
        date: formDate,
        surah_number: surah.surah_number,
        surah_name: surah.name_latin,
        ayah_start: boundedStart,
        ayah_end: boundedEnd,
        kelancaran: formKelancaran || undefined,
        ketepatan_bacaan: formKetepatan || undefined,
        tajwid: formTajwid || undefined,
        makhraj: formMakhraj || undefined,
        status: formStatus,
        teacher_note: formNote.trim() || undefined,
        whatsapp_share_status: 'belum_dibagikan',
        updated_at: nowIso,
      };
      await onSaveMurajaah(mrj);
      setWaPreviewRecord({ type: 'murajaah', record: mrj, student });
    }

    setFormFeedback(`Setoran ${formType} untuk ${student.full_name} berhasil disimpan.`);
    resetRecordForm();
  };

  const handleSaveGuardianPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardianSaveMsg(null);
    const guardian = guardians.find((g) => g.id === editingGuardianId);
    if (!guardian) return;

    const norm = normalizeIndonesianWhatsApp(editGuardianPhone);
    if (!norm.valid) {
      setGuardianSaveMsg(norm.error ?? 'Nomor WhatsApp tidak valid.');
      return;
    }

    const updated: Guardian = {
      ...guardian,
      whatsapp_raw: editGuardianPhone.trim(),
      whatsapp_e164: norm.e164,
      communication_consent: editGuardianConsent,
      consent_updated_at: new Date().toISOString(),
      contact_history: [
        ...guardian.contact_history,
        {
          previous_e164: guardian.whatsapp_e164,
          new_e164: norm.e164,
          changed_by: teacherAssignment?.teacher_name ?? 'Guru',
          changed_at: new Date().toISOString(),
          reason: 'Pembaruan kontak wali siswa',
        },
      ],
      updated_at: new Date().toISOString(),
    };
    await onUpdateGuardianContact(updated);
    setGuardianSaveMsg(`Nomor ${guardian.full_name} tersimpan sebagai ${norm.e164}.`);
  };

  const handleTeacherTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgtLabel.trim() || !tgtRefId) return;
    const surahMeta = surahs.find((s) => s.surah_number === tgtSurahNum);
    await onSaveTarget({
      id: `tgt-tch-${Date.now()}`,
      school_id: SCHOOL_ID,
      scope: tgtScope,
      target_ref_id: tgtRefId,
      period_label: tgtLabel.trim(),
      start_date: tgtStart,
      end_date: tgtEnd,
      surah_number: tgtSurahNum,
      ayah_start: 1,
      ayah_end: surahMeta?.ayah_count ?? 1,
      target_ayah_count: Math.max(1, tgtAyahCount),
    });
    setTgtMsg(`Target "${tgtLabel.trim()}" berhasil disimpan.`);
  };

  const handleTeacherAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim() || !teacherAssignment) return;
    const nowIso = new Date().toISOString();
    await onCreateAnnouncement({
      id: `ann-tch-${Date.now()}`,
      school_id: SCHOOL_ID,
      title: annTitle.trim(),
      body: annBody.trim(),
      category: annCat,
      priority: annPriority,
      target_audience: annAudience,
      target_ref_id: annAudience === 'class' || annAudience === 'halaqah' ? annRefId : undefined,
      author_uid: teacherAssignment.teacher_uid,
      author_name: teacherAssignment.teacher_name,
      start_at: nowIso,
      end_at: '2027-12-31T23:59:59Z',
      is_published: true,
      is_archived: false,
      created_at: nowIso,
      updated_at: nowIso,
    });
    setAnnTitle('');
    setAnnBody('');
    setAnnMsg('Pengumuman kelas/halaqah berhasil diterbitkan.');
  };

  const handleCreatePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgTitle.trim()) return;
    const fallbackIds =
      pkgModule === 'tajwid'
        ? tajwidQuestions.slice(0, 4).map((q) => q.id)
        : mapsiQuestions.slice(0, 5).map((q) => q.id);
    const chosenIds = pkgSelectedIds.length > 0 ? pkgSelectedIds : fallbackIds;

    await onSaveQuestionPackage({
      id: `pkg-${Date.now()}`,
      title: pkgTitle.trim(),
      module: pkgModule,
      difficulty: pkgDifficulty,
      question_ids: chosenIds,
      duration_seconds: Math.max(60, pkgDurationMin * 60),
      audio_replay_limit: Math.max(1, pkgReplayLimit),
      status: 'published',
      created_by: teacherAssignment?.teacher_name ?? 'Guru Tahfidz',
      created_at: new Date().toISOString(),
    });
    setPkgTitle('');
    setPkgSelectedIds([]);
    setPkgMsg('Paket kuis baru berhasil diterbitkan untuk siswa.');
  };

  const activeWaPreview = useMemo(() => {
    if (!waPreviewRecord) return null;
    const { student, record, type } = waPreviewRecord;
    const cls = classes.find((c) => c.id === student.class_id)?.name ?? student.class_id;
    const hal = halaqahs.find((h) => h.id === student.halaqah_id)?.name ?? student.halaqah_id;
    const guardian = guardians.find((g) => g.student_ids.includes(student.id)) ?? null;
    const text = buildWhatsAppReportText({
      studentName: student.full_name,
      classOrHalaqah: `${cls} / ${hal}`,
      teacherName: record.teacher_name,
      activityType: type === 'memorization' ? 'Hafalan Baru' : 'Murajaah',
      record,
    });
    const waUrl =
      guardian && guardian.communication_consent
        ? buildWhatsAppClickToChatUrl(guardian.whatsapp_e164, text)
        : null;
    return { guardian, text, waUrl };
  }, [waPreviewRecord, classes, halaqahs, guardians]);

  const detailRow = useMemo(
    () =>
      detailStudentId
        ? monitoring.student_rows.find((r) => r.student.id === detailStudentId) ?? null
        : null,
    [detailStudentId, monitoring.student_rows]
  );

  const maxWeeklyVal = Math.max(1, ...monitoring.weekly_buckets.map((b) => b.passed_ayahs));

  return (
    <div className="space-y-6">
      {/* Sub-tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2.5">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('monitoring')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              subTab === 'monitoring'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-emerald-50'
            }`}
          >
            <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Monitoring &amp; Penilaian Setoran
          </button>
          <button
            type="button"
            onClick={() => setSubTab('pendampingan')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              subTab === 'pendampingan'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-emerald-50'
            }`}
          >
            <Target className="h-3.5 w-3.5" aria-hidden="true" />
            Target, Wali WA &amp; Pengumuman
          </button>
          <button
            type="button"
            onClick={() => setSubTab('kurikulum')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              subTab === 'kurikulum'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-emerald-50'
            }`}
          >
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            Kurikulum Tajwid &amp; Paket MAPSi ({pendingCurriculumCount} perlu cek)
          </button>
        </div>

        <span className="px-2 text-xs font-semibold text-emerald-800 tabular-nums">
          {monitoring.assigned_students_count} Siswa Binaan
        </span>
      </div>

      {subTab === 'monitoring' && (
        <>
          {/* ADDENDUM 30: MONITORING CAPAIAN HAFALAN SISWA */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Monitoring Capaian Hafalan Siswa (Penugasan Guru)
                </h2>
                <p className="text-xs text-slate-500">
                  Hanya menampilkan siswa dalam kelas/halaqah penugasan Anda. Angka dihitung
                  langsung dari data setoran berstatus Lulus.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-800 tabular-nums">
                Target Tercapai: {monitoring.target_achieved_percentage}% siswa
              </span>
            </div>

            {/* Filters (including Surah filter) */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
              <div>
                <label htmlFor="flt-class" className="block text-xs font-semibold text-slate-600">
                  Kelas
                </label>
                <select
                  id="flt-class"
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="all">Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="flt-hal" className="block text-xs font-semibold text-slate-600">
                  Halaqah
                </label>
                <select
                  id="flt-hal"
                  value={filterHalaqah}
                  onChange={(e) => setFilterHalaqah(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="all">Semua Halaqah</option>
                  {halaqahs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="flt-stu" className="block text-xs font-semibold text-slate-600">
                  Siswa
                </label>
                <select
                  id="flt-stu"
                  value={filterStudent}
                  onChange={(e) => setFilterStudent(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="all">Semua Siswa</option>
                  {scopedStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="flt-surah" className="block text-xs font-semibold text-slate-600">
                  Surah
                </label>
                <select
                  id="flt-surah"
                  value={filterSurah}
                  onChange={(e) => setFilterSurah(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value={0}>Semua Surah</option>
                  <optgroup label={`Juz 30 (${getSurahsByJuz(30, surahs).length} Surat)`}>
                    {getSurahsByJuz(30, surahs).map((s) => (
                      <option key={s.surah_number} value={s.surah_number}>
                        {s.surah_number}. {s.name_latin} ({s.ayah_count} ayat)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`Juz 29 (${getSurahsByJuz(29, surahs).length} Surat)`}>
                    {getSurahsByJuz(29, surahs).map((s) => (
                      <option key={s.surah_number} value={s.surah_number}>
                        {s.surah_number}. {s.name_latin} ({s.ayah_count} ayat)
                      </option>
                    ))}
                  </optgroup>
                  {getSurahsByJuz('tambahan', surahs).length > 0 && (
                    <optgroup label="Surat Tambahan (Di Luar Juz 29 & 30)">
                      {getSurahsByJuz('tambahan', surahs).map((s) => (
                        <option key={s.surah_number} value={s.surah_number}>
                          {s.surah_number}. {s.name_latin} ({s.ayah_count} ayat)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="flt-status" className="block text-xs font-semibold text-slate-600">
                  Status
                </label>
                <select
                  id="flt-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as AssessmentStatus | 'all')}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="all">Semua Status</option>
                  <option value="lulus">Lulus</option>
                  <option value="perlu_perbaikan">Perlu Perbaikan</option>
                  <option value="menunggu_penilaian">Menunggu Penilaian</option>
                </select>
              </div>
              <div>
                <label htmlFor="flt-from" className="block text-xs font-semibold text-slate-600">
                  Dari Tanggal
                </label>
                <input
                  id="flt-from"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label htmlFor="flt-to" className="block text-xs font-semibold text-slate-600">
                  Sampai Tanggal
                </label>
                <input
                  id="flt-to"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-xs text-slate-500">Sudah Setoran</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {monitoring.students_submitted_count}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-xs text-slate-500">Belum Setoran</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {monitoring.students_not_submitted_count}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/60 p-3">
                <p className="text-xs text-emerald-900">Ayat Unik Lulus</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-950 tabular-nums">
                  {monitoring.total_passed_unique_ayahs}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/60 p-3">
                <p className="text-xs text-emerald-900">Surah Tuntas</p>
                <p className="mt-1 font-mono text-xl font-bold text-emerald-950 tabular-nums">
                  {monitoring.total_completed_surahs}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3">
                <p className="text-xs text-amber-900">Menunggu Nilai</p>
                <p className="mt-1 font-mono text-xl font-bold text-amber-950 tabular-nums">
                  {monitoring.pending_assessment_count}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3">
                <p className="text-xs text-amber-900">Perlu Perbaikan</p>
                <p className="mt-1 font-mono text-xl font-bold text-amber-950 tabular-nums">
                  {monitoring.needs_revision_count}
                </p>
              </div>
            </div>

            {/* Weekly Chart + Per-Surah + Student Summary */}
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Grafik Ayat Lulus per Tanggal
                </h3>
                {monitoring.weekly_buckets.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-500">
                    Belum ada data setoran pada rentang filter ini.
                  </p>
                ) : (
                  <div className="mt-4 flex items-end gap-3 h-36 pt-4">
                    {monitoring.weekly_buckets.map((b) => {
                      const heightPct = Math.max(
                        8,
                        Math.round((b.passed_ayahs / maxWeeklyVal) * 100)
                      );
                      return (
                        <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-emerald-900 tabular-nums">
                            {b.passed_ayahs}
                          </span>
                          <div className="w-full max-w-10 flex-1 flex items-end">
                            <div
                              className="w-full rounded-t-md bg-emerald-700"
                              style={{ height: `${heightPct}%` }}
                              title={`${b.label}: ${b.passed_ayahs} ayat lulus`}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                            {b.label.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <h3 className="text-sm font-bold text-slate-900">Ringkasan per Surah</h3>
                {surahAggregateRows.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-500">Belum ada setoran per surah.</p>
                ) : (
                  <div className="mt-3 max-h-40 overflow-y-auto divide-y divide-slate-200/70 text-xs">
                    {surahAggregateRows.map((sr) => (
                      <div key={sr.surah_number} className="flex items-center justify-between py-1.5">
                        <span className="font-semibold text-slate-800">
                          {sr.surah_number}. {sr.name}
                        </span>
                        <span className="font-mono text-slate-600 tabular-nums">
                          {sr.lulusCount} lulus · {sr.pendingCount} belum
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Target vs Realisasi &amp; Pendampingan
                </h3>
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-1.5 pr-2 font-semibold">Siswa</th>
                        <th className="py-1.5 pr-2 font-semibold text-right">Lulus</th>
                        <th className="py-1.5 pr-2 font-semibold text-right">Target</th>
                        <th className="py-1.5 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monitoring.student_rows.map((row) => (
                        <tr key={row.student.id}>
                          <td className="py-1.5 pr-2 font-semibold text-slate-900">
                            {row.student.full_name}
                            {row.needs_guidance && (
                              <span className="block text-[10px] font-medium text-amber-800">
                                Perlu Pendampingan
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                            {row.summary.total_passed_unique_ayahs}
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                            {row.summary.target_percentage}%
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => setDetailStudentId(row.student.id)}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-50"
                            >
                              <Eye className="h-3 w-3" />
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Input/Assess Setoran + Riwayat Setoran & Murajaah */}
          <div className="grid gap-6 lg:grid-cols-12">
            <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRecordId ? 'Nilai / Perbarui Setoran' : 'Catat & Sahkan Setoran'}
                  </h3>
                </div>
                {editingRecordId && (
                  <button
                    type="button"
                    onClick={resetRecordForm}
                    className="text-xs font-semibold text-slate-600 underline"
                  >
                    Mode Input Baru
                  </button>
                )}
              </div>

              <form onSubmit={(e) => void handleSaveRecord(e)} className="mt-4 space-y-3">
                {!editingRecordId && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('Hafalan Baru')}
                      className={`rounded-lg border py-2 text-xs font-semibold ${
                        formType === 'Hafalan Baru'
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      Hafalan Baru
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('Murajaah')}
                      className={`rounded-lg border py-2 text-xs font-semibold ${
                        formType === 'Murajaah'
                          ? 'border-emerald-700 bg-emerald-700 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      Murajaah
                    </button>
                  </div>
                )}

                <div>
                  <label htmlFor="rec-student" className="block text-xs font-semibold text-slate-700">
                    Siswa Binaan
                  </label>
                  <select
                    id="rec-student"
                    disabled={Boolean(editingRecordId)}
                    value={formStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                  >
                    {scopedStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <SurahSelector
                  label="Pilih Surat Setoran / Murajaah"
                  surahs={surahs}
                  selectedSurah={formSurahNum}
                  disabled={Boolean(editingRecordId)}
                  allowSupplementary={true}
                  compact={true}
                  maxListHeightClass="max-h-56"
                  testIdPrefix="teacher-record-surah"
                  onSelectSurah={(num) => {
                    setFormSurahNum(num);
                    const sMeta = findSurahByNumber(num, surahs);
                    setFormAyahStart(1);
                    setFormAyahEnd(sMeta?.ayah_count ?? 1);
                  }}
                />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="rec-date" className="block text-xs font-semibold text-slate-700">
                      Tanggal
                    </label>
                    <input
                      id="rec-date"
                      type="date"
                      disabled={Boolean(editingRecordId)}
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="rec-a1" className="block text-xs font-semibold text-slate-700">
                      Ayat Awal
                    </label>
                    <input
                      id="rec-a1"
                      type="number"
                      min={1}
                      max={findSurahByNumber(formSurahNum, surahs)?.ayah_count ?? 56}
                      disabled={Boolean(editingRecordId)}
                      value={formAyahStart}
                      onChange={(e) => {
                        const clamped = clampAyahRangeForSurah(
                          formSurahNum,
                          Number(e.target.value),
                          formAyahEnd,
                          surahs
                        );
                        setFormAyahStart(clamped.ayahStart);
                        setFormAyahEnd(clamped.ayahEnd);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono tabular-nums disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="rec-a2" className="block text-xs font-semibold text-slate-700">
                      Ayat Akhir
                    </label>
                    <input
                      id="rec-a2"
                      type="number"
                      min={formAyahStart}
                      max={findSurahByNumber(formSurahNum, surahs)?.ayah_count ?? 56}
                      disabled={Boolean(editingRecordId)}
                      value={formAyahEnd}
                      onChange={(e) => {
                        const clamped = clampAyahRangeForSurah(
                          formSurahNum,
                          formAyahStart,
                          Number(e.target.value),
                          surahs
                        );
                        setFormAyahEnd(clamped.ayahEnd);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono tabular-nums disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="rec-kel" className="block text-xs font-semibold text-slate-700">
                      Kelancaran
                    </label>
                    <select
                      id="rec-kel"
                      value={formKelancaran}
                      onChange={(e) => setFormKelancaran(e.target.value as QualityGrade | '')}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      {QUALITY_OPTIONS.map((q) => (
                        <option key={q || 'none'} value={q}>
                          {q || 'Belum dinilai'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rec-ket" className="block text-xs font-semibold text-slate-700">
                      Ketepatan Bacaan
                    </label>
                    <select
                      id="rec-ket"
                      value={formKetepatan}
                      onChange={(e) => setFormKetepatan(e.target.value as QualityGrade | '')}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      {QUALITY_OPTIONS.map((q) => (
                        <option key={q || 'none'} value={q}>
                          {q || 'Belum dinilai'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rec-tjw" className="block text-xs font-semibold text-slate-700">
                      Tajwid
                    </label>
                    <select
                      id="rec-tjw"
                      value={formTajwid}
                      onChange={(e) => setFormTajwid(e.target.value as QualityGrade | '')}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      {QUALITY_OPTIONS.map((q) => (
                        <option key={q || 'none'} value={q}>
                          {q || 'Belum dinilai'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rec-mkh" className="block text-xs font-semibold text-slate-700">
                      Makhraj
                    </label>
                    <select
                      id="rec-mkh"
                      value={formMakhraj}
                      onChange={(e) => setFormMakhraj(e.target.value as QualityGrade | '')}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      {QUALITY_OPTIONS.map((q) => (
                        <option key={q || 'none'} value={q}>
                          {q || 'Belum dinilai'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="rec-status" className="block text-xs font-semibold text-slate-700">
                    Status Hasil Penilaian
                  </label>
                  <select
                    id="rec-status"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AssessmentStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <option value="lulus">Lulus (Terkunci Permanen)</option>
                    <option value="perlu_perbaikan">Perlu Perbaikan</option>
                    <option value="menunggu_penilaian">Menunggu Penilaian</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="rec-note" className="block text-xs font-semibold text-slate-700">
                    Catatan / Arahan Guru
                  </label>
                  <textarea
                    id="rec-note"
                    rows={2}
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="Catatan bacaan atau arahan murajaah..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  {editingRecordId
                    ? 'Simpan Pembaruan Nilai & Siapkan Laporan WA'
                    : 'Simpan Penilaian & Siapkan Laporan WA'}
                </button>

                {formFeedback && (
                  <p className="text-xs font-semibold text-emerald-800" role="status">
                    {formFeedback}
                  </p>
                )}
              </form>
            </section>

            {/* Setoran History & Murajaah History */}
            <section className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <MessageSquare className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <h3 className="text-base font-bold text-slate-900">
                    Riwayat Setoran Hafalan &amp; Laporan WhatsApp
                  </h3>
                </div>

                <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {monitoring.filtered_records.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada catatan setoran.</p>
                  ) : (
                    monitoring.filtered_records.map((rec) => {
                      const stu = students.find((s) => s.id === rec.student_id);
                      if (!stu) return null;
                      return (
                        <div
                          key={rec.id}
                          className="flex flex-col gap-2 rounded-xl border border-slate-200/80 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-0.5 text-xs">
                            <p className="text-sm font-bold text-slate-900">
                              {stu.full_name} · {rec.surah_name} ({rec.ayah_start}–{rec.ayah_end})
                            </p>
                            <p className="text-slate-500 tabular-nums">
                              {rec.date} · Status:{' '}
                              <strong className="text-slate-800">
                                {rec.status.replace('_', ' ')}
                              </strong>{' '}
                              · WA:{' '}
                              <strong className="text-emerald-800">
                                {rec.whatsapp_share_status.replace('_', ' ')}
                              </strong>
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {rec.status === 'lulus' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                                <Lock className="h-3 w-3" /> Lulus Terkunci
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditMemorization(rec)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                <Edit3 className="h-3 w-3" />
                                Nilai / Perbarui
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setWaPreviewRecord({ type: 'memorization', record: rec, student: stu })
                              }
                              className="rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 whitespace-nowrap"
                            >
                              Laporan WA
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Riwayat Murajaah Terpisah
                </h3>
                <div className="mt-3 space-y-2 max-h-52 overflow-y-auto pr-1 text-xs">
                  {scopedMurajaah.length === 0 ? (
                    <p className="text-slate-500">Belum ada catatan murajaah.</p>
                  ) : (
                    scopedMurajaah.map((mrj) => {
                      const stu = students.find((s) => s.id === mrj.student_id);
                      if (!stu) return null;
                      return (
                        <div
                          key={mrj.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                        >
                          <div>
                            <p className="font-bold text-slate-900">
                              {stu.full_name} · {mrj.surah_name} ({mrj.ayah_start}–{mrj.ayah_end})
                            </p>
                            <p className="text-slate-500 tabular-nums">
                              {mrj.date} · {mrj.status.replace('_', ' ')} · WA:{' '}
                              {mrj.whatsapp_share_status.replace('_', ' ')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setWaPreviewRecord({ type: 'murajaah', record: mrj, student: stu })
                            }
                            className="rounded-lg border border-emerald-700/30 bg-white px-3 py-1.5 font-semibold text-emerald-900 hover:bg-emerald-50"
                          >
                            Laporan WA
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {subTab === 'pendampingan' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Teacher Tahfidz Target Setting */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Target className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">Atur Target Hafalan Binaan</h3>
            </div>
            <form onSubmit={(e) => void handleTeacherTargetSubmit(e)} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="Lingkup target guru"
                  value={tgtScope}
                  onChange={(e) => {
                    const sc = e.target.value as TahfidzTarget['scope'];
                    setTgtScope(sc);
                    if (sc === 'class') setTgtRefId(classes[0]?.id ?? '');
                    if (sc === 'halaqah') setTgtRefId(halaqahs[0]?.id ?? '');
                    if (sc === 'student') setTgtRefId(scopedStudents[0]?.id ?? '');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <option value="class">Per Kelas</option>
                  <option value="halaqah">Per Halaqah</option>
                  <option value="student">Per Siswa</option>
                </select>
                <select
                  aria-label="Penerima target guru"
                  value={tgtRefId}
                  onChange={(e) => setTgtRefId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  {tgtScope === 'class' &&
                    classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  {tgtScope === 'halaqah' &&
                    halaqahs.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  {tgtScope === 'student' &&
                    scopedStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                </select>
              </div>
              <input
                type="text"
                required
                aria-label="Label periode target"
                value={tgtLabel}
                onChange={(e) => setTgtLabel(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="date"
                  aria-label="Mulai target"
                  value={tgtStart}
                  onChange={(e) => setTgtStart(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="date"
                  aria-label="Akhir target"
                  value={tgtEnd}
                  onChange={(e) => setTgtEnd(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  aria-label="Jumlah ayat target"
                  value={tgtAyahCount}
                  onChange={(e) => setTgtAyahCount(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <SurahSelector
                label="Pilih Surat Target Hafalan"
                surahs={surahs}
                selectedSurah={tgtSurahNum}
                allowSupplementary={false}
                compact={true}
                maxListHeightClass="max-h-52"
                testIdPrefix="teacher-target-surah"
                onSelectSurah={(num) => {
                  setTgtSurahNum(num);
                  const sMeta = findSurahByNumber(num, surahs);
                  if (sMeta && tgtAyahCount <= 0) {
                    setTgtAyahCount(sMeta.ayah_count);
                  }
                }}
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Simpan Target Hafalan
              </button>
              {tgtMsg && <p className="text-xs font-semibold text-emerald-800">{tgtMsg}</p>}
            </form>
          </section>

          {/* Class/Halaqah Announcement Authoring */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Megaphone className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">
                Terbitkan Pengumuman Kelas / Halaqah
              </h3>
            </div>
            {teacherAssignment?.can_announce ? (
              <form onSubmit={(e) => void handleTeacherAnnouncementSubmit(e)} className="space-y-3">
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Judul pengumuman (contoh: Jadwal Tasmi' Jumat)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <textarea
                  rows={3}
                  required
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  placeholder="Isi arahan atau jadwal untuk siswa dan wali..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    aria-label="Target pengumuman guru"
                    value={annAudience}
                    onChange={(e) => {
                      const a = e.target.value as AnnouncementAudience;
                      setAnnAudience(a);
                      if (a === 'class') setAnnRefId(classes[0]?.id ?? '');
                      if (a === 'halaqah') setAnnRefId(halaqahs[0]?.id ?? '');
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="class">Kelas Binaan</option>
                    <option value="halaqah">Halaqah Binaan</option>
                  </select>
                  <select
                    aria-label="Referensi kelas/halaqah pengumuman"
                    value={annRefId}
                    onChange={(e) => setAnnRefId(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                  >
                    {annAudience === 'class'
                      ? classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))
                      : halaqahs.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                  </select>
                  <select
                    aria-label="Prioritas pengumuman guru"
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as AnnouncementPriority)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Penting">Penting</option>
                    <option value="Mendesak">Mendesak</option>
                  </select>
                </div>
                <select
                  aria-label="Kategori pengumuman guru"
                  value={annCat}
                  onChange={(e) => setAnnCat(e.target.value as AnnouncementCategory)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <option value="Pengingat target hafalan">Pengingat target hafalan</option>
                  <option value="Jadwal kegiatan">Jadwal kegiatan</option>
                  <option value="Informasi pembelajaran">Informasi pembelajaran</option>
                  <option value="Motivasi belajar">Motivasi belajar</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Terbitkan ke Siswa &amp; Wali
                </button>
                {annMsg && <p className="text-xs font-semibold text-emerald-800">{annMsg}</p>}
              </form>
            ) : (
              <p className="text-xs text-slate-500">
                Hak menerbitkan pengumuman belum diaktifkan oleh Admin Sekolah.
              </p>
            )}
          </section>

          {/* ADDENDUM 31.1: Guardian WA Management */}
          <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Phone className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">
                Kelola Nomor WhatsApp Wali Siswa (Penugasan)
              </h3>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {guardians
                .filter((g) => g.student_ids.some((sid) => scopedStudents.some((s) => s.id === sid)))
                .map((g) => {
                  const childNames = g.student_ids
                    .map((sid) => students.find((s) => s.id === sid)?.full_name)
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <div
                      key={g.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {g.full_name} ({g.relationship} dari {childNames})
                        </p>
                        <p className="font-mono text-slate-700 tabular-nums">
                          {g.whatsapp_e164} · Izin Komunikasi:{' '}
                          {g.communication_consent ? 'Disetujui' : 'Belum/Tidak'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGuardianId(g.id);
                          setEditGuardianPhone(g.whatsapp_raw || g.whatsapp_e164);
                          setEditGuardianConsent(g.communication_consent);
                          setGuardianSaveMsg(null);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Koreksi Nomor
                      </button>
                    </div>
                  );
                })}
            </div>

            {editingGuardianId && (
              <form
                onSubmit={(e) => void handleSaveGuardianPhone(e)}
                className="mt-4 space-y-3 rounded-xl border border-emerald-800/15 bg-emerald-50/50 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="wa-input" className="block text-xs font-semibold text-slate-700">
                      Nomor WhatsApp Indonesia (contoh: 081234567890)
                    </label>
                    <input
                      id="wa-input"
                      type="text"
                      value={editGuardianPhone}
                      onChange={(e) => setEditGuardianPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={editGuardianConsent}
                        onChange={(e) => setEditGuardianConsent(e.target.checked)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      Wali menyetujui komunikasi laporan hafalan
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Simpan &amp; Normalisasi (+62)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGuardianId('')}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                </div>
                {guardianSaveMsg && (
                  <p className="text-xs font-semibold text-emerald-900">{guardianSaveMsg}</p>
                )}
              </form>
            )}
          </section>
        </div>
      )}

      {subTab === 'kurikulum' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Curriculum Review & Verification */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Verifikasi Kurikulum Tajwid &amp; Bank Soal
            </h3>
            <p className="text-xs text-slate-500">
              Tinjau topik Tajwid, contoh ayat, dan soal MAPSi berstatus <code>pending_review</code>{' '}
              sebelum ditandai terverifikasi.
            </p>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
              {tajwidTopics
                .filter((t) => t.verification_status === 'pending_review')
                .map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-bold text-slate-900">Topik Tajwid: {t.title}</p>
                      <p className="text-slate-500">{t.category_name} · pending_review</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onVerifyCurriculumItem('tajwid_topic', t.id)}
                      className="rounded-md bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-800"
                    >
                      Verifikasi
                    </button>
                  </div>
                ))}
              {tajwidExamples
                .filter((e) => e.verification_status === 'pending_review')
                .map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-bold text-slate-900">
                        Contoh {ex.hukum_tajwid} ({ex.surah_name}:{ex.ayah_number})
                      </p>
                      <p className="text-slate-500">pending_review</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onVerifyCurriculumItem('tajwid_example', ex.id)}
                      className="rounded-md bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-800"
                    >
                      Verifikasi
                    </button>
                  </div>
                ))}
              {tajwidQuestions
                .filter((q) => q.verification_status === 'pending_review')
                .map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-bold text-slate-900">Soal Tajwid: {q.prompt.slice(0, 60)}...</p>
                      <p className="text-slate-500">pending_review</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onVerifyCurriculumItem('tajwid_question', q.id)}
                      className="rounded-md bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-800"
                    >
                      Verifikasi
                    </button>
                  </div>
                ))}
              {mapsiQuestions
                .filter((q) => q.verification_status === 'pending_review')
                .map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-bold text-slate-900">Soal MAPSi: {q.prompt.slice(0, 60)}...</p>
                      <p className="text-slate-500">pending_review</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onVerifyCurriculumItem('mapsi_question', q.id)}
                      className="rounded-md bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-800"
                    >
                      Verifikasi
                    </button>
                  </div>
                ))}
              {pendingCurriculumCount === 0 && (
                <p className="py-3 font-medium text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Seluruh topik Tajwid, contoh ayat, dan soal latihan sudah terverifikasi.
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold text-slate-800">
                Analitik Hasil Kuis Siswa Binaan ({quizResults.length} percobaan)
              </h4>
              <div className="mt-2 space-y-1.5 text-xs text-slate-600">
                {quizResults.slice(0, 4).map((qr) => (
                  <div key={qr.id} className="flex items-center justify-between rounded bg-slate-50 p-2">
                    <span>
                      {students.find((s) => s.id === qr.student_id)?.full_name ?? qr.student_id} ·{' '}
                      {qr.package_title}
                    </span>
                    <span className="font-mono font-bold text-emerald-800 tabular-nums">
                      {qr.accuracy_percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* QuestionPackage Authoring & Publish */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Susun &amp; Terbitkan Paket Kuis Tajwid / MAPSi
            </h3>
            <form onSubmit={(e) => void handleCreatePackageSubmit(e)} className="space-y-3">
              <div>
                <label htmlFor="pkg-title" className="block text-xs font-semibold text-slate-700">
                  Judul Paket Latihan
                </label>
                <input
                  id="pkg-title"
                  type="text"
                  required
                  value={pkgTitle}
                  onChange={(e) => setPkgTitle(e.target.value)}
                  placeholder="Contoh: Uji Coba MAPSi Juz 30 Pekanan"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  aria-label="Modul paket soal"
                  value={pkgModule}
                  onChange={(e) => {
                    setPkgModule(e.target.value as 'tajwid' | 'mapsi');
                    setPkgSelectedIds([]);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                >
                  <option value="mapsi">MAPSi Hifdzil</option>
                  <option value="tajwid">Belajar Tajwid</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={60}
                  aria-label="Durasi menit"
                  value={pkgDurationMin}
                  onChange={(e) => setPkgDurationMin(Number(e.target.value))}
                  placeholder="Menit"
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
                />
                <input
                  type="number"
                  min={1}
                  max={10}
                  aria-label="Batas putar audio"
                  value={pkgReplayLimit}
                  onChange={(e) => setPkgReplayLimit(Number(e.target.value))}
                  placeholder="Batas audio"
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-mono"
                />
              </div>
              <input
                type="text"
                aria-label="Level paket soal"
                value={pkgDifficulty}
                onChange={(e) => setPkgDifficulty(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
              />
              <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1 text-xs">
                {(pkgModule === 'mapsi' ? mapsiQuestions : tajwidQuestions).map((q) => (
                  <label key={q.id} className="flex items-start gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={pkgSelectedIds.includes(q.id)}
                      onChange={(e) =>
                        setPkgSelectedIds((prev) =>
                          e.target.checked ? [...prev, q.id] : prev.filter((x) => x !== q.id)
                        )
                      }
                      className="mt-0.5 accent-emerald-700"
                    />
                    <span className="truncate">{q.prompt}</span>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Terbitkan Paket Soal
              </button>
              {pkgMsg && <p className="text-xs font-semibold text-emerald-800">{pkgMsg}</p>}
            </form>

            <div className="divide-y divide-slate-100 text-xs">
              {questionPackages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-bold text-slate-900">{pkg.title}</p>
                    <p className="text-slate-500 tabular-nums">
                      {pkg.module.toUpperCase()} · {pkg.question_ids.length} soal ·{' '}
                      {Math.round(pkg.duration_seconds / 60)} mnt · Status: {pkg.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void onSaveQuestionPackage({
                        ...pkg,
                        status: pkg.status === 'published' ? 'archived' : 'published',
                      })
                    }
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {pkg.status === 'published' ? 'Arsipkan' : 'Terbitkan'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Student Detail Modal */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stu-detail-title"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 id="stu-detail-title" className="text-lg font-bold text-slate-900">
                  Detail Progres Siswa — {detailRow.student.full_name}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  NIS {detailRow.student.nis_local} · Ayat Lulus:{' '}
                  {detailRow.summary.total_passed_unique_ayahs} · Target:{' '}
                  {detailRow.summary.target_percentage}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailStudentId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {memorizationRecords
                .filter((r) => r.student_id === detailRow.student.id)
                .map((rec) => (
                  <div key={rec.id} className="rounded-xl border border-slate-200 p-3 space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>
                        {rec.surah_name} ({rec.ayah_start}–{rec.ayah_end})
                      </span>
                      <span className="text-emerald-800">{rec.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-slate-600">
                      Kelancaran: {rec.kelancaran ?? '-'} · Ketepatan: {rec.ketepatan_bacaan ?? '-'} ·
                      Tajwid: {rec.tajwid ?? '-'} · Makhraj: {rec.makhraj ?? '-'}
                    </p>
                    {rec.teacher_note && (
                      <p className="text-slate-700">Catatan Guru: {rec.teacher_note}</p>
                    )}
                    {rec.audit_trail.length > 0 && (
                      <p className="font-mono text-[11px] text-slate-400">
                        Riwayat Audit:{' '}
                        {rec.audit_trail.map((a) => `${a.action} (${a.by_name})`).join(' -> ')}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ADDENDUM 31.2–31.4: Pratinjau & Click-to-Chat WhatsApp Modal */}
      {waPreviewRecord && activeWaPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-modal-title"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="wa-modal-title" className="text-lg font-bold text-slate-900">
                  Pratinjau Laporan Setoran WhatsApp
                </h3>
                <p className="text-xs text-slate-500">
                  Penerima:{' '}
                  {activeWaPreview.guardian ? (
                    <strong>
                      {activeWaPreview.guardian.full_name} ({activeWaPreview.guardian.whatsapp_e164})
                    </strong>
                  ) : (
                    <span className="text-amber-700">Kontak wali belum tertaut</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWaPreviewRecord(null)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                Tutup
              </button>
            </div>

            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-sans text-xs leading-relaxed text-slate-800">
              {activeWaPreview.text}
            </pre>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
              Aplikasi menggunakan mekanisme resmi <strong>WhatsApp Click-to-Chat (wa.me)</strong>.
              Guru memeriksa dan menekan tombol kirim secara langsung di WhatsApp. Status “WhatsApp
              dibuka” tidak mengklaim pesan otomatis terkirim.
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {activeWaPreview.waUrl ? (
                <a
                  href={activeWaPreview.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    void onUpdateShareStatus(
                      waPreviewRecord.type,
                      waPreviewRecord.record.id,
                      'whatsapp_dibuka'
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Kirim via WhatsApp
                </a>
              ) : (
                <span className="text-xs font-medium text-amber-800">
                  Tautan wa.me tidak aktif (pastikan nomor wali valid &amp; izin komunikasi disetujui).
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(activeWaPreview.text);
                  setCopiedReport(true);
                  window.setTimeout(() => setCopiedReport(false), 2500);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                {copiedReport ? (
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedReport ? 'Laporan Tersalin' : 'Salin Laporan'}
              </button>

              <button
                type="button"
                onClick={() => {
                  void onUpdateShareStatus(
                    waPreviewRecord.type,
                    waPreviewRecord.record.id,
                    'dikonfirmasi_terkirim'
                  );
                  setWaPreviewRecord(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Tandai Sudah Dikirim Guru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
