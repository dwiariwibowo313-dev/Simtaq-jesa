import React, { useMemo, useState } from 'react';
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementCategory,
  AnnouncementPriority,
  AuditLogEntry,
  ClassRoom,
  Guardian,
  Halaqah,
  MemorizationRecord,
  MurajaahRecord,
  PendingSyncItem,
  QuizResult,
  QuranSurah,
  SCHOOL_ID,
  SchoolSettings,
  Student,
  SUPER_ADMIN_EMAIL,
  SyncHistoryItem,
  TahfidzTarget,
  TeacherAssignment,
  UserAccount,
  UserRole,
} from '../types/simtaq';
import { exportLocalBackup, restoreLocalBackup } from '../db/dexie';
import {
  calculateSchoolAnalytics,
  generateSchoolProgressCsv,
} from '../utils/schoolAnalytics';
import { normalizeIndonesianWhatsApp } from '../utils/whatsappReport';
import { SurahSelector } from './SurahSelector';
import {
  BarChart3,
  BookOpen,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Lock,
  Megaphone,
  Phone,
  RefreshCw,
  Shield,
  Target,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';

interface AdminAndSuperAdminViewProps {
  mode: 'school_admin' | 'super_admin';
  settings: SchoolSettings;
  users: UserAccount[];
  cloudUsers?: UserAccount[];
  classes: ClassRoom[];
  halaqahs: Halaqah[];
  students: Student[];
  guardians: Guardian[];
  assignments: TeacherAssignment[];
  targets: TahfidzTarget[];
  memorizationRecords: MemorizationRecord[];
  murajaahRecords: MurajaahRecord[];
  surahs: QuranSurah[];
  quizResults: QuizResult[];
  announcements: Announcement[];
  pendingSync: PendingSyncItem[];
  syncHistory: SyncHistoryItem[];
  auditLogs: AuditLogEntry[];
  onUpdateSchoolLogo: (dataUrl: string | undefined) => Promise<void>;
  onSaveClass: (cls: ClassRoom) => Promise<void>;
  onSaveHalaqah: (hal: Halaqah) => Promise<void>;
  onSaveStudent: (student: Student, isNew: boolean) => Promise<void>;
  onSaveGuardian: (guardian: Guardian, isNew: boolean) => Promise<void>;
  onSaveTeacherAssignment: (assignment: TeacherAssignment, isNew: boolean) => Promise<void>;
  onSaveTarget: (target: TahfidzTarget, isNew: boolean) => Promise<void>;
  onCreateAnnouncement: (ann: Announcement) => Promise<void>;
  onToggleArchiveAnnouncement: (id: string) => Promise<void>;
  onUpdateSyncSettings: (enabled: boolean, intervalMin: number) => Promise<void>;
  onRunManualSync: () => Promise<void>;
  onRestoreComplete: () => Promise<void>;
  onRefreshCloudUsers?: () => Promise<void>;
  onUpdateUserRole?: (
    targetUid: string,
    role: Exclude<UserRole, 'super_admin'>,
    isActive: boolean,
    linkedEntityId: string
  ) => Promise<void>;
  onSeedCloudSchoolData?: () => Promise<void>;
}

type SchoolSubTab =
  | 'analitik'
  | 'kelas_halaqah'
  | 'siswa_wali'
  | 'guru_target'
  | 'pengumuman';

export const AdminAndSuperAdminView: React.FC<AdminAndSuperAdminViewProps> = ({
  mode,
  settings,
  users,
  cloudUsers = [],
  classes,
  halaqahs,
  students,
  guardians,
  assignments,
  targets,
  memorizationRecords,
  murajaahRecords,
  surahs,
  quizResults,
  announcements,
  pendingSync,
  syncHistory,
  auditLogs,
  onUpdateSchoolLogo,
  onSaveClass,
  onSaveHalaqah,
  onSaveStudent,
  onSaveGuardian,
  onSaveTeacherAssignment,
  onSaveTarget,
  onCreateAnnouncement,
  onToggleArchiveAnnouncement,
  onUpdateSyncSettings,
  onRunManualSync,
  onRestoreComplete,
  onRefreshCloudUsers,
  onUpdateUserRole,
  onSeedCloudSchoolData,
}) => {
  const [superAdminTopTab, setSuperAdminTopTab] = useState<'sekolah' | 'sistem'>('sekolah');
  const [schoolSubTab, setSchoolSubTab] = useState<SchoolSubTab>('analitik');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Class form
  const [editingClassId, setEditingClassId] = useState<string>('');
  const [clsName, setClsName] = useState('');
  const [clsGrade, setClsGrade] = useState<number>(4);
  const [clsYear, setClsYear] = useState('2026/2027');

  // Halaqah form
  const [editingHalId, setEditingHalId] = useState<string>('');
  const [halName, setHalName] = useState('');
  const [halTeacherId, setHalTeacherId] = useState(assignments[0]?.teacher_uid ?? 'tch-1');
  const [halClassIds, setHalClassIds] = useState<string[]>(classes[0] ? [classes[0].id] : []);
  const [halSchedule, setHalSchedule] = useState('Senin, Rabu, Jumat · 07.00–07.45 WIB');

  // Student form
  const [editingStudentId, setEditingStudentId] = useState<string>('');
  const [stuName, setStuName] = useState('');
  const [stuNis, setStuNis] = useState('');
  const [stuClass, setStuClass] = useState(classes[0]?.id ?? 'cls-4a');
  const [stuHal, setStuHal] = useState(halaqahs[0]?.id ?? 'hal-1');
  const [stuStatus, setStuStatus] = useState<Student['status']>('aktif');
  const [stuGuardianIds, setStuGuardianIds] = useState<string[]>([]);

  // Guardian form
  const [editingGuardianId, setEditingGuardianId] = useState<string>('');
  const [grdName, setGrdName] = useState('');
  const [grdRelation, setGrdRelation] = useState<Guardian['relationship']>('Ibu');
  const [grdPhone, setGrdPhone] = useState('');
  const [grdConsent, setGrdConsent] = useState(true);
  const [grdVerified, setGrdVerified] =
    useState<Guardian['verification_status']>('terverifikasi');
  const [grdStudentIds, setGrdStudentIds] = useState<string[]>([]);

  // Teacher Assignment form
  const [editingAssignId, setEditingAssignId] = useState<string>('');
  const [asgTeacherUid, setAsgTeacherUid] = useState('');
  const [asgTeacherName, setAsgTeacherName] = useState('');
  const [asgClassIds, setAsgClassIds] = useState<string[]>([]);
  const [asgHalIds, setAsgHalIds] = useState<string[]>([]);
  const [asgStudentIds, setAsgStudentIds] = useState<string[]>([]);
  const [asgCanAnnounce, setAsgCanAnnounce] = useState(true);
  const [asgCanManageGrd, setAsgCanManageGrd] = useState(true);

  // Target form
  const [editingTargetId, setEditingTargetId] = useState<string>('');
  const [tgtScope, setTgtScope] = useState<TahfidzTarget['scope']>('class');
  const [tgtRefId, setTgtRefId] = useState(classes[0]?.id ?? 'cls-4a');
  const [tgtLabel, setTgtLabel] = useState('Target Semester 2 · Juz Amma');
  const [tgtStart, setTgtStart] = useState('2026-07-01');
  const [tgtEnd, setTgtEnd] = useState('2027-06-30');
  const [tgtSurahNum, setTgtSurahNum] = useState(112);
  const [tgtAyahCount, setTgtAyahCount] = useState(25);

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annCat, setAnnCat] = useState<AnnouncementCategory>('Informasi umum');
  const [annPriority, setAnnPriority] = useState<AnnouncementPriority>('Normal');
  const [annAudience, setAnnAudience] = useState<AnnouncementAudience>('all');
  const [annRefId, setAnnRefId] = useState<string>(classes[0]?.id ?? 'cls-4a');
  const [annEndDate, setAnnEndDate] = useState('2027-12-31');

  // Super Admin backup/sync & RBAC states
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [syncIntervalInput, setSyncIntervalInput] = useState<number>(settings.sync_interval_minutes);
  const [roleDrafts, setRoleDrafts] = useState<
    Record<string, { role: Exclude<UserRole, 'super_admin'>; isActive: boolean; linkedEntityId: string }>
  >({});
  const [rbacMessage, setRbacMessage] = useState<string | null>(null);

  const analytics = useMemo(
    () =>
      calculateSchoolAnalytics(
        classes,
        halaqahs,
        students,
        memorizationRecords,
        murajaahRecords,
        targets,
        surahs,
        quizResults
      ),
    [
      classes,
      halaqahs,
      students,
      memorizationRecords,
      murajaahRecords,
      targets,
      surahs,
      quizResults,
    ]
  );

  const availableTeachers = useMemo(() => {
    const merged = [...cloudUsers, ...users].filter((u) => u.role === 'teacher');
    const seen = new Set<string>();
    return merged.filter((u) => {
      if (seen.has(u.uid)) return false;
      seen.add(u.uid);
      return true;
    });
  }, [cloudUsers, users]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 380 * 1024) {
      setStatusNotice('Ukuran logo maksimal 380 KB agar hemat penyimpanan & lolos validasi cloud.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void onUpdateSchoolLogo(reader.result);
        setStatusNotice('Logo sekolah berhasil diperbarui.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadSchoolCsv = () => {
    const csv = generateSchoolProgressCsv(
      classes,
      halaqahs,
      students,
      memorizationRecords,
      murajaahRecords,
      targets,
      surahs
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-tahfidz-sdn-jetiskarangpung-1-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusNotice('Laporan CSV progres siswa (tanpa data PII nomor/email) berhasil diunduh.');
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clsName.trim()) return;
    const id = editingClassId || `cls-${Date.now()}`;
    await onSaveClass({
      id,
      school_id: SCHOOL_ID,
      name: clsName.trim(),
      grade_level: Math.max(1, Math.min(6, clsGrade)),
      academic_year: clsYear.trim() || '2026/2027',
    });
    setEditingClassId('');
    setClsName('');
    setStatusNotice(`Data kelas ${clsName.trim()} disimpan.`);
  };

  const handleHalaqahSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!halName.trim()) return;
    const id = editingHalId || `hal-${Date.now()}`;
    await onSaveHalaqah({
      id,
      school_id: SCHOOL_ID,
      name: halName.trim(),
      teacher_id: halTeacherId.trim() || 'tch-1',
      class_ids: halClassIds,
      schedule_note: halSchedule.trim(),
    });
    setEditingHalId('');
    setHalName('');
    setStatusNotice(`Data halaqah ${halName.trim()} disimpan.`);
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuName.trim() || !stuNis.trim()) return;
    const isNew = !editingStudentId;
    const id = editingStudentId || `stu-${Date.now()}`;
    await onSaveStudent(
      {
        id,
        school_id: SCHOOL_ID,
        nis_local: stuNis.trim(),
        full_name: stuName.trim(),
        class_id: stuClass,
        halaqah_id: stuHal,
        guardian_ids: stuGuardianIds,
        status: stuStatus,
      },
      isNew
    );
    setEditingStudentId('');
    setStuName('');
    setStuNis('');
    setStuStatus('aktif');
    setStuGuardianIds([]);
    setStatusNotice(`Data siswa ${stuName.trim()} berhasil ${isNew ? 'ditambahkan' : 'diperbarui'}.`);
  };

  const handleGuardianSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grdName.trim()) return;
    const norm = normalizeIndonesianWhatsApp(grdPhone);
    if (!norm.valid) {
      setStatusNotice(norm.error ?? 'Nomor WhatsApp wali tidak valid.');
      return;
    }
    const isNew = !editingGuardianId;
    const prev = editingGuardianId
      ? guardians.find((g) => g.id === editingGuardianId)
      : undefined;
    const nowIso = new Date().toISOString();
    const id = editingGuardianId || `grd-${Date.now()}`;
    const history = prev
      ? [
          ...prev.contact_history,
          ...(prev.whatsapp_e164 !== norm.e164
            ? [
                {
                  previous_e164: prev.whatsapp_e164,
                  new_e164: norm.e164,
                  changed_by: 'Admin Sekolah',
                  changed_at: nowIso,
                  reason: 'Pembaruan master data wali',
                },
              ]
            : []),
        ]
      : [];

    await onSaveGuardian(
      {
        id,
        school_id: SCHOOL_ID,
        full_name: grdName.trim(),
        relationship: grdRelation,
        whatsapp_raw: grdPhone.trim(),
        whatsapp_e164: norm.e164,
        verification_status: grdVerified,
        communication_consent: grdConsent,
        consent_updated_at: nowIso,
        student_ids: grdStudentIds,
        contact_history: history,
        updated_at: nowIso,
      },
      isNew
    );
    setEditingGuardianId('');
    setGrdName('');
    setGrdPhone('');
    setGrdStudentIds([]);
    setStatusNotice(`Data wali ${grdName.trim()} (${norm.e164}) disimpan.`);
  };

  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asgTeacherUid.trim() || !asgTeacherName.trim()) return;
    const isNew = !editingAssignId;
    const id = editingAssignId || `assign-${Date.now()}`;
    await onSaveTeacherAssignment(
      {
        id,
        school_id: SCHOOL_ID,
        teacher_uid: asgTeacherUid.trim(),
        teacher_name: asgTeacherName.trim(),
        class_ids: asgClassIds,
        halaqah_ids: asgHalIds,
        student_ids: asgStudentIds,
        can_announce: asgCanAnnounce,
        can_manage_guardian_contacts: asgCanManageGrd,
      },
      isNew
    );
    setEditingAssignId('');
    setAsgTeacherUid('');
    setAsgTeacherName('');
    setAsgClassIds([]);
    setAsgHalIds([]);
    setAsgStudentIds([]);
    setStatusNotice(`Penugasan guru ${asgTeacherName.trim()} disimpan.`);
  };

  const handleTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgtLabel.trim() || !tgtRefId) return;
    const isNew = !editingTargetId;
    const id = editingTargetId || `tgt-${Date.now()}`;
    const sMeta = surahs.find((s) => s.surah_number === tgtSurahNum);
    await onSaveTarget(
      {
        id,
        school_id: SCHOOL_ID,
        scope: tgtScope,
        target_ref_id: tgtRefId,
        period_label: tgtLabel.trim(),
        start_date: tgtStart,
        end_date: tgtEnd,
        surah_number: tgtSurahNum,
        ayah_start: 1,
        ayah_end: sMeta?.ayah_count ?? 1,
        target_ayah_count: Math.max(1, tgtAyahCount),
      },
      isNew
    );
    setEditingTargetId('');
    setStatusNotice(`Target hafalan "${tgtLabel.trim()}" disimpan.`);
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    const nowIso = new Date().toISOString();
    await onCreateAnnouncement({
      id: `ann-${Date.now()}`,
      school_id: SCHOOL_ID,
      title: annTitle.trim(),
      body: annBody.trim(),
      category: annCat,
      priority: annPriority,
      target_audience: annAudience,
      target_ref_id:
        annAudience === 'class' || annAudience === 'halaqah' ? annRefId : undefined,
      author_uid: 'admin',
      author_name: 'Admin Sekolah SDN Jetiskarangpung 1',
      start_at: nowIso,
      end_at: `${annEndDate}T23:59:59Z`,
      is_published: true,
      is_archived: false,
      created_at: nowIso,
      updated_at: nowIso,
    });
    setAnnTitle('');
    setAnnBody('');
    setStatusNotice('Pengumuman baru berhasil diterbitkan.');
  };

  const handleExportJson = async () => {
    const payload = await exportLocalBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simtaq-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg('File backup JSON lokal berhasil diunduh.');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await restoreLocalBackup(parsed);
      setBackupMsg(res.message);
      if (res.ok) {
        await onRestoreComplete();
      }
    } catch {
      setBackupMsg('Gagal membaca file JSON backup.');
    }
  };

  const renderSchoolManagementWorkspace = () => (
    <div className="space-y-6">
      {/* Sub-navigation for School Management */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-2">
        {(
          [
            ['analitik', 'Analitik & Identitas', <BarChart3 className="h-3.5 w-3.5" key="a" />],
            ['kelas_halaqah', 'Kelas & Halaqah', <BookOpen className="h-3.5 w-3.5" key="b" />],
            ['siswa_wali', 'Siswa & Kontak Wali', <Users className="h-3.5 w-3.5" key="c" />],
            ['guru_target', 'Penugasan Guru & Target', <Target className="h-3.5 w-3.5" key="d" />],
            ['pengumuman', 'Pengumuman Sekolah', <Megaphone className="h-3.5 w-3.5" key="e" />],
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSchoolSubTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              schoolSubTab === id
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-700 hover:bg-emerald-50'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {statusNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
        >
          <span>{statusNotice}</span>
          <button type="button" onClick={() => setStatusNotice(null)} className="underline">
            Tutup
          </button>
        </div>
      )}

      {schoolSubTab === 'analitik' && (
        <div className="space-y-6">
          {/* Logo & Identity */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Identitas, Logo &amp; Analitik SDN Jetiskarangpung 1
                </h2>
                <p className="text-xs text-slate-500">
                  Unggah logo resmi sekolah (maks 380 KB). Laporan progres CSV hanya memuat metrik
                  hafalan siswa tanpa nomor WhatsApp atau email pribadi.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Unggah Logo Sekolah
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoFileChange}
                    className="sr-only"
                  />
                </label>
                {settings.logo_data_url && (
                  <button
                    type="button"
                    onClick={() => void onUpdateSchoolLogo(undefined)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Hapus Logo
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadSchoolCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  Ekspor Laporan CSV (Non-PII)
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs text-slate-500">Siswa Aktif</p>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {analytics.active_students}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/60 p-4">
                <p className="text-xs text-emerald-900">Ayat Unik Lulus</p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-950 tabular-nums">
                  {analytics.total_passed_unique_ayahs}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-800/15 bg-emerald-50/60 p-4">
                <p className="text-xs text-emerald-900">Surah Tuntas</p>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-950 tabular-nums">
                  {analytics.total_completed_surahs}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4">
                <p className="text-xs text-amber-900">Menunggu Nilai</p>
                <p className="mt-1 font-mono text-2xl font-bold text-amber-950 tabular-nums">
                  {analytics.pending_assessment_count}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs text-slate-500">Sesi Murajaah</p>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {analytics.murajaah_count}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs text-slate-500">Rata Kuis Tajwid/MAPSi</p>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {analytics.avg_quiz_accuracy}%
                </p>
              </div>
            </div>
          </section>

          {/* Breakdown Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold text-slate-900">Capaian Hafalan per Kelas</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Kelas</th>
                      <th className="py-2 pr-3 font-semibold text-right">Siswa</th>
                      <th className="py-2 pr-3 font-semibold text-right">Ayat Lulus</th>
                      <th className="py-2 font-semibold text-right">Rata Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.class_breakdown.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.student_count}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.passed_unique_ayahs}</td>
                        <td className="py-2 text-right font-mono font-semibold text-emerald-800 tabular-nums">
                          {row.avg_target_percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold text-slate-900">Capaian Hafalan per Halaqah</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Halaqah</th>
                      <th className="py-2 pr-3 font-semibold text-right">Siswa</th>
                      <th className="py-2 pr-3 font-semibold text-right">Ayat Lulus</th>
                      <th className="py-2 font-semibold text-right">Rata Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.halaqah_breakdown.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.student_count}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums">{row.passed_unique_ayahs}</td>
                        <td className="py-2 text-right font-mono font-semibold text-emerald-800 tabular-nums">
                          {row.avg_target_percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}

      {schoolSubTab === 'kelas_halaqah' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Classes CRUD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Kelola Data Kelas</h3>
            <form onSubmit={(e) => void handleClassSubmit(e)} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="cls-name" className="block text-xs font-semibold text-slate-700">
                    Nama Kelas
                  </label>
                  <input
                    id="cls-name"
                    type="text"
                    required
                    value={clsName}
                    onChange={(e) => setClsName(e.target.value)}
                    placeholder="Contoh: Kelas 4B"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cls-grade" className="block text-xs font-semibold text-slate-700">
                    Tingkat (1–6)
                  </label>
                  <input
                    id="cls-grade"
                    type="number"
                    min={1}
                    max={6}
                    value={clsGrade}
                    onChange={(e) => setClsGrade(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cls-year" className="block text-xs font-semibold text-slate-700">
                  Tahun Ajaran
                </label>
                <input
                  id="cls-year"
                  type="text"
                  value={clsYear}
                  onChange={(e) => setClsYear(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  {editingClassId ? 'Perbarui Kelas' : 'Tambah Kelas'}
                </button>
                {editingClassId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClassId('');
                      setClsName('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="divide-y divide-slate-100 text-xs">
              {classes.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-bold text-slate-900">{c.name}</p>
                    <p className="text-slate-500">
                      Kelas {c.grade_level} · {c.academic_year}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClassId(c.id);
                      setClsName(c.name);
                      setClsGrade(c.grade_level);
                      setClsYear(c.academic_year);
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Halaqah CRUD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Kelola Kelompok Halaqah</h3>
            <form onSubmit={(e) => void handleHalaqahSubmit(e)} className="space-y-3">
              <div>
                <label htmlFor="hal-name" className="block text-xs font-semibold text-slate-700">
                  Nama Halaqah
                </label>
                <input
                  id="hal-name"
                  type="text"
                  required
                  value={halName}
                  onChange={(e) => setHalName(e.target.value)}
                  placeholder="Contoh: Halaqah Umar bin Khattab"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="hal-teacher" className="block text-xs font-semibold text-slate-700">
                  ID / UID Guru Pembimbing
                </label>
                <input
                  id="hal-teacher"
                  type="text"
                  value={halTeacherId}
                  onChange={(e) => setHalTeacherId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-700">Cakupan Kelas</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {classes.map((c) => {
                    const checked = halClassIds.includes(c.id);
                    return (
                      <label key={c.id} className="inline-flex items-center gap-1 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setHalClassIds((prev) =>
                              e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                            )
                          }
                          className="accent-emerald-700"
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="hal-sched" className="block text-xs font-semibold text-slate-700">
                  Jadwal Halaqah
                </label>
                <input
                  id="hal-sched"
                  type="text"
                  value={halSchedule}
                  onChange={(e) => setHalSchedule(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  {editingHalId ? 'Perbarui Halaqah' : 'Tambah Halaqah'}
                </button>
                {editingHalId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHalId('');
                      setHalName('');
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="divide-y divide-slate-100 text-xs">
              {halaqahs.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-bold text-slate-900">{h.name}</p>
                    <p className="text-slate-500">{h.schedule_note}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHalId(h.id);
                      setHalName(h.name);
                      setHalTeacherId(h.teacher_id);
                      setHalClassIds(h.class_ids);
                      setHalSchedule(h.schedule_note);
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {schoolSubTab === 'siswa_wali' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Students CRUD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">Kelola Data Siswa</h3>
            </div>
            <form onSubmit={(e) => void handleStudentSubmit(e)} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="adm-stu-name" className="block text-xs font-semibold text-slate-700">
                    Nama Lengkap Siswa
                  </label>
                  <input
                    id="adm-stu-name"
                    type="text"
                    required
                    value={stuName}
                    onChange={(e) => setStuName(e.target.value)}
                    placeholder="Contoh: Bilal Al-Fatih"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="adm-stu-nis" className="block text-xs font-semibold text-slate-700">
                    NIS Lokal
                  </label>
                  <input
                    id="adm-stu-nis"
                    type="text"
                    required
                    value={stuNis}
                    onChange={(e) => setStuNis(e.target.value)}
                    placeholder="20260409"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label htmlFor="adm-stu-cls" className="block text-xs font-semibold text-slate-700">
                    Kelas
                  </label>
                  <select
                    id="adm-stu-cls"
                    value={stuClass}
                    onChange={(e) => setStuClass(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="adm-stu-hal" className="block text-xs font-semibold text-slate-700">
                    Halaqah
                  </label>
                  <select
                    id="adm-stu-hal"
                    value={stuHal}
                    onChange={(e) => setStuHal(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                  >
                    {halaqahs.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="adm-stu-status" className="block text-xs font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    id="adm-stu-status"
                    value={stuStatus}
                    onChange={(e) => setStuStatus(e.target.value as Student['status'])}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="lulus">Lulus</option>
                    <option value="pindah">Pindah</option>
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-700">Tautan Wali Murid</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {guardians.map((g) => (
                    <label key={g.id} className="inline-flex items-center gap-1 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={stuGuardianIds.includes(g.id)}
                        onChange={(e) =>
                          setStuGuardianIds((prev) =>
                            e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id)
                          )
                        }
                        className="accent-emerald-700"
                      />
                      {g.full_name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  {editingStudentId ? 'Simpan Perubahan Siswa' : 'Tambah Siswa'}
                </button>
                {editingStudentId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStudentId('');
                      setStuName('');
                      setStuNis('');
                      setStuGuardianIds([]);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {s.full_name}{' '}
                      <span className="font-mono text-slate-400">({s.id})</span>
                    </p>
                    <p className="font-mono text-slate-500 tabular-nums">
                      NIS {s.nis_local} · {classes.find((c) => c.id === s.class_id)?.name ?? s.class_id} ·{' '}
                      {s.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStudentId(s.id);
                      setStuName(s.full_name);
                      setStuNis(s.nis_local);
                      setStuClass(s.class_id);
                      setStuHal(s.halaqah_id);
                      setStuStatus(s.status);
                      setStuGuardianIds(s.guardian_ids);
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Guardians CRUD */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Phone className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">Kelola Data Wali &amp; Kontak WhatsApp</h3>
            </div>
            <form onSubmit={(e) => void handleGuardianSubmit(e)} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="grd-name" className="block text-xs font-semibold text-slate-700">
                    Nama Wali
                  </label>
                  <input
                    id="grd-name"
                    type="text"
                    required
                    value={grdName}
                    onChange={(e) => setGrdName(e.target.value)}
                    placeholder="Ibu Rahmawati"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="grd-rel" className="block text-xs font-semibold text-slate-700">
                    Hubungan
                  </label>
                  <select
                    id="grd-rel"
                    value={grdRelation}
                    onChange={(e) => setGrdRelation(e.target.value as Guardian['relationship'])}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Ibu">Ibu</option>
                    <option value="Ayah">Ayah</option>
                    <option value="Wali">Wali</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="grd-wa" className="block text-xs font-semibold text-slate-700">
                    Nomor WhatsApp Indonesia
                  </label>
                  <input
                    id="grd-wa"
                    type="text"
                    required
                    value={grdPhone}
                    onChange={(e) => setGrdPhone(e.target.value)}
                    placeholder="081234567890"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="grd-ver" className="block text-xs font-semibold text-slate-700">
                    Verifikasi Nomor
                  </label>
                  <select
                    id="grd-ver"
                    value={grdVerified}
                    onChange={(e) =>
                      setGrdVerified(e.target.value as Guardian['verification_status'])
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="terverifikasi">Terverifikasi</option>
                    <option value="belum_diverifikasi">Belum Diverifikasi</option>
                  </select>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700">Anak yang Diampu</span>
                <div className="mt-1 flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                  {students.map((s) => (
                    <label key={s.id} className="inline-flex items-center gap-1 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={grdStudentIds.includes(s.id)}
                        onChange={(e) =>
                          setGrdStudentIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                          )
                        }
                        className="accent-emerald-700"
                      />
                      {s.full_name}
                    </label>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={grdConsent}
                  onChange={(e) => setGrdConsent(e.target.checked)}
                  className="accent-emerald-700"
                />
                Wali menyetujui pengiriman laporan via WhatsApp Click-to-Chat
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  {editingGuardianId ? 'Perbarui Data Wali' : 'Tambah Wali'}
                </button>
                {editingGuardianId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGuardianId('');
                      setGrdName('');
                      setGrdPhone('');
                      setGrdStudentIds([]);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
              {guardians.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {g.full_name} ({g.relationship}) ·{' '}
                      <span className="font-mono text-slate-400">{g.id}</span>
                    </p>
                    <p className="font-mono text-slate-500 tabular-nums">
                      {g.whatsapp_e164} · {g.verification_status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGuardianId(g.id);
                      setGrdName(g.full_name);
                      setGrdRelation(g.relationship);
                      setGrdPhone(g.whatsapp_raw || g.whatsapp_e164);
                      setGrdVerified(g.verification_status);
                      setGrdConsent(g.communication_consent);
                      setGrdStudentIds(g.student_ids);
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {schoolSubTab === 'guru_target' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Teacher Assignments */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Penugasan Guru / Muhafidz</h3>
            <form onSubmit={(e) => void handleAssignmentSubmit(e)} className="space-y-3">
              {availableTeachers.length > 0 && (
                <div>
                  <label htmlFor="asg-pick" className="block text-xs font-semibold text-slate-700">
                    Pilih Guru Terdaftar (Opsional)
                  </label>
                  <select
                    id="asg-pick"
                    value=""
                    onChange={(e) => {
                      const u = availableTeachers.find((x) => x.uid === e.target.value);
                      if (u) {
                        setAsgTeacherUid(u.uid);
                        setAsgTeacherName(u.display_name);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Pilih dari daftar pengguna guru --</option>
                    {availableTeachers.map((t) => (
                      <option key={t.uid} value={t.uid}>
                        {t.display_name} ({t.uid})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="asg-uid" className="block text-xs font-semibold text-slate-700">
                    UID Guru
                  </label>
                  <input
                    id="asg-uid"
                    type="text"
                    required
                    value={asgTeacherUid}
                    onChange={(e) => setAsgTeacherUid(e.target.value)}
                    placeholder="UID Firebase guru"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="asg-name" className="block text-xs font-semibold text-slate-700">
                    Nama Guru / Muhafidz
                  </label>
                  <input
                    id="asg-name"
                    type="text"
                    required
                    value={asgTeacherName}
                    onChange={(e) => setAsgTeacherName(e.target.value)}
                    placeholder="Ustadzah Maryam"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700">Kelas Binaan</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {classes.map((c) => (
                    <label key={c.id} className="inline-flex items-center gap-1 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={asgClassIds.includes(c.id)}
                        onChange={(e) =>
                          setAsgClassIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                          )
                        }
                        className="accent-emerald-700"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700">Halaqah Binaan</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {halaqahs.map((h) => (
                    <label key={h.id} className="inline-flex items-center gap-1 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={asgHalIds.includes(h.id)}
                        onChange={(e) =>
                          setAsgHalIds((prev) =>
                            e.target.checked ? [...prev, h.id] : prev.filter((x) => x !== h.id)
                          )
                        }
                        className="accent-emerald-700"
                      />
                      {h.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={asgCanAnnounce}
                    onChange={(e) => setAsgCanAnnounce(e.target.checked)}
                    className="accent-emerald-700"
                  />
                  Boleh Terbitkan Pengumuman Kelas/Halaqah
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={asgCanManageGrd}
                    onChange={(e) => setAsgCanManageGrd(e.target.checked)}
                    className="accent-emerald-700"
                  />
                  Boleh Kelola Kontak WA Wali
                </label>
              </div>

              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                {editingAssignId ? 'Perbarui Penugasan' : 'Simpan Penugasan Guru'}
              </button>
            </form>

            <div className="divide-y divide-slate-100 text-xs">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-bold text-slate-900">{a.teacher_name}</p>
                    <p className="font-mono text-slate-500">
                      UID: {a.teacher_uid} · {a.class_ids.length} kelas · {a.halaqah_ids.length} halaqah
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAssignId(a.id);
                      setAsgTeacherUid(a.teacher_uid);
                      setAsgTeacherName(a.teacher_name);
                      setAsgClassIds(a.class_ids);
                      setAsgHalIds(a.halaqah_ids);
                      setAsgStudentIds(a.student_ids);
                      setAsgCanAnnounce(a.can_announce);
                      setAsgCanManageGrd(a.can_manage_guardian_contacts);
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Tahfidz Targets */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Target Hafalan Sekolah / Kelas / Halaqah</h3>
            <form onSubmit={(e) => void handleTargetSubmit(e)} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="tgt-scope" className="block text-xs font-semibold text-slate-700">
                    Lingkup Target
                  </label>
                  <select
                    id="tgt-scope"
                    value={tgtScope}
                    onChange={(e) => {
                      const sc = e.target.value as TahfidzTarget['scope'];
                      setTgtScope(sc);
                      if (sc === 'class') setTgtRefId(classes[0]?.id ?? '');
                      if (sc === 'halaqah') setTgtRefId(halaqahs[0]?.id ?? '');
                      if (sc === 'student') setTgtRefId(students[0]?.id ?? '');
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="class">Per Kelas</option>
                    <option value="halaqah">Per Halaqah</option>
                    <option value="student">Per Siswa</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="tgt-ref" className="block text-xs font-semibold text-slate-700">
                    Penerima Target
                  </label>
                  <select
                    id="tgt-ref"
                    value={tgtRefId}
                    onChange={(e) => setTgtRefId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
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
                      students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tgt-label" className="block text-xs font-semibold text-slate-700">
                  Label Periode Target
                </label>
                <input
                  id="tgt-label"
                  type="text"
                  required
                  value={tgtLabel}
                  onChange={(e) => setTgtLabel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="tgt-start" className="block text-xs font-semibold text-slate-700">
                    Mulai Tanggal
                  </label>
                  <input
                    id="tgt-start"
                    type="date"
                    value={tgtStart}
                    onChange={(e) => setTgtStart(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="tgt-end" className="block text-xs font-semibold text-slate-700">
                    Sampai Tanggal
                  </label>
                  <input
                    id="tgt-end"
                    type="date"
                    value={tgtEnd}
                    onChange={(e) => setTgtEnd(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <SurahSelector
                label="Surah Fokus Target"
                surahs={surahs}
                selectedSurah={tgtSurahNum}
                allowSupplementary={false}
                compact={true}
                maxListHeightClass="max-h-52"
                testIdPrefix="admin-target-surah"
                onSelectSurah={setTgtSurahNum}
              />

              <div>
                <label htmlFor="tgt-count" className="block text-xs font-semibold text-slate-700">
                  Jumlah Target Ayat Lulus
                </label>
                <input
                  id="tgt-count"
                  type="number"
                  min={1}
                  max={6236}
                  value={tgtAyahCount}
                  onChange={(e) => setTgtAyahCount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                {editingTargetId ? 'Perbarui Target' : 'Simpan Target Hafalan'}
              </button>
            </form>

            <div className="divide-y divide-slate-100 text-xs">
              {targets.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-bold text-slate-900">{t.period_label}</p>
                    <p className="text-slate-500 tabular-nums">
                      Lingkup: {t.scope} ({t.target_ref_id}) · Target {t.target_ayah_count} ayat
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTargetId(t.id);
                      setTgtScope(t.scope);
                      setTgtRefId(t.target_ref_id);
                      setTgtLabel(t.period_label);
                      setTgtStart(t.start_date);
                      setTgtEnd(t.end_date);
                      setTgtSurahNum(t.surah_number);
                      setTgtAyahCount(t.target_ayah_count);
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {schoolSubTab === 'pengumuman' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Megaphone className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">Kelola Pengumuman Sekolah</h3>
          </div>
          <form onSubmit={(e) => void handlePublishAnnouncement(e)} className="space-y-3">
            <div>
              <label htmlFor="ann-title" className="block text-xs font-semibold text-slate-700">
                Judul Pengumuman
              </label>
              <input
                id="ann-title"
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ann-body" className="block text-xs font-semibold text-slate-700">
                Isi Pesan
              </label>
              <textarea
                id="ann-body"
                rows={3}
                required
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <select
                aria-label="Kategori pengumuman"
                value={annCat}
                onChange={(e) => setAnnCat(e.target.value as AnnouncementCategory)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
              >
                <option value="Informasi umum">Informasi umum</option>
                <option value="Pengumuman penting">Pengumuman penting</option>
                <option value="Jadwal kegiatan">Jadwal kegiatan</option>
                <option value="Pengingat target hafalan">Pengingat target</option>
                <option value="Informasi pembelajaran">Informasi pembelajaran</option>
                <option value="Motivasi belajar">Motivasi belajar</option>
              </select>
              <select
                aria-label="Prioritas pengumuman"
                value={annPriority}
                onChange={(e) => setAnnPriority(e.target.value as AnnouncementPriority)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
              >
                <option value="Normal">Normal</option>
                <option value="Penting">Penting</option>
                <option value="Mendesak">Mendesak</option>
              </select>
              <select
                aria-label="Target penerima"
                value={annAudience}
                onChange={(e) => {
                  const aud = e.target.value as AnnouncementAudience;
                  setAnnAudience(aud);
                  if (aud === 'class') setAnnRefId(classes[0]?.id ?? '');
                  if (aud === 'halaqah') setAnnRefId(halaqahs[0]?.id ?? '');
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
              >
                <option value="all">Semua Warga Sekolah</option>
                <option value="student">Semua Siswa</option>
                <option value="teacher">Semua Guru</option>
                <option value="guardian">Semua Wali</option>
                <option value="class">Kelas Tertentu</option>
                <option value="halaqah">Halaqah Tertentu</option>
              </select>
              <input
                aria-label="Tanggal berakhir pengumuman"
                type="date"
                value={annEndDate}
                onChange={(e) => setAnnEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs"
              />
            </div>

            {(annAudience === 'class' || annAudience === 'halaqah') && (
              <div>
                <label htmlFor="ann-ref" className="block text-xs font-semibold text-slate-700">
                  Pilih {annAudience === 'class' ? 'Kelas' : 'Halaqah'} Tujuan
                </label>
                <select
                  id="ann-ref"
                  value={annRefId}
                  onChange={(e) => setAnnRefId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
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
              </div>
            )}

            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Terbitkan Pengumuman
            </button>
          </form>

          <div className="divide-y divide-slate-100 text-xs">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-slate-500">
                    {a.priority} · Target: {a.target_audience}
                    {a.target_ref_id ? ` (${a.target_ref_id})` : ''} ·{' '}
                    {a.is_archived ? 'Diarsipkan' : 'Aktif'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onToggleArchiveAnnouncement(a.id)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {a.is_archived ? 'Aktifkan' : 'Arsipkan'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  if (mode === 'school_admin') {
    return renderSchoolManagementWorkspace();
  }

  // Super Admin View (Dual Top Switcher: School Management + System/RBAC/Sync/Backup)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-800/15 bg-white p-3">
        <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSuperAdminTopTab('sekolah')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              superAdminTopTab === 'sekolah'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manajemen Sekolah &amp; Analitik
          </button>
          <button
            type="button"
            onClick={() => setSuperAdminTopTab('sistem')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              superAdminTopTab === 'sistem'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sistem, RBAC Firestore, Sync &amp; Backup
          </button>
        </div>

        <span className="font-mono text-xs text-slate-500">
          {SCHOOL_ID} · {settings.app_version}
        </span>
      </div>

      {superAdminTopTab === 'sekolah' ? (
        renderSchoolManagementWorkspace()
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-900">
                Konfigurasi Sistem &amp; Keamanan Super Admin
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-500 flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Single School ID (Terkunci)
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900">{SCHOOL_ID}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-500">Email Super Admin Utama</p>
                <p className="mt-1 font-mono text-sm font-bold text-emerald-900">{SUPER_ADMIN_EMAIL}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-500">Versi Aplikasi</p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-900">{settings.app_version}</p>
              </div>
            </div>

            {onSeedCloudSchoolData && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs">
                <div>
                  <p className="font-bold text-emerald-950">Sinkronisasi Master Data Awal ke Firestore</p>
                  <p className="text-slate-600">
                    Kirim data kelas, halaqah, siswa, wali, target, dan pengumuman SDN Jetiskarangpung 1
                    ke cloud Firestore secara aman.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setRbacMessage(null);
                    await onSeedCloudSchoolData();
                    setRbacMessage('Data master awal berhasil disinkronkan ke Firestore.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
                >
                  <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
                  Kirim Data Awal ke Firestore
                </button>
              </div>
            )}
          </section>

          {/* Manajemen Pengguna & Peran RBAC Firestore */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Manajemen Akun &amp; Peran RBAC (Firestore)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aktivasi akun Google terverifikasi menjadi Admin Sekolah, Guru/Muhafidz, Siswa, atau Wali.
                  </p>
                </div>
              </div>
              {onRefreshCloudUsers && (
                <button
                  type="button"
                  onClick={() => void onRefreshCloudUsers()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Muat Pengguna Firestore ({cloudUsers.length})
                </button>
              )}
            </div>

            {rbacMessage && (
              <p role="status" className="text-xs font-semibold text-emerald-800">
                {rbacMessage}
              </p>
            )}

            {cloudUsers.length === 0 ? (
              <p className="text-xs text-slate-500">
                Belum ada daftar pengguna Firestore termuat. Klik &ldquo;Muat Pengguna Firestore&rdquo; setelah
                terhubung online.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {cloudUsers.map((u) => {
                  const isPrimarySuper = u.email === SUPER_ADMIN_EMAIL || u.role === 'super_admin';
                  const draft = roleDrafts[u.uid] ?? {
                    role: (u.role === 'super_admin' ? 'school_admin' : u.role) as Exclude<
                      UserRole,
                      'super_admin'
                    >,
                    isActive: u.is_active,
                    linkedEntityId: u.linked_entity_id ?? '',
                  };
                  return (
                    <div
                      key={u.uid}
                      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {u.display_name}{' '}
                          <span className="font-mono font-normal text-slate-500">({u.email})</span>
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">UID: {u.uid}</p>
                      </div>

                      {isPrimarySuper ? (
                        <span className="font-semibold text-emerald-800">
                          Super Admin Utama (Terkunci Atomic)
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`Peran untuk ${u.email}`}
                            value={draft.role}
                            onChange={(e) =>
                              setRoleDrafts((prev) => ({
                                ...prev,
                                [u.uid]: {
                                  ...draft,
                                  role: e.target.value as Exclude<UserRole, 'super_admin'>,
                                },
                              }))
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                          >
                            <option value="school_admin">Admin Sekolah</option>
                            <option value="teacher">Guru / Muhafidz</option>
                            <option value="student">Siswa</option>
                            <option value="guardian">Wali Murid</option>
                          </select>

                          <input
                            aria-label={`ID Entitas Terhubung untuk ${u.email}`}
                            type="text"
                            value={draft.linkedEntityId}
                            onChange={(e) =>
                              setRoleDrafts((prev) => ({
                                ...prev,
                                [u.uid]: { ...draft, linkedEntityId: e.target.value },
                              }))
                            }
                            placeholder="ID Siswa/Wali/Guru"
                            className="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
                          />

                          <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={draft.isActive}
                              onChange={(e) =>
                                setRoleDrafts((prev) => ({
                                  ...prev,
                                  [u.uid]: { ...draft, isActive: e.target.checked },
                                }))
                              }
                              className="h-4 w-4 accent-emerald-700"
                            />
                            Aktif
                          </label>

                          {onUpdateUserRole && (
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateUserRole(
                                  u.uid,
                                  draft.role,
                                  draft.isActive,
                                  draft.linkedEntityId
                                );
                                setRbacMessage(`Peran ${u.email} diperbarui ke ${draft.role}.`);
                              }}
                              className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800"
                            >
                              Simpan
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sync Settings & Pending Queue */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Sinkronisasi Inkremental &amp; Kuota</h3>
                <button
                  type="button"
                  onClick={() => void onRunManualSync()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sinkronisasi Manual
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={settings.auto_sync_enabled}
                    onChange={(e) => void onUpdateSyncSettings(e.target.checked, syncIntervalInput)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  Auto Sync Aktif
                </label>

                <div className="flex items-center gap-2">
                  <label htmlFor="sync-min" className="font-semibold text-slate-700">
                    Interval (menit):
                  </label>
                  <input
                    id="sync-min"
                    type="number"
                    min={1}
                    max={120}
                    value={syncIntervalInput}
                    onChange={(e) => setSyncIntervalInput(Math.max(1, Number(e.target.value)))}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateSyncSettings(settings.auto_sync_enabled, syncIntervalInput)
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Terapkan
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-600 tabular-nums">
                Antrean tertunda (<code>pending_sync</code>): <strong>{pendingSync.length}</strong> mutasi.
                Rekaman suara lokal tidak ikut disinkronkan.
              </p>

              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs">
                {syncHistory.slice(0, 5).map((h) => (
                  <div key={h.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <span className="font-semibold text-slate-800">
                      {h.triggered_by.toUpperCase()}
                    </span>{' '}
                    · <span>{h.message}</span> ·{' '}
                    <span className="font-mono text-slate-500">
                      {h.at.slice(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Backup & Restore */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Backup &amp; Restore Data Lokal (JSON)</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Ekspor seluruh data lokal menjadi berkas JSON tervalidasi. Restore hanya menerima berkas
                milik <code>{SCHOOL_ID}</code> dengan struktur skema sah.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleExportJson()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  Ekspor Backup JSON
                </button>

                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                  <Upload className="h-3.5 w-3.5" />
                  Restore dari JSON
                  <input
                    type="file"
                    accept="application/json"
                    onChange={(e) => void handleImportJson(e)}
                    className="sr-only"
                  />
                </label>
              </div>

              {backupMsg && (
                <p className="text-xs font-semibold text-emerald-800" role="status">
                  {backupMsg}
                </p>
              )}
            </section>
          </div>

          {/* Audit Log Viewer */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-bold text-slate-900">Log Audit Aktivitas</h3>
            <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
              {auditLogs.slice(0, 20).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-mono font-semibold text-emerald-900">{log.action}</span> ·{' '}
                    <span className="font-semibold text-slate-800">{log.actor_name}</span> ·{' '}
                    <span className="text-slate-600">{log.summary}</span>
                  </div>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {log.timestamp.slice(0, 19).replace('T', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
