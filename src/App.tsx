import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  UserRole,
  WhatsAppShareStatus,
} from './types/simtaq';
import { appendAuditLog, db, enqueueSyncMutation, ensureSeeded } from './db/dexie';
import { SEED_SURAHS } from './data/seedData';
import { normalizeSurahCatalog } from './data/surahCatalog';
import { filterActiveAnnouncements } from './utils/announcementRules';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { SchoolInfoBanner, SchoolTopHeader } from './components/SchoolHeaderAndBanner';
import { AuthGateView } from './components/AuthGateView';
import { StudentPortalView } from './components/StudentPortalView';
import { SmartMurotalAndHifdzilView } from './components/SmartMurotalAndHifdzilView';
import { TajwidAndMapsiView } from './components/TajwidAndMapsiView';
import { TeacherPortalView } from './components/TeacherPortalView';
import { AdminAndSuperAdminView } from './components/AdminAndSuperAdminView';
import { AboutSimtaqView, DonationView } from './components/AboutAndDonationView';
import {
  SyncContextData,
  appendCloudAuditLog,
  auth,
  fetchAuditLogsFromFirestore,
  fetchUsersForSuperAdmin,
  flushPendingSyncToFirestore,
  hydrateSchoolDataFromFirestore,
  resolveAuthenticatedUserProfile,
  seedInitialSchoolDataToFirestore,
  signInWithGooglePopup,
  signOutSimtaq,
  subscribeAnnouncementsRealtime,
  subscribeAuthState,
  testConnection,
  updateUserRoleAndStatus,
} from './services/firebaseClient';
import {
  Award,
  HeartHandshake,
  Headphones,
  Info,
  LayoutDashboard,
  Mic,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from 'lucide-react';

type ActiveTab =
  | 'dashboard'
  | 'murotal'
  | 'hifdzil'
  | 'tajwid'
  | 'mapsi'
  | 'tentang'
  | 'donasi';

export default function App() {
  const isOnline = useOnlineStatus();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Firebase Auth & RBAC State (Phase 2)
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signedInProfile, setSignedInProfile] = useState<UserAccount | null>(null);
  const [bootstrapMismatch, setBootstrapMismatch] = useState(false);
  const [localLearningMode, setLocalLearningMode] = useState(false);
  const [cloudUsers, setCloudUsers] = useState<UserAccount[]>([]);

  // Local Offline-First Database State (Dexie.js)
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [halaqahs, setHalaqahs] = useState<Halaqah[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [targets, setTargets] = useState<TahfidzTarget[]>([]);
  const [memorizationRecords, setMemorizationRecords] = useState<MemorizationRecord[]>([]);
  const [murajaahRecords, setMurajaahRecords] = useState<MurajaahRecord[]>([]);
  const [surahs, setSurahs] = useState<QuranSurah[]>([]);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [qaris, setQaris] = useState<QariCatalogItem[]>([]);
  const [audioCacheMeta, setAudioCacheMeta] = useState<AudioCacheMetadata[]>([]);
  const [tajwidTopics, setTajwidTopics] = useState<TajwidTopic[]>([]);
  const [tajwidExamples, setTajwidExamples] = useState<TajwidExample[]>([]);
  const [tajwidQuestions, setTajwidQuestions] = useState<TajwidQuestion[]>([]);
  const [mapsiQuestions, setMapsiQuestions] = useState<MapsiQuestion[]>([]);
  const [questionPackages, setQuestionPackages] = useState<QuestionPackage[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgress[]>([]);
  const [localRecordings, setLocalRecordings] = useState<LocalAudioRecording[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementReads, setAnnouncementReads] = useState<AnnouncementRead[]>([]);
  const [pendingSync, setPendingSync] = useState<PendingSyncItem[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadAllFromDexie = useCallback(async () => {
    await ensureSeeded();
    const [
      s,
      u,
      cls,
      hal,
      stu,
      grd,
      asg,
      tgt,
      mem,
      mrj,
      sur,
      ver,
      qar,
      acm,
      tjt,
      tje,
      tjq,
      mq,
      qp,
      qr,
      lp,
      lrec,
      ann,
      reads,
      psync,
      shist,
      aud,
    ] = await Promise.all([
      db.school_settings.get(SCHOOL_ID),
      db.cached_users.toArray(),
      db.cached_classes.toArray(),
      db.cached_halaqahs.toArray(),
      db.cached_students.toArray(),
      db.cached_guardians.toArray(),
      db.cached_teacher_assignments.toArray(),
      db.cached_targets.toArray(),
      db.cached_memorization_records.toArray(),
      db.cached_murajaah_records.toArray(),
      db.cached_quran_surahs.toArray(),
      db.cached_quran_verses.toArray(),
      db.cached_qari_catalog.toArray(),
      db.cached_audio_metadata.toArray(),
      db.cached_tajwid_topics.toArray(),
      db.cached_tajwid_examples.toArray(),
      db.cached_tajwid_questions.toArray(),
      db.cached_mapsi_questions.toArray(),
      db.cached_question_packages.toArray(),
      db.local_quiz_results.toArray(),
      db.local_learning_progress.toArray(),
      db.local_audio_recordings.toArray(),
      db.cached_announcements.toArray(),
      db.announcement_reads.toArray(),
      db.pending_sync.toArray(),
      db.sync_history.toArray(),
      db.local_audit_logs.toArray(),
    ]);

    setSettings(s ?? null);
    setUsers(u);
    setClasses(cls);
    setHalaqahs(hal);
    setStudents(stu);
    setGuardians(grd);
    setAssignments(asg);
    setTargets(tgt);
    setMemorizationRecords(mem);
    setMurajaahRecords(mrj);
    setSurahs(normalizeSurahCatalog(sur.length > 0 ? sur : SEED_SURAHS));
    setVerses(ver);
    setQaris(qar);
    setAudioCacheMeta(acm);
    setTajwidTopics(tjt);
    setTajwidExamples(tje);
    setTajwidQuestions(tjq);
    setMapsiQuestions(mq);
    setQuestionPackages(qp);
    setQuizResults(qr);
    setLearningProgress(lp.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    setLocalRecordings(lrec.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setAnnouncements(ann);
    setAnnouncementReads(reads);
    setPendingSync(psync);
    setSyncHistory(shist.sort((a, b) => b.at.localeCompare(a.at)));
    setAuditLogs(aud.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAllFromDexie();
    void testConnection();
  }, [loadAllFromDexie]);

  // Listen to verified Firebase Auth state
  useEffect(() => {
    const unsub = subscribeAuthState(async (fbUser) => {
      if (!fbUser) {
        setSignedInProfile(null);
        setBootstrapMismatch(false);
        setCloudUsers([]);
        setAuthReady(true);
        return;
      }
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await resolveAuthenticatedUserProfile(fbUser);
        setSignedInProfile(res.profile);
        setBootstrapMismatch(Boolean(res.bootstrapBlockedMismatch));
        if (res.superAdminBootstrappedNow) {
          setSyncNotice(
            'Bootstrap atomic Super Admin berhasil! Akun utama dwiariwibowo313@gmail.com kini terkunci permanen.'
          );
        }
        if (res.profile.is_active) {
          setLocalLearningMode(false);
          setActiveTab('dashboard');
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Gagal memverifikasi akun Google.');
        setSignedInProfile(null);
      } finally {
        setAuthLoading(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  const isAuthenticatedActive = Boolean(
    signedInProfile && signedInProfile.is_active && !bootstrapMismatch
  );

  const hydrateFromFirestoreSafe = useCallback(
    async (profile: UserAccount) => {
      if (!navigator.onLine) return;
      try {
        const [pending, cloud, existingGrds, existingMems] = await Promise.all([
          db.pending_sync.toArray(),
          hydrateSchoolDataFromFirestore(profile),
          db.cached_guardians.toArray(),
          db.cached_memorization_records.toArray(),
        ]);
        const pendingSet = new Set(pending.map((p) => `${p.collection}:${p.doc_id}`));
        const grdHistoryMap = new Map(existingGrds.map((g) => [g.id, g.contact_history ?? []]));
        const memAuditMap = new Map(existingMems.map((m) => [m.id, m.audit_trail ?? []]));

        if (cloud.settings && !pendingSet.has(`school_settings:${SCHOOL_ID}`)) {
          await db.school_settings.put(cloud.settings);
        }
        const clsToPut = cloud.classes.filter((c) => !pendingSet.has(`classes:${c.id}`));
        if (clsToPut.length > 0) await db.cached_classes.bulkPut(clsToPut);

        const halToPut = cloud.halaqahs.filter((h) => !pendingSet.has(`halaqahs:${h.id}`));
        if (halToPut.length > 0) await db.cached_halaqahs.bulkPut(halToPut);

        const stuToPut = cloud.students.filter((s) => !pendingSet.has(`students:${s.id}`));
        if (stuToPut.length > 0) await db.cached_students.bulkPut(stuToPut);

        const grdToPut = cloud.guardians
          .filter((g) => !pendingSet.has(`guardians:${g.id}`))
          .map((g) => ({
            ...g,
            contact_history: grdHistoryMap.get(g.id) ?? g.contact_history ?? [],
          }));
        if (grdToPut.length > 0) await db.cached_guardians.bulkPut(grdToPut);

        const asgToPut = cloud.assignments.filter(
          (a) => !pendingSet.has(`teacher_assignments:${a.id}`)
        );
        if (asgToPut.length > 0) await db.cached_teacher_assignments.bulkPut(asgToPut);

        const tgtToPut = cloud.targets.filter((t) => !pendingSet.has(`tahfidz_targets:${t.id}`));
        if (tgtToPut.length > 0) await db.cached_targets.bulkPut(tgtToPut);

        const memToPut = cloud.memorizationRecords
          .filter((m) => !pendingSet.has(`memorization_records:${m.id}`))
          .map((m) => ({
            ...m,
            audit_trail: memAuditMap.get(m.id) ?? m.audit_trail ?? [],
          }));
        if (memToPut.length > 0) await db.cached_memorization_records.bulkPut(memToPut);

        const mrjToPut = cloud.murajaahRecords.filter(
          (r) => !pendingSet.has(`murajaah_records:${r.id}`)
        );
        if (mrjToPut.length > 0) await db.cached_murajaah_records.bulkPut(mrjToPut);

        const annToPut = cloud.announcements.filter((a) => !pendingSet.has(`announcements:${a.id}`));
        if (annToPut.length > 0) await db.cached_announcements.bulkPut(annToPut);

        const readToPut = cloud.announcementReads.filter(
          (r) => !pendingSet.has(`announcement_reads:${r.id}`)
        );
        if (readToPut.length > 0) await db.announcement_reads.bulkPut(readToPut);

        const quizToPut = cloud.quizResults.filter((q) => !pendingSet.has(`quiz_results:${q.id}`));
        if (quizToPut.length > 0) await db.local_quiz_results.bulkPut(quizToPut);

        await loadAllFromDexie();
      } catch {
        // Offline or deferred hydration
      }
    },
    [loadAllFromDexie]
  );

  // Realtime Firestore listeners & two-way hydration ONLY when Auth is ready and user is authenticated & active
  useEffect(() => {
    if (!authReady || !isAuthenticatedActive || !signedInProfile) return;

    const unsubAnn = subscribeAnnouncementsRealtime(async (cloudAnns) => {
      if (cloudAnns.length > 0) {
        const pending = await db.pending_sync.toArray();
        const pendingSet = new Set(pending.map((p) => `${p.collection}:${p.doc_id}`));
        const safeAnns = cloudAnns.filter((a) => !pendingSet.has(`announcements:${a.id}`));
        if (safeAnns.length > 0) {
          await db.cached_announcements.bulkPut(safeAnns);
          await loadAllFromDexie();
        }
      }
    });

    if (navigator.onLine) {
      void hydrateFromFirestoreSafe(signedInProfile);
    }

    if (signedInProfile.role === 'super_admin' && navigator.onLine) {
      void fetchUsersForSuperAdmin()
        .then(setCloudUsers)
        .catch(() => {
          // Offline or deferred
        });
      void fetchAuditLogsFromFirestore()
        .then(async (logs) => {
          if (logs.length > 0) {
            await db.local_audit_logs.bulkPut(logs);
            await loadAllFromDexie();
          }
        })
        .catch(() => {
          // Offline or deferred
        });
    }

    return () => {
      unsubAnn();
    };
  }, [authReady, isAuthenticatedActive, signedInProfile, loadAllFromDexie, hydrateFromFirestoreSafe]);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Login Google dibatalkan atau gagal. Pastikan pop-up diizinkan.'
      );
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutSimtaq();
    setSignedInProfile(null);
    setBootstrapMismatch(false);
    setLocalLearningMode(false);
    setActiveTab('dashboard');
    setSyncNotice('Anda telah keluar dari akun Google.');
  }, []);

  const handleRefreshAccountStatus = useCallback(async () => {
    if (!auth.currentUser) return;
    setAuthLoading(true);
    try {
      const res = await resolveAuthenticatedUserProfile(auth.currentUser);
      setSignedInProfile(res.profile);
      setBootstrapMismatch(Boolean(res.bootstrapBlockedMismatch));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Gagal memuat status akun.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const runSyncCycle = useCallback(
    async (triggeredBy: 'auto' | 'manual') => {
      const pending = await db.pending_sync.toArray();
      if (!navigator.onLine) {
        await db.sync_history.put({
          id: `sync-${Date.now()}`,
          triggered_by: triggeredBy,
          synced_count: 0,
          pending_remaining: pending.length,
          status: 'offline_deferred',
          message: 'Perangkat offline; data tetap aman tersimpan di IndexedDB.',
          at: new Date().toISOString(),
        });
        await loadAllFromDexie();
        if (triggeredBy === 'manual') {
          setSyncNotice('Mode Offline: Data tersimpan lokal dan siap disinkronkan saat online.');
        }
        return;
      }

      if (!isAuthenticatedActive || !signedInProfile) {
        await db.sync_history.put({
          id: `sync-${Date.now()}`,
          triggered_by: triggeredBy,
          synced_count: 0,
          pending_remaining: pending.length,
          status: 'offline_deferred',
          message: 'Masuk dengan akun Google aktif diperlukan untuk menyinkronkan antrean ke Firestore.',
          at: new Date().toISOString(),
        });
        await loadAllFromDexie();
        if (triggeredBy === 'manual') {
          setSyncNotice(
            `Mode Lokal: ${pending.length} data tersimpan aman di perangkat. Masuk Google untuk sinkronisasi cloud.`
          );
        }
        return;
      }

      const [allUsers, allAssignments, allStudents] = await Promise.all([
        db.cached_users.toArray(),
        db.cached_teacher_assignments.toArray(),
        db.cached_students.toArray(),
      ]);
      const mergedUsers = [...cloudUsers, ...allUsers];
      const adminUids = mergedUsers
        .filter((u) => (u.role === 'super_admin' || u.role === 'school_admin') && u.is_active)
        .map((u) => u.uid);
      const syncContext: SyncContextData = {
        users: mergedUsers,
        assignments: allAssignments,
        students: allStudents,
        adminUids,
      };

      if (pending.length === 0) {
        await hydrateFromFirestoreSafe(signedInProfile);
        await db.sync_history.put({
          id: `sync-${Date.now()}`,
          triggered_by: triggeredBy,
          synced_count: 0,
          pending_remaining: 0,
          status: 'success',
          message: 'Seluruh data cloud & perangkat sudah sinkron (two-way sync selesai).',
          at: new Date().toISOString(),
        });
        await loadAllFromDexie();
        if (triggeredBy === 'manual') {
          setSyncNotice('Seluruh data sudah sinkron dua arah dengan Firestore.');
        }
        return;
      }

      const result = await flushPendingSyncToFirestore(pending, signedInProfile.uid, syncContext);
      if (result.syncedIds.length > 0) {
        await db.pending_sync.bulkDelete(result.syncedIds);
      }

      await hydrateFromFirestoreSafe(signedInProfile);

      await db.sync_history.put({
        id: `sync-${Date.now()}`,
        triggered_by: triggeredBy,
        synced_count: result.syncedIds.length,
        pending_remaining: pending.length - result.syncedIds.length,
        status: result.failedCount > 0 ? 'partial_error' : 'success',
        message:
          result.failedCount > 0
            ? `${result.syncedIds.length} tersinkron, ${result.failedCount} gagal (${result.lastError ?? 'cek hak akses'}).`
            : `${result.syncedIds.length} mutasi berhasil dikirim & data cloud diperbarui.`,
        at: new Date().toISOString(),
      });
      await loadAllFromDexie();
      if (triggeredBy === 'manual') {
        setSyncNotice(
          result.failedCount > 0
            ? `Sinkronisasi parsial: ${result.syncedIds.length} terkirim, ${result.failedCount} ditahan (cek hak akses Firestore).`
            : `Berhasil menyinkronkan ${result.syncedIds.length} perubahan & memperbarui cache cloud.`
        );
      }
    },
    [isAuthenticatedActive, signedInProfile, cloudUsers, hydrateFromFirestoreSafe, loadAllFromDexie]
  );

  // Default 10-minute configurable Auto Sync scheduler
  useEffect(() => {
    if (!settings?.auto_sync_enabled) return;
    const ms = Math.max(1, settings.sync_interval_minutes) * 60 * 1000;
    const id = window.setInterval(() => {
      void runSyncCycle('auto');
    }, ms);
    return () => window.clearInterval(id);
  }, [settings?.auto_sync_enabled, settings?.sync_interval_minutes, runSyncCycle]);

  const activeRole: UserRole = isAuthenticatedActive
    ? signedInProfile!.role
    : 'student';

  const activeUser: UserAccount = useMemo(() => {
    if (isAuthenticatedActive && signedInProfile) {
      return signedInProfile;
    }
    return {
      uid: 'local-student-guest',
      email: 'belajar-lokal@sdnjetiskarangpung1.sch.id',
      display_name: 'Siswa Mode Belajar Lokal',
      role: 'student',
      school_id: SCHOOL_ID,
      is_active: false,
      linked_entity_id: students[0]?.id ?? 'stu-1',
      created_at: new Date().toISOString(),
    };
  }, [isAuthenticatedActive, signedInProfile, students]);

  const activeStudent = useMemo<Student | undefined>(() => {
    if (activeRole === 'student' && activeUser.linked_entity_id) {
      return students.find((s) => s.id === activeUser.linked_entity_id) ?? students[0];
    }
    if (activeRole === 'guardian' && activeUser.linked_entity_id) {
      const grd = guardians.find((g) => g.id === activeUser.linked_entity_id);
      if (grd && grd.student_ids[0]) {
        return students.find((s) => s.id === grd.student_ids[0]) ?? students[0];
      }
    }
    return students[0];
  }, [activeRole, activeUser, students, guardians]);

  const activeTeacherAssignment = useMemo<TeacherAssignment | null>(() => {
    if (activeRole !== 'teacher') return null;
    return (
      assignments.find(
        (a) => a.teacher_uid === activeUser.uid || a.id === activeUser.linked_entity_id
      ) ?? assignments[0] ?? null
    );
  }, [activeRole, assignments, activeUser]);

  const latestStudentProgress = useMemo(() => {
    const sid = activeStudent?.id ?? 'stu-1';
    return learningProgress.find((p) => p.student_id === sid) ?? null;
  }, [learningProgress, activeStudent]);

  const visibleAnnouncements = useMemo(
    () =>
      filterActiveAnnouncements(
        announcements,
        {
          role: activeRole,
          classId: activeStudent?.class_id,
          halaqahId: activeStudent?.halaqah_id,
        },
        new Date().toISOString()
      ),
    [announcements, activeRole, activeStudent]
  );

  const navItems = useMemo(() => {
    const base: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
      {
        id: 'dashboard',
        label:
          activeRole === 'student'
            ? 'Capaian Saya'
            : activeRole === 'guardian'
              ? 'Perkembangan Anak'
              : activeRole === 'teacher'
                ? 'Dashboard Guru'
                : activeRole === 'school_admin'
                  ? 'Admin Sekolah'
                  : 'Super Admin',
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
      },
    ];

    if (activeRole === 'student' || activeRole === 'teacher') {
      base.push(
        {
          id: 'murotal',
          label: 'Smart Murotal',
          icon: <Headphones className="h-4 w-4" aria-hidden="true" />,
        },
        {
          id: 'hifdzil',
          label: 'Smart Hifdzil & Duet',
          icon: <Mic className="h-4 w-4" aria-hidden="true" />,
        },
        {
          id: 'tajwid',
          label: 'Belajar Tajwid',
          icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
        },
        {
          id: 'mapsi',
          label: 'MAPSi Hifdzil',
          icon: <Award className="h-4 w-4" aria-hidden="true" />,
        }
      );
    }

    base.push(
      {
        id: 'tentang',
        label: 'Tentang SIMTAQ',
        icon: <Info className="h-4 w-4" aria-hidden="true" />,
      },
      {
        id: 'donasi',
        label: 'Dukung Pengembangan',
        icon: <HeartHandshake className="h-4 w-4" aria-hidden="true" />,
      }
    );
    return base;
  }, [activeRole]);

  const activePageTitle =
    !isAuthenticatedActive && !localLearningMode
      ? activeTab === 'tentang'
        ? 'Tentang SIMTAQ'
        : activeTab === 'donasi'
          ? 'Dukung Pengembangan'
          : 'Gerbang Masuk'
      : navItems.find((n) => n.id === activeTab)?.label ?? 'Beranda';

  if (loading || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8F6] p-6 text-sm font-medium text-emerald-900">
        Memuat SIMTAQ — SDN Jetiskarangpung 1...
      </div>
    );
  }

  const showGateScreen =
    !isAuthenticatedActive && !localLearningMode && activeTab !== 'tentang' && activeTab !== 'donasi';

  return (
    <div className="min-h-screen bg-[#F6F8F6] text-slate-900">
      <SchoolTopHeader
        settings={settings}
        activeUser={isAuthenticatedActive ? signedInProfile : null}
        isAuthenticated={isAuthenticatedActive}
        isLocalLearningMode={localLearningMode}
        activePageTitle={activePageTitle}
        isOnline={isOnline}
        pendingSyncCount={pendingSync.length}
        onSyncNow={() => void runSyncCycle('manual')}
        onGoogleSignIn={() => void handleGoogleSignIn()}
        onSignOut={() => void handleSignOut()}
      />

      {!isOnline && (
        <div
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950"
        >
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Mode Offline Aktif — Materi &amp; data yang tersimpan di perangkat tetap dapat digunakan.
          </span>
        </div>
      )}

      {syncNotice && (
        <div
          role="status"
          className="mx-auto mt-3 flex max-w-7xl items-center justify-between gap-2 px-4 sm:px-6"
        >
          <div className="flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-900">
            <span>{syncNotice}</span>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="ml-3 font-semibold text-emerald-800 underline"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {showGateScreen ? (
        <div className="px-4 py-8 sm:px-6">
          <AuthGateView
            signedInUser={signedInProfile}
            authLoading={authLoading}
            authError={authError}
            bootstrapMismatch={bootstrapMismatch}
            onGoogleSignIn={handleGoogleSignIn}
            onSignOut={handleSignOut}
            onRefreshAccountStatus={handleRefreshAccountStatus}
            onEnterLocalLearningMode={() => {
              setLocalLearningMode(true);
              setActiveTab('dashboard');
            }}
            onOpenPublicTab={(tab) => setActiveTab(tab)}
          />
        </div>
      ) : (
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row">
          {/* Desktop Sidebar & Compact Horizontal Mobile Nav */}
          <aside className="lg:w-60 lg:shrink-0">
            <nav
              aria-label="Navigasi Utama SIMTAQ"
              className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 lg:flex-col"
            >
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-950'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 hidden lg:block rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {isAuthenticatedActive ? 'SIMTAQ v1.2 — Terotentikasi' : 'Mode Belajar Lokal'}
                </span>
              </div>
              <p className="leading-relaxed">
                {isAuthenticatedActive
                  ? 'Sesi Firebase Auth & Firestore Security Rules aktif. Data offline tersinkron saat online.'
                  : 'Anda sedang dalam Mode Belajar Siswa Offline tanpa akses Guru/Admin atau cloud PII.'}
              </p>
              {!isAuthenticatedActive && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalLearningMode(false);
                    setActiveTab('dashboard');
                  }}
                  className="w-full rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-900 hover:bg-emerald-100"
                >
                  Ke Gerbang Masuk Google
                </button>
              )}
            </div>
          </aside>

          {/* Main Workspace */}
          <main className="min-w-0 flex-1 space-y-6">
            {activeTab !== 'tentang' && activeTab !== 'donasi' && (
              <SchoolInfoBanner role={activeRole} userName={activeUser.display_name} />
            )}

            {activeTab === 'tentang' && (
              <div className="space-y-4">
                {!isAuthenticatedActive && !localLearningMode && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ← Kembali ke Gerbang Masuk
                  </button>
                )}
                <AboutSimtaqView />
              </div>
            )}

            {activeTab === 'donasi' && (
              <div className="space-y-4">
                {!isAuthenticatedActive && !localLearningMode && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    ← Kembali ke Gerbang Masuk
                  </button>
                )}
                <DonationView />
              </div>
            )}

            {activeTab === 'dashboard' &&
              (activeRole === 'student' || activeRole === 'guardian') &&
              activeStudent && (
                <StudentPortalView
                  student={activeStudent}
                  isGuardianView={activeRole === 'guardian'}
                  memorizationRecords={memorizationRecords}
                  murajaahRecords={murajaahRecords}
                  targets={targets}
                  surahs={surahs}
                  quizResults={quizResults}
                  announcements={visibleAnnouncements}
                  reads={announcementReads}
                  userUid={activeUser.uid}
                  onMarkAnnouncementRead={async (annId) => {
                    const readObj: AnnouncementRead = {
                      id: `${annId}__${activeUser.uid}`,
                      announcement_id: annId,
                      user_uid: activeUser.uid,
                      read_at: new Date().toISOString(),
                    };
                    await db.announcement_reads.put(readObj);
                    if (isAuthenticatedActive) {
                      await enqueueSyncMutation('announcement_reads', readObj.id, 'upsert', readObj);
                    }
                    await loadAllFromDexie();
                  }}
                  onNavigateModule={(tab) => setActiveTab(tab)}
                />
              )}

            {activeTab === 'murotal' && (
              <SmartMurotalAndHifdzilView
                initialMode="murotal"
                studentId={activeStudent?.id ?? 'stu-1'}
                surahs={surahs}
                verses={verses}
                qaris={qaris}
                audioCacheMeta={audioCacheMeta}
                localRecordings={localRecordings}
                latestProgress={latestStudentProgress}
                onSaveProgress={async (activityType, surahNum, ayahNum, note) => {
                  await db.local_learning_progress.put({
                    id: `prog-${activityType}-${Date.now()}`,
                    student_id: activeStudent?.id ?? 'stu-1',
                    activity_type: activityType,
                    surah_number: surahNum,
                    ayah_number: ayahNum,
                    note,
                    updated_at: new Date().toISOString(),
                  });
                  await loadAllFromDexie();
                }}
                onSaveAudioCacheMeta={async (meta) => {
                  await db.cached_audio_metadata.put(meta);
                  await loadAllFromDexie();
                }}
                onDeleteAudioCacheForSurah={async (qariId, surahNum) => {
                  const items = await db.cached_audio_metadata
                    .where({ qari_id: qariId, surah_number: surahNum })
                    .toArray();
                  await db.cached_audio_metadata.bulkDelete(items.map((i) => i.key));
                  await loadAllFromDexie();
                }}
                onSaveLocalRecording={async (rec) => {
                  await db.local_audio_recordings.put(rec);
                  await loadAllFromDexie();
                }}
                onDeleteLocalRecording={async (id) => {
                  await db.local_audio_recordings.delete(id);
                  await loadAllFromDexie();
                }}
              />
            )}

            {activeTab === 'hifdzil' && (
              <SmartMurotalAndHifdzilView
                initialMode="hifdzil"
                studentId={activeStudent?.id ?? 'stu-1'}
                surahs={surahs}
                verses={verses}
                qaris={qaris}
                audioCacheMeta={audioCacheMeta}
                localRecordings={localRecordings}
                latestProgress={latestStudentProgress}
                onSaveProgress={async (activityType, surahNum, ayahNum, note) => {
                  await db.local_learning_progress.put({
                    id: `prog-${activityType}-${Date.now()}`,
                    student_id: activeStudent?.id ?? 'stu-1',
                    activity_type: activityType,
                    surah_number: surahNum,
                    ayah_number: ayahNum,
                    note,
                    updated_at: new Date().toISOString(),
                  });
                  await loadAllFromDexie();
                }}
                onSaveAudioCacheMeta={async (meta) => {
                  await db.cached_audio_metadata.put(meta);
                  await loadAllFromDexie();
                }}
                onDeleteAudioCacheForSurah={async (qariId, surahNum) => {
                  const items = await db.cached_audio_metadata
                    .where({ qari_id: qariId, surah_number: surahNum })
                    .toArray();
                  await db.cached_audio_metadata.bulkDelete(items.map((i) => i.key));
                  await loadAllFromDexie();
                }}
                onSaveLocalRecording={async (rec) => {
                  await db.local_audio_recordings.put(rec);
                  await loadAllFromDexie();
                }}
                onDeleteLocalRecording={async (id) => {
                  await db.local_audio_recordings.delete(id);
                  await loadAllFromDexie();
                }}
              />
            )}

            {activeTab === 'tajwid' && (
              <TajwidAndMapsiView
                initialSection="tajwid"
                studentId={activeStudent?.id ?? 'stu-1'}
                topics={tajwidTopics}
                examples={tajwidExamples}
                tajwidQuestions={tajwidQuestions}
                mapsiQuestions={mapsiQuestions}
                questionPackages={questionPackages}
                qaris={qaris}
                quizResults={quizResults}
                onSaveQuizResult={async (res) => {
                  await db.local_quiz_results.put(res);
                  if (isAuthenticatedActive) {
                    await enqueueSyncMutation('quiz_results', res.id, 'upsert', res);
                  }
                  await loadAllFromDexie();
                }}
              />
            )}

            {activeTab === 'mapsi' && (
              <TajwidAndMapsiView
                initialSection="mapsi"
                studentId={activeStudent?.id ?? 'stu-1'}
                topics={tajwidTopics}
                examples={tajwidExamples}
                tajwidQuestions={tajwidQuestions}
                mapsiQuestions={mapsiQuestions}
                questionPackages={questionPackages}
                qaris={qaris}
                quizResults={quizResults}
                onSaveQuizResult={async (res) => {
                  await db.local_quiz_results.put(res);
                  if (isAuthenticatedActive) {
                    await enqueueSyncMutation('quiz_results', res.id, 'upsert', res);
                  }
                  await loadAllFromDexie();
                }}
              />
            )}

            {activeTab === 'dashboard' && activeRole === 'teacher' && isAuthenticatedActive && (
              <TeacherPortalView
                teacherAssignment={activeTeacherAssignment}
                classes={classes}
                halaqahs={halaqahs}
                students={students}
                guardians={guardians}
                surahs={surahs}
                targets={targets}
                memorizationRecords={memorizationRecords}
                murajaahRecords={murajaahRecords}
                tajwidTopics={tajwidTopics}
                tajwidExamples={tajwidExamples}
                tajwidQuestions={tajwidQuestions}
                mapsiQuestions={mapsiQuestions}
                questionPackages={questionPackages}
                quizResults={quizResults}
                onSaveMemorization={async (rec) => {
                  await db.cached_memorization_records.put(rec);
                  await enqueueSyncMutation('memorization_records', rec.id, 'upsert', rec);
                  const summary = `Setoran ${rec.surah_name} (${rec.ayah_start}-${rec.ayah_end}) status ${rec.status}`;
                  await appendAuditLog({
                    actor_uid: activeUser.uid,
                    actor_name: activeUser.display_name,
                    actor_role: activeUser.role,
                    action: 'MEMORIZATION_SAVED',
                    target: rec.id,
                    summary,
                  });
                  void appendCloudAuditLog(activeUser, 'MEMORIZATION_SAVED', rec.id, summary);
                  await loadAllFromDexie();
                }}
                onSaveMurajaah={async (mrj) => {
                  await db.cached_murajaah_records.put(mrj);
                  await enqueueSyncMutation('murajaah_records', mrj.id, 'upsert', mrj);
                  const summary = `Murajaah ${mrj.surah_name} (${mrj.ayah_start}-${mrj.ayah_end}) status ${mrj.status}`;
                  await appendAuditLog({
                    actor_uid: activeUser.uid,
                    actor_name: activeUser.display_name,
                    actor_role: activeUser.role,
                    action: 'MURAJAAH_SAVED',
                    target: mrj.id,
                    summary,
                  });
                  void appendCloudAuditLog(activeUser, 'MURAJAAH_SAVED', mrj.id, summary);
                  await loadAllFromDexie();
                }}
                onUpdateGuardianContact={async (grd) => {
                  await db.cached_guardians.put(grd);
                  await enqueueSyncMutation('guardians', grd.id, 'upsert', grd);
                  const summary = `Pembaruan kontak WhatsApp wali ${grd.full_name}`;
                  await appendAuditLog({
                    actor_uid: activeUser.uid,
                    actor_name: activeUser.display_name,
                    actor_role: activeUser.role,
                    action: 'GUARDIAN_CONTACT_UPDATED',
                    target: grd.id,
                    summary,
                  });
                  void appendCloudAuditLog(activeUser, 'GUARDIAN_CONTACT_UPDATED', grd.id, summary);
                  await loadAllFromDexie();
                }}
                onUpdateShareStatus={async (type, recordId, status: WhatsAppShareStatus) => {
                  const nowIso = new Date().toISOString();
                  if (type === 'memorization') {
                    const rec = await db.cached_memorization_records.get(recordId);
                    if (rec) {
                      const updated: MemorizationRecord = {
                        ...rec,
                        whatsapp_share_status: status,
                        whatsapp_shared_at: nowIso,
                        updated_at: nowIso,
                      };
                      await db.cached_memorization_records.put(updated);
                      await enqueueSyncMutation('memorization_records', updated.id, 'upsert', updated);
                    }
                  } else {
                    const mrj = await db.cached_murajaah_records.get(recordId);
                    if (mrj) {
                      const updated: MurajaahRecord = {
                        ...mrj,
                        whatsapp_share_status: status,
                        whatsapp_shared_at: nowIso,
                        updated_at: nowIso,
                      };
                      await db.cached_murajaah_records.put(updated);
                      await enqueueSyncMutation('murajaah_records', updated.id, 'upsert', updated);
                    }
                  }
                  await loadAllFromDexie();
                }}
                onSaveTarget={async (tgt) => {
                  await db.cached_targets.put(tgt);
                  await enqueueSyncMutation('tahfidz_targets', tgt.id, 'upsert', tgt);
                  const summary = `Target baru guru: ${tgt.period_label} (${tgt.target_ayah_count} ayat)`;
                  await appendAuditLog({
                    actor_uid: activeUser.uid,
                    actor_name: activeUser.display_name,
                    actor_role: activeUser.role,
                    action: 'TARGET_SAVED',
                    target: tgt.id,
                    summary,
                  });
                  void appendCloudAuditLog(activeUser, 'TARGET_SAVED', tgt.id, summary);
                  await loadAllFromDexie();
                }}
                onCreateAnnouncement={async (ann) => {
                  const authored: Announcement = {
                    ...ann,
                    author_uid: activeUser.uid,
                    author_name: activeUser.display_name,
                  };
                  await db.cached_announcements.put(authored);
                  await enqueueSyncMutation('announcements', authored.id, 'upsert', authored);
                  const summary = `Pengumuman guru diterbitkan: ${authored.title}`;
                  await appendAuditLog({
                    actor_uid: activeUser.uid,
                    actor_name: activeUser.display_name,
                    actor_role: activeUser.role,
                    action: 'ANNOUNCEMENT_PUBLISHED',
                    target: authored.id,
                    summary,
                  });
                  void appendCloudAuditLog(activeUser, 'ANNOUNCEMENT_PUBLISHED', authored.id, summary);
                  await loadAllFromDexie();
                }}
                onVerifyCurriculumItem={async (kind, id) => {
                  const nowIso = new Date().toISOString();
                  if (kind === 'tajwid_topic') {
                    const item = await db.cached_tajwid_topics.get(id);
                    if (item) {
                      await db.cached_tajwid_topics.put({
                        ...item,
                        verification_status: 'verified',
                        verified_by: activeUser.display_name,
                        verified_at: nowIso,
                      });
                    }
                  } else if (kind === 'tajwid_example') {
                    const item = await db.cached_tajwid_examples.get(id);
                    if (item) {
                      await db.cached_tajwid_examples.put({
                        ...item,
                        verification_status: 'verified',
                        verified_by: activeUser.display_name,
                        verified_at: nowIso,
                      });
                    }
                  } else if (kind === 'tajwid_question') {
                    const item = await db.cached_tajwid_questions.get(id);
                    if (item) {
                      await db.cached_tajwid_questions.put({
                        ...item,
                        verification_status: 'verified',
                        verified_by: activeUser.display_name,
                        verified_at: nowIso,
                      });
                    }
                  } else if (kind === 'mapsi_question') {
                    const item = await db.cached_mapsi_questions.get(id);
                    if (item) {
                      await db.cached_mapsi_questions.put({
                        ...item,
                        verification_status: 'verified',
                        verified_by: activeUser.display_name,
                      });
                    }
                  }
                  const summary = `Verifikasi materi kurikulum (${kind}: ${id})`;
                  await appendAuditLog({
                    actor_uid: activeUser.uid,
                    actor_name: activeUser.display_name,
                    actor_role: activeUser.role,
                    action: 'CURRICULUM_ITEM_VERIFIED',
                    target: id,
                    summary,
                  });
                  void appendCloudAuditLog(activeUser, 'CURRICULUM_ITEM_VERIFIED', id, summary);
                  await loadAllFromDexie();
                }}
                onSaveQuestionPackage={async (pkg) => {
                  await db.cached_question_packages.put(pkg);
                  const summary = `Paket soal ${pkg.title} (${pkg.status})`;
                  await appendAuditLog({
                    actor_uid: activeUser.uid,
                    actor_name: activeUser.display_name,
                    actor_role: activeUser.role,
                    action: 'QUESTION_PACKAGE_SAVED',
                    target: pkg.id,
                    summary,
                  });
                  void appendCloudAuditLog(activeUser, 'QUESTION_PACKAGE_SAVED', pkg.id, summary);
                  await loadAllFromDexie();
                }}
              />
            )}

            {activeTab === 'dashboard' &&
              isAuthenticatedActive &&
              (activeRole === 'school_admin' || activeRole === 'super_admin') && (
                <AdminAndSuperAdminView
                  mode={activeRole}
                  settings={settings}
                  users={users}
                  cloudUsers={cloudUsers}
                  classes={classes}
                  halaqahs={halaqahs}
                  students={students}
                  guardians={guardians}
                  assignments={assignments}
                  targets={targets}
                  memorizationRecords={memorizationRecords}
                  murajaahRecords={murajaahRecords}
                  surahs={surahs}
                  quizResults={quizResults}
                  announcements={announcements}
                  pendingSync={pendingSync}
                  syncHistory={syncHistory}
                  auditLogs={auditLogs}
                  onUpdateSchoolLogo={async (dataUrl) => {
                    const updated: SchoolSettings = {
                      ...settings,
                      logo_data_url: dataUrl,
                      updated_by: activeUser.display_name,
                      updated_at: new Date().toISOString(),
                    };
                    await db.school_settings.put(updated);
                    if (isAuthenticatedActive) {
                      await enqueueSyncMutation('school_settings', SCHOOL_ID, 'upsert', updated);
                    }
                    const summary = dataUrl ? 'Logo sekolah diperbarui' : 'Logo sekolah dihapus';
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action: 'SCHOOL_LOGO_UPDATED',
                      target: SCHOOL_ID,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, 'SCHOOL_LOGO_UPDATED', SCHOOL_ID, summary);
                    await loadAllFromDexie();
                  }}
                  onSaveClass={async (cls) => {
                    await db.cached_classes.put(cls);
                    await enqueueSyncMutation('classes', cls.id, 'upsert', cls);
                    const summary = `Data kelas disimpan: ${cls.name} (Kelas ${cls.grade_level})`;
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action: 'CLASS_SAVED',
                      target: cls.id,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, 'CLASS_SAVED', cls.id, summary);
                    await loadAllFromDexie();
                  }}
                  onSaveHalaqah={async (hal) => {
                    await db.cached_halaqahs.put(hal);
                    await enqueueSyncMutation('halaqahs', hal.id, 'upsert', hal);
                    const summary = `Data halaqah disimpan: ${hal.name}`;
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action: 'HALAQAH_SAVED',
                      target: hal.id,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, 'HALAQAH_SAVED', hal.id, summary);
                    await loadAllFromDexie();
                  }}
                  onSaveStudent={async (stu, isNew) => {
                    await db.cached_students.put(stu);
                    await enqueueSyncMutation('students', stu.id, 'upsert', stu);

                    // Sync bidirectional guardian.student_ids links
                    const allGrds = await db.cached_guardians.toArray();
                    for (const g of allGrds) {
                      const shouldLink = stu.guardian_ids.includes(g.id);
                      const isLinked = g.student_ids.includes(stu.id);
                      if (shouldLink && !isLinked) {
                        const updatedGrd: Guardian = {
                          ...g,
                          student_ids: [...g.student_ids, stu.id],
                          updated_at: new Date().toISOString(),
                        };
                        await db.cached_guardians.put(updatedGrd);
                        await enqueueSyncMutation('guardians', updatedGrd.id, 'upsert', updatedGrd);
                      } else if (!shouldLink && isLinked) {
                        const updatedGrd: Guardian = {
                          ...g,
                          student_ids: g.student_ids.filter((id) => id !== stu.id),
                          updated_at: new Date().toISOString(),
                        };
                        await db.cached_guardians.put(updatedGrd);
                        await enqueueSyncMutation('guardians', updatedGrd.id, 'upsert', updatedGrd);
                      }
                    }

                    const action = isNew ? 'STUDENT_ADDED' : 'STUDENT_UPDATED';
                    const summary = `${isNew ? 'Menambahkan' : 'Memperbarui'} siswa ${stu.full_name} (${stu.status})`;
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action,
                      target: stu.id,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, action, stu.id, summary);
                    await loadAllFromDexie();
                  }}
                  onSaveGuardian={async (grd, isNew) => {
                    await db.cached_guardians.put(grd);
                    await enqueueSyncMutation('guardians', grd.id, 'upsert', grd);

                    // Sync bidirectional student.guardian_ids links
                    const allStus = await db.cached_students.toArray();
                    for (const s of allStus) {
                      const shouldLink = grd.student_ids.includes(s.id);
                      const isLinked = s.guardian_ids.includes(grd.id);
                      if (shouldLink && !isLinked) {
                        const updatedStu: Student = {
                          ...s,
                          guardian_ids: [...s.guardian_ids, grd.id].slice(0, 4),
                        };
                        await db.cached_students.put(updatedStu);
                        await enqueueSyncMutation('students', updatedStu.id, 'upsert', updatedStu);
                      } else if (!shouldLink && isLinked) {
                        const updatedStu: Student = {
                          ...s,
                          guardian_ids: s.guardian_ids.filter((id) => id !== grd.id),
                        };
                        await db.cached_students.put(updatedStu);
                        await enqueueSyncMutation('students', updatedStu.id, 'upsert', updatedStu);
                      }
                    }

                    const action = isNew ? 'GUARDIAN_ADDED' : 'GUARDIAN_UPDATED';
                    const summary = `${isNew ? 'Menambahkan' : 'Memperbarui'} wali ${grd.full_name} (${grd.whatsapp_e164})`;
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action,
                      target: grd.id,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, action, grd.id, summary);
                    await loadAllFromDexie();
                  }}
                  onSaveTeacherAssignment={async (asg, isNew) => {
                    await db.cached_teacher_assignments.put(asg);
                    await enqueueSyncMutation('teacher_assignments', asg.id, 'upsert', asg);
                    const action = isNew ? 'TEACHER_ASSIGNMENT_ADDED' : 'TEACHER_ASSIGNMENT_UPDATED';
                    const summary = `Penugasan guru ${asg.teacher_name} (${asg.class_ids.length} kelas, ${asg.halaqah_ids.length} halaqah)`;
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action,
                      target: asg.id,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, action, asg.id, summary);
                    await loadAllFromDexie();
                  }}
                  onSaveTarget={async (tgt, isNew) => {
                    await db.cached_targets.put(tgt);
                    await enqueueSyncMutation('tahfidz_targets', tgt.id, 'upsert', tgt);
                    const action = isNew ? 'TARGET_ADDED' : 'TARGET_UPDATED';
                    const summary = `${isNew ? 'Target baru' : 'Pembaruan target'}: ${tgt.period_label} (${tgt.target_ayah_count} ayat)`;
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action,
                      target: tgt.id,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, action, tgt.id, summary);
                    await loadAllFromDexie();
                  }}
                  onCreateAnnouncement={async (ann) => {
                    const authored: Announcement = {
                      ...ann,
                      author_uid: activeUser.uid,
                      author_name: activeUser.display_name,
                    };
                    await db.cached_announcements.put(authored);
                    await enqueueSyncMutation('announcements', authored.id, 'upsert', authored);
                    const summary = `Pengumuman diterbitkan: ${authored.title}`;
                    await appendAuditLog({
                      actor_uid: activeUser.uid,
                      actor_name: activeUser.display_name,
                      actor_role: activeUser.role,
                      action: 'ANNOUNCEMENT_PUBLISHED',
                      target: authored.id,
                      summary,
                    });
                    void appendCloudAuditLog(activeUser, 'ANNOUNCEMENT_PUBLISHED', authored.id, summary);
                    await loadAllFromDexie();
                  }}
                  onToggleArchiveAnnouncement={async (id) => {
                    const item = await db.cached_announcements.get(id);
                    if (item) {
                      const updated = {
                        ...item,
                        is_archived: !item.is_archived,
                        updated_at: new Date().toISOString(),
                      };
                      await db.cached_announcements.put(updated);
                      await enqueueSyncMutation('announcements', updated.id, 'upsert', updated);
                      const summary = `${updated.is_archived ? 'Mengarsipkan' : 'Mengaktifkan'} pengumuman ${updated.title}`;
                      await appendAuditLog({
                        actor_uid: activeUser.uid,
                        actor_name: activeUser.display_name,
                        actor_role: activeUser.role,
                        action: 'ANNOUNCEMENT_ARCHIVE_TOGGLED',
                        target: updated.id,
                        summary,
                      });
                      void appendCloudAuditLog(
                        activeUser,
                        'ANNOUNCEMENT_ARCHIVE_TOGGLED',
                        updated.id,
                        summary
                      );
                      await loadAllFromDexie();
                    }
                  }}
                  onUpdateSyncSettings={async (enabled, intervalMin) => {
                    const updated: SchoolSettings = {
                      ...settings,
                      auto_sync_enabled: enabled,
                      sync_interval_minutes: intervalMin,
                      updated_by: activeUser.display_name,
                      updated_at: new Date().toISOString(),
                    };
                    await db.school_settings.put(updated);
                    if (isAuthenticatedActive) {
                      await enqueueSyncMutation('school_settings', SCHOOL_ID, 'upsert', updated);
                    }
                    await loadAllFromDexie();
                  }}
                  onRunManualSync={() => runSyncCycle('manual')}
                  onRestoreComplete={loadAllFromDexie}
                  onRefreshCloudUsers={async () => {
                    const list = await fetchUsersForSuperAdmin();
                    setCloudUsers(list);
                  }}
                  onUpdateUserRole={async (targetUid, nextRole, isActive, linkedId) => {
                    await updateUserRoleAndStatus(
                      targetUid,
                      nextRole,
                      isActive,
                      linkedId,
                      activeUser
                    );
                    const list = await fetchUsersForSuperAdmin();
                    setCloudUsers(list);
                    await loadAllFromDexie();
                  }}
                  onSeedCloudSchoolData={async () => {
                    await seedInitialSchoolDataToFirestore(
                      activeUser,
                      classes,
                      halaqahs,
                      students,
                      guardians,
                      assignments,
                      targets,
                      announcements
                    );
                    await loadAllFromDexie();
                  }}
                />
              )}
          </main>
        </div>
      )}
    </div>
  );
}
