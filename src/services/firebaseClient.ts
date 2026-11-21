import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  DocumentData,
  Query,
  QuerySnapshot,
  Timestamp,
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  APP_VERSION,
  Announcement,
  AnnouncementRead,
  AuditLogEntry,
  ClassRoom,
  Guardian,
  Halaqah,
  MemorizationRecord,
  MurajaahRecord,
  PendingSyncItem,
  QualityGrade,
  QuizResult,
  SCHOOL_ID,
  SCHOOL_NAME,
  SCHOOL_SLOGAN,
  SUPER_ADMIN_EMAIL,
  SchoolSettings,
  Student,
  TahfidzTarget,
  TeacherAssignment,
  UserAccount,
  UserRole,
} from '../types/simtaq';
import { BLUEPRINT_LIMITS, isValidFirestoreId, sanitizeFirestoreString } from '../utils/firestoreSecurityValidator';

const app = initializeApp(firebaseConfig);
export const dbFirestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testConnection(): Promise<{ reachable: boolean; offlineError?: string }> {
  if (connectionTested) return { reachable: true };
  connectionTested = true;
  try {
    await getDocFromServer(doc(dbFirestore, 'test', 'connection'));
    return { reachable: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { reachable: false, offlineError: error.message };
    }
    return { reachable: true };
  }
}

export function subscribeAuthState(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGooglePopup(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  if (!credential.user.emailVerified) {
    await signOut(auth);
    throw new Error('Akun Google Anda belum memiliki email terverifikasi.');
  }
  return credential.user;
}

export async function signOutSimtaq(): Promise<void> {
  await signOut(auth);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

export interface AuthSessionResolution {
  profile: UserAccount;
  superAdminBootstrappedNow: boolean;
  bootstrapBlockedMismatch?: boolean;
  bootstrapUid?: string;
}

/**
 * Resolves the verified Firebase Auth user against Firestore:
 * - If dwiariwibowo313@gmail.com (emailVerified === true) and /system_bootstrap/super_admin
 *   does not yet exist, performs an atomic one-time writeBatch creating
 *   /system_bootstrap/super_admin + /admins/{uid} + /users/{uid} + initial school_settings.
 * - For any other verified Google user without a /users/{uid} doc, creates a pending
 *   non-privileged account (is_active: false, role: 'student') awaiting admin activation.
 */
export async function resolveAuthenticatedUserProfile(user: User): Promise<AuthSessionResolution> {
  if (!user.emailVerified || !user.email) {
    throw new Error('Email akun Google harus terverifikasi sebelum mengakses SIMTAQ.');
  }
  if (!isValidFirestoreId(user.uid)) {
    throw new Error('Format UID akun tidak valid.');
  }

  const emailLower = user.email.toLowerCase();
  const bootstrapRef = doc(dbFirestore, 'system_bootstrap', 'super_admin');
  const userRef = doc(dbFirestore, 'users', user.uid);
  const adminRef = doc(dbFirestore, 'admins', user.uid);

  if (emailLower === SUPER_ADMIN_EMAIL) {
    let bootstrapSnap;
    try {
      bootstrapSnap = await getDocFromServer(bootstrapRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'system_bootstrap/super_admin');
    }

    if (!bootstrapSnap.exists()) {
      const displayName = sanitizeFirestoreString(
        user.displayName || 'Dwi Apriyono Ariwibowo, S.Pd.',
        BLUEPRINT_LIMITS.displayNameMaxLength
      );
      const batch = writeBatch(dbFirestore);

      // Atomic 3-document bootstrap (enforced mutually via existsAfter in firestore.rules)
      batch.set(bootstrapRef, {
        super_admin_uid: user.uid,
        email: SUPER_ADMIN_EMAIL,
        school_id: SCHOOL_ID,
        bootstrapped_at: serverTimestamp(),
      });
      batch.set(adminRef, {
        uid: user.uid,
        role: 'super_admin',
        school_id: SCHOOL_ID,
        created_at: serverTimestamp(),
      });
      batch.set(userRef, {
        uid: user.uid,
        email: SUPER_ADMIN_EMAIL,
        display_name: displayName,
        role: 'super_admin',
        school_id: SCHOOL_ID,
        is_active: true,
        linked_entity_id: '',
        email_verified: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'system_bootstrap/super_admin');
      }

      // Post-bootstrap setup: runs after system_bootstrap/super_admin & admins/{uid} exist so isAdmin() succeeds
      try {
        const settingsRef = doc(dbFirestore, 'school_settings', SCHOOL_ID);
        const existingSettings = await getDoc(settingsRef);
        if (!existingSettings.exists()) {
          await setDoc(settingsRef, {
            id: SCHOOL_ID,
            school_id: SCHOOL_ID,
            school_name: SCHOOL_NAME,
            slogan: SCHOOL_SLOGAN,
            app_version: APP_VERSION,
            auto_sync_enabled: true,
            sync_interval_minutes: 10,
            updated_by: displayName,
            updated_at: serverTimestamp(),
          });
        }
        const auditId = `aud_boot_${Date.now()}`;
        await setDoc(doc(dbFirestore, 'audit_logs', auditId), {
          id: auditId,
          school_id: SCHOOL_ID,
          actor_uid: user.uid,
          actor_name: displayName,
          actor_role: 'super_admin',
          action: 'SUPER_ADMIN_ATOMIC_BOOTSTRAP',
          target: 'system_bootstrap/super_admin',
          summary: `Bootstrap atomic satu kali berhasil untuk ${SUPER_ADMIN_EMAIL}`,
          timestamp: serverTimestamp(),
        });
      } catch (postError) {
        console.warn('Post-bootstrap setup deferred:', postError);
      }

      return {
        profile: {
          uid: user.uid,
          email: SUPER_ADMIN_EMAIL,
          display_name: displayName,
          role: 'super_admin',
          school_id: SCHOOL_ID,
          is_active: true,
          linked_entity_id: '',
          email_verified: true,
          created_at: new Date().toISOString(),
        },
        superAdminBootstrappedNow: true,
        bootstrapUid: user.uid,
      };
    }

    const bData = bootstrapSnap.data();
    if (bData?.super_admin_uid !== user.uid) {
      return {
        profile: {
          uid: user.uid,
          email: emailLower,
          display_name: sanitizeFirestoreString(user.displayName || emailLower, 120),
          role: 'student',
          school_id: SCHOOL_ID,
          is_active: false,
          email_verified: true,
          created_at: new Date().toISOString(),
        },
        superAdminBootstrappedNow: false,
        bootstrapBlockedMismatch: true,
        bootstrapUid: String(bData?.super_admin_uid ?? ''),
      };
    }
  }

  // Read existing /users/{uid}
  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
  }

  if (userSnap.exists()) {
    const d = userSnap.data();
    return {
      profile: {
        uid: String(d.uid),
        email: String(d.email),
        display_name: String(d.display_name),
        role: d.role as UserRole,
        school_id: SCHOOL_ID,
        is_active: Boolean(d.is_active),
        linked_entity_id: typeof d.linked_entity_id === 'string' ? d.linked_entity_id : '',
        email_verified: Boolean(d.email_verified),
        created_at: toIsoString(d.created_at),
      },
      superAdminBootstrappedNow: false,
    };
  }

  // First login for non-Super-Admin: create pending non-privileged profile only
  const displayName = sanitizeFirestoreString(
    user.displayName || emailLower.split('@')[0] || 'Pengguna Baru',
    BLUEPRINT_LIMITS.displayNameMaxLength
  );
  const newUserDoc = {
    uid: user.uid,
    email: sanitizeFirestoreString(emailLower, BLUEPRINT_LIMITS.emailMaxLength),
    display_name: displayName,
    role: 'student' as UserRole,
    school_id: SCHOOL_ID,
    is_active: false,
    linked_entity_id: '',
    email_verified: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  try {
    await setDoc(userRef, newUserDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
  }

  return {
    profile: {
      uid: user.uid,
      email: newUserDoc.email,
      display_name: displayName,
      role: 'student',
      school_id: SCHOOL_ID,
      is_active: false,
      linked_entity_id: '',
      email_verified: true,
      created_at: new Date().toISOString(),
    },
    superAdminBootstrappedNow: false,
  };
}

export async function fetchUsersForSuperAdmin(): Promise<UserAccount[]> {
  const path = 'users';
  try {
    const q = query(collection(dbFirestore, path), where('school_id', '==', SCHOOL_ID));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        uid: String(d.uid),
        email: String(d.email),
        display_name: String(d.display_name),
        role: d.role as UserRole,
        school_id: SCHOOL_ID,
        is_active: Boolean(d.is_active),
        linked_entity_id: typeof d.linked_entity_id === 'string' ? d.linked_entity_id : '',
        email_verified: Boolean(d.email_verified),
        created_at: toIsoString(d.created_at),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateUserRoleAndStatus(
  targetUid: string,
  nextRole: Exclude<UserRole, 'super_admin'>,
  isActive: boolean,
  linkedEntityId: string,
  actor: UserAccount
): Promise<void> {
  if (!isValidFirestoreId(targetUid)) {
    throw new Error('UID pengguna tidak valid.');
  }
  const userPath = `users/${targetUid}`;
  const adminRef = doc(dbFirestore, 'admins', targetUid);
  const userRef = doc(dbFirestore, 'users', targetUid);
  const auditId = `aud_role_${Date.now()}`;
  const batch = writeBatch(dbFirestore);

  batch.update(userRef, {
    role: nextRole,
    is_active: isActive,
    linked_entity_id: sanitizeFirestoreString(linkedEntityId, BLUEPRINT_LIMITS.idMaxLength),
    updated_at: serverTimestamp(),
  });

  if (nextRole === 'school_admin' && isActive) {
    batch.set(adminRef, {
      uid: targetUid,
      role: 'school_admin',
      school_id: SCHOOL_ID,
      created_at: serverTimestamp(),
    });
  } else {
    batch.delete(adminRef);
  }

  batch.set(doc(dbFirestore, 'audit_logs', auditId), {
    id: auditId,
    school_id: SCHOOL_ID,
    actor_uid: actor.uid,
    actor_name: sanitizeFirestoreString(actor.display_name, BLUEPRINT_LIMITS.displayNameMaxLength),
    actor_role: actor.role,
    action: 'USER_ROLE_UPDATED',
    target: targetUid,
    summary: `Peran diatur ke ${nextRole} (${isActive ? 'aktif' : 'nonaktif'})`,
    timestamp: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export interface SyncContextData {
  adminUids?: string[];
  users?: UserAccount[];
  assignments?: TeacherAssignment[];
  students?: Student[];
}

function resolveAdminUids(actorUid: string, context?: SyncContextData): string[] {
  const set = new Set<string>();
  if (isValidFirestoreId(actorUid)) set.add(actorUid);
  for (const uid of context?.adminUids ?? []) {
    if (isValidFirestoreId(uid)) set.add(uid);
  }
  for (const u of context?.users ?? []) {
    if ((u.role === 'super_admin' || u.role === 'school_admin') && u.is_active && isValidFirestoreId(u.uid)) {
      set.add(u.uid);
    }
  }
  return Array.from(set).slice(0, 10);
}

function resolveStudentLinks(
  student: Pick<Student, 'id' | 'class_id' | 'halaqah_id' | 'guardian_ids'>,
  actorUid: string,
  context?: SyncContextData
): { studentUid: string; guardianUids: string[]; assignedTeacherUids: string[] } {
  const users = context?.users ?? [];
  const assignments = context?.assignments ?? [];

  const studentUser = users.find(
    (u) => u.role === 'student' && u.is_active && u.linked_entity_id === student.id && isValidFirestoreId(u.uid)
  );

  const guardianUids = users
    .filter(
      (u) =>
        u.role === 'guardian' &&
        u.is_active &&
        u.linked_entity_id &&
        student.guardian_ids.includes(u.linked_entity_id) &&
        isValidFirestoreId(u.uid)
    )
    .map((u) => u.uid)
    .slice(0, BLUEPRINT_LIMITS.maxGuardiansPerStudent);

  const teacherSet = new Set<string>();
  for (const asg of assignments) {
    if (
      (asg.student_ids.includes(student.id) ||
        asg.class_ids.includes(student.class_id) ||
        asg.halaqah_ids.includes(student.halaqah_id)) &&
      isValidFirestoreId(asg.teacher_uid)
    ) {
      teacherSet.add(asg.teacher_uid);
    }
  }
  if (teacherSet.size === 0 && isValidFirestoreId(actorUid)) {
    teacherSet.add(actorUid);
  }

  return {
    studentUid: studentUser?.uid ?? '',
    guardianUids,
    assignedTeacherUids: Array.from(teacherSet).slice(0, BLUEPRINT_LIMITS.maxAssignedTeachers),
  };
}

function buildSanitizedFirestorePayload(
  item: PendingSyncItem,
  actorUid: string,
  context?: SyncContextData
): {
  path: string;
  createData: Record<string, unknown>;
  updateData?: Record<string, unknown>;
  immutableCreateOnly?: boolean;
} | null {
  const p = item.payload as Record<string, unknown>;
  if (!isValidFirestoreId(item.doc_id)) return null;
  const adminUids = resolveAdminUids(actorUid, context);

  if (item.collection === 'school_settings') {
    const s = p as unknown as SchoolSettings;
    const baseData: Record<string, unknown> = {
      id: SCHOOL_ID,
      school_id: SCHOOL_ID,
      school_name: sanitizeFirestoreString(s.school_name || SCHOOL_NAME, BLUEPRINT_LIMITS.schoolNameMaxLength),
      slogan: sanitizeFirestoreString(s.slogan || SCHOOL_SLOGAN, BLUEPRINT_LIMITS.sloganMaxLength),
      ...(s.logo_data_url && s.logo_data_url.length <= BLUEPRINT_LIMITS.logoDataUrlMaxLength
        ? { logo_data_url: s.logo_data_url }
        : {}),
      app_version: sanitizeFirestoreString(s.app_version || APP_VERSION, 32),
      auto_sync_enabled: Boolean(s.auto_sync_enabled),
      sync_interval_minutes: Math.max(1, Math.min(120, Number(s.sync_interval_minutes || 10))),
      updated_by: sanitizeFirestoreString(s.updated_by || 'Admin', BLUEPRINT_LIMITS.displayNameMaxLength),
      updated_at: serverTimestamp(),
    };
    return {
      path: `school_settings/${SCHOOL_ID}`,
      createData: baseData,
      updateData: {
        school_name: baseData.school_name,
        slogan: baseData.slogan,
        ...(baseData.logo_data_url ? { logo_data_url: baseData.logo_data_url } : {}),
        app_version: baseData.app_version,
        auto_sync_enabled: baseData.auto_sync_enabled,
        sync_interval_minutes: baseData.sync_interval_minutes,
        updated_by: baseData.updated_by,
        updated_at: serverTimestamp(),
      },
    };
  }

  if (item.collection === 'classes') {
    const cls = p as unknown as ClassRoom;
    const data: Record<string, unknown> = {
      id: item.doc_id,
      school_id: SCHOOL_ID,
      name: sanitizeFirestoreString(cls.name, 80),
      grade_level: Math.max(1, Math.min(6, Number(cls.grade_level || 1))),
      academic_year: sanitizeFirestoreString(cls.academic_year || '2026/2027', 20),
      ...(cls.homeroom_teacher_id
        ? { homeroom_teacher_id: sanitizeFirestoreString(cls.homeroom_teacher_id, 128) }
        : {}),
    };
    return {
      path: `classes/${item.doc_id}`,
      createData: data,
      updateData: {
        name: data.name,
        grade_level: data.grade_level,
        academic_year: data.academic_year,
        ...(data.homeroom_teacher_id !== undefined
          ? { homeroom_teacher_id: data.homeroom_teacher_id }
          : {}),
      },
    };
  }

  if (item.collection === 'halaqahs') {
    const hal = p as unknown as Halaqah;
    const data: Record<string, unknown> = {
      id: item.doc_id,
      school_id: SCHOOL_ID,
      name: sanitizeFirestoreString(hal.name, 100),
      teacher_id: sanitizeFirestoreString(hal.teacher_id || actorUid, 128),
      class_ids: (hal.class_ids ?? []).slice(0, 20),
      schedule_note: sanitizeFirestoreString(hal.schedule_note ?? '', 200),
    };
    return {
      path: `halaqahs/${item.doc_id}`,
      createData: data,
      updateData: {
        name: data.name,
        teacher_id: data.teacher_id,
        class_ids: data.class_ids,
        schedule_note: data.schedule_note,
      },
    };
  }

  if (item.collection === 'teacher_assignments') {
    const asg = p as unknown as TeacherAssignment;
    const teacherUid = isValidFirestoreId(asg.teacher_uid) ? asg.teacher_uid : actorUid;
    const data: Record<string, unknown> = {
      id: item.doc_id,
      school_id: SCHOOL_ID,
      teacher_uid: teacherUid,
      teacher_name: sanitizeFirestoreString(asg.teacher_name, 120),
      class_ids: (asg.class_ids ?? []).slice(0, 20),
      halaqah_ids: (asg.halaqah_ids ?? []).slice(0, 20),
      student_ids: (asg.student_ids ?? []).slice(0, 50),
      admin_uids: adminUids,
      can_announce: Boolean(asg.can_announce),
      can_manage_guardian_contacts: Boolean(asg.can_manage_guardian_contacts),
    };
    return {
      path: `teacher_assignments/${item.doc_id}`,
      createData: data,
      updateData: {
        teacher_name: data.teacher_name,
        class_ids: data.class_ids,
        halaqah_ids: data.halaqah_ids,
        student_ids: data.student_ids,
        admin_uids: data.admin_uids,
        can_announce: data.can_announce,
        can_manage_guardian_contacts: data.can_manage_guardian_contacts,
      },
    };
  }

  if (item.collection === 'tahfidz_targets') {
    const tgt = p as unknown as TahfidzTarget;
    const ayahStart = Math.max(1, Number(tgt.ayah_start || 1));
    const ayahEnd = Math.max(ayahStart, Number(tgt.ayah_end || ayahStart));
    const data: Record<string, unknown> = {
      id: item.doc_id,
      school_id: SCHOOL_ID,
      scope: tgt.scope,
      target_ref_id: sanitizeFirestoreString(tgt.target_ref_id, 128),
      period_label: sanitizeFirestoreString(tgt.period_label, 120),
      start_date: sanitizeFirestoreString(tgt.start_date, 32),
      end_date: sanitizeFirestoreString(tgt.end_date, 32),
      surah_number: Math.max(1, Math.min(114, Number(tgt.surah_number || 114))),
      ayah_start: ayahStart,
      ayah_end: ayahEnd,
      target_ayah_count: Math.max(1, Math.min(6236, Number(tgt.target_ayah_count || 1))),
    };
    return {
      path: `tahfidz_targets/${item.doc_id}`,
      createData: data,
      updateData: {
        scope: data.scope,
        target_ref_id: data.target_ref_id,
        period_label: data.period_label,
        start_date: data.start_date,
        end_date: data.end_date,
        surah_number: data.surah_number,
        ayah_start: data.ayah_start,
        ayah_end: data.ayah_end,
        target_ayah_count: data.target_ayah_count,
      },
    };
  }

  if (item.collection === 'students') {
    const stu = p as unknown as Student;
    const links = resolveStudentLinks(stu, actorUid, context);
    const mutable = {
      nis_local: sanitizeFirestoreString(stu.nis_local, 32),
      full_name: sanitizeFirestoreString(stu.full_name, 120),
      class_id: sanitizeFirestoreString(stu.class_id, 128),
      halaqah_id: sanitizeFirestoreString(stu.halaqah_id, 128),
      guardian_ids: (stu.guardian_ids ?? []).slice(0, BLUEPRINT_LIMITS.maxGuardiansPerStudent),
      guardian_uids: links.guardianUids,
      assigned_teacher_uids: links.assignedTeacherUids,
      admin_uids: adminUids,
      ...(links.studentUid ? { student_uid: links.studentUid } : {}),
      status: stu.status ?? 'aktif',
    };
    return {
      path: `students/${item.doc_id}`,
      createData: {
        id: item.doc_id,
        school_id: SCHOOL_ID,
        ...mutable,
      },
      updateData: mutable,
    };
  }

  if (item.collection === 'guardians') {
    const grd = p as unknown as Guardian;
    const users = context?.users ?? [];
    const guardianUser = users.find(
      (u) => u.role === 'guardian' && u.is_active && u.linked_entity_id === grd.id && isValidFirestoreId(u.uid)
    );
    const teacherSet = new Set<string>();
    for (const sid of grd.student_ids ?? []) {
      const stu = context?.students?.find((s) => s.id === sid);
      if (stu) {
        for (const tUid of resolveStudentLinks(stu, actorUid, context).assignedTeacherUids) {
          teacherSet.add(tUid);
        }
      }
    }
    if (teacherSet.size === 0 && isValidFirestoreId(actorUid)) {
      teacherSet.add(actorUid);
    }

    const createData: Record<string, unknown> = {
      id: item.doc_id,
      school_id: SCHOOL_ID,
      full_name: sanitizeFirestoreString(grd.full_name, 120),
      relationship: grd.relationship,
      whatsapp_raw: sanitizeFirestoreString(grd.whatsapp_raw, 32),
      whatsapp_e164: sanitizeFirestoreString(grd.whatsapp_e164, 24),
      verification_status: grd.verification_status,
      communication_consent: Boolean(grd.communication_consent),
      consent_updated_at: sanitizeFirestoreString(grd.consent_updated_at ?? '', 64),
      student_ids: (grd.student_ids ?? []).slice(0, 10),
      assigned_teacher_uids: Array.from(teacherSet).slice(0, 10),
      admin_uids: adminUids,
      ...(guardianUser ? { guardian_uid: guardianUser.uid } : {}),
      updated_at: serverTimestamp(),
    };
    return {
      path: `guardians/${item.doc_id}`,
      createData,
      updateData: {
        full_name: createData.full_name,
        relationship: createData.relationship,
        whatsapp_raw: createData.whatsapp_raw,
        whatsapp_e164: createData.whatsapp_e164,
        verification_status: createData.verification_status,
        communication_consent: createData.communication_consent,
        consent_updated_at: createData.consent_updated_at,
        student_ids: createData.student_ids,
        assigned_teacher_uids: createData.assigned_teacher_uids,
        admin_uids: createData.admin_uids,
        ...(guardianUser ? { guardian_uid: guardianUser.uid } : {}),
        updated_at: serverTimestamp(),
      },
    };
  }

  if (item.collection === 'memorization_records') {
    const rec = p as unknown as MemorizationRecord;
    const stu = context?.students?.find((s) => s.id === rec.student_id);
    const links = stu
      ? resolveStudentLinks(stu, actorUid, context)
      : { studentUid: '', guardianUids: [], assignedTeacherUids: [actorUid] };
    const teacherUid = isValidFirestoreId(rec.teacher_uid) ? rec.teacher_uid : actorUid;
    const commonGradeFields: Record<string, unknown> = {
      ...(rec.kelancaran ? { kelancaran: sanitizeFirestoreString(rec.kelancaran, 48) } : {}),
      ...(rec.ketepatan_bacaan
        ? { ketepatan_bacaan: sanitizeFirestoreString(rec.ketepatan_bacaan, 48) }
        : {}),
      ...(rec.tajwid ? { tajwid: sanitizeFirestoreString(rec.tajwid, 48) } : {}),
      ...(rec.makhraj ? { makhraj: sanitizeFirestoreString(rec.makhraj, 48) } : {}),
      status: rec.status,
      ...(rec.teacher_note
        ? { teacher_note: sanitizeFirestoreString(rec.teacher_note, BLUEPRINT_LIMITS.teacherNoteMaxLength) }
        : {}),
      whatsapp_share_status: rec.whatsapp_share_status ?? 'belum_dibagikan',
      ...(rec.whatsapp_shared_at
        ? { whatsapp_shared_at: sanitizeFirestoreString(rec.whatsapp_shared_at, 64) }
        : {}),
      updated_at: serverTimestamp(),
    };
    return {
      path: `memorization_records/${item.doc_id}`,
      createData: {
        id: item.doc_id,
        school_id: SCHOOL_ID,
        student_id: sanitizeFirestoreString(rec.student_id, 128),
        ...(links.studentUid ? { student_uid: links.studentUid } : {}),
        guardian_uids: links.guardianUids,
        admin_uids: adminUids,
        teacher_uid: teacherUid,
        teacher_name: sanitizeFirestoreString(rec.teacher_name, 120),
        class_id: sanitizeFirestoreString(rec.class_id, 128),
        halaqah_id: sanitizeFirestoreString(rec.halaqah_id, 128),
        date: sanitizeFirestoreString(rec.date, 32),
        surah_number: Number(rec.surah_number),
        surah_name: sanitizeFirestoreString(rec.surah_name, 64),
        ayah_start: Number(rec.ayah_start),
        ayah_end: Number(rec.ayah_end),
        unique_ayah_keys: (rec.unique_ayah_keys ?? []).slice(0, BLUEPRINT_LIMITS.maxUniqueAyahKeys),
        ...commonGradeFields,
        created_at: serverTimestamp(),
      },
      updateData: commonGradeFields,
    };
  }

  if (item.collection === 'murajaah_records') {
    const mrj = p as unknown as MurajaahRecord;
    const stu = context?.students?.find((s) => s.id === mrj.student_id);
    const links = stu
      ? resolveStudentLinks(stu, actorUid, context)
      : { studentUid: '', guardianUids: [], assignedTeacherUids: [actorUid] };
    const teacherUid = isValidFirestoreId(mrj.teacher_uid) ? mrj.teacher_uid : actorUid;
    const commonGradeFields: Record<string, unknown> = {
      ...(mrj.kelancaran ? { kelancaran: sanitizeFirestoreString(mrj.kelancaran, 48) } : {}),
      ...(mrj.ketepatan_bacaan
        ? { ketepatan_bacaan: sanitizeFirestoreString(mrj.ketepatan_bacaan, 48) }
        : {}),
      ...(mrj.tajwid ? { tajwid: sanitizeFirestoreString(mrj.tajwid, 48) } : {}),
      ...(mrj.makhraj ? { makhraj: sanitizeFirestoreString(mrj.makhraj, 48) } : {}),
      status: mrj.status,
      ...(mrj.teacher_note
        ? { teacher_note: sanitizeFirestoreString(mrj.teacher_note, BLUEPRINT_LIMITS.teacherNoteMaxLength) }
        : {}),
      whatsapp_share_status: mrj.whatsapp_share_status ?? 'belum_dibagikan',
      ...(mrj.whatsapp_shared_at
        ? { whatsapp_shared_at: sanitizeFirestoreString(mrj.whatsapp_shared_at, 64) }
        : {}),
      updated_at: serverTimestamp(),
    };
    return {
      path: `murajaah_records/${item.doc_id}`,
      createData: {
        id: item.doc_id,
        school_id: SCHOOL_ID,
        student_id: sanitizeFirestoreString(mrj.student_id, 128),
        ...(links.studentUid ? { student_uid: links.studentUid } : {}),
        guardian_uids: links.guardianUids,
        admin_uids: adminUids,
        teacher_uid: teacherUid,
        teacher_name: sanitizeFirestoreString(mrj.teacher_name, 120),
        class_id: sanitizeFirestoreString(mrj.class_id, 128),
        halaqah_id: sanitizeFirestoreString(mrj.halaqah_id, 128),
        date: sanitizeFirestoreString(mrj.date, 32),
        surah_number: Number(mrj.surah_number),
        surah_name: sanitizeFirestoreString(mrj.surah_name, 64),
        ayah_start: Number(mrj.ayah_start),
        ayah_end: Number(mrj.ayah_end),
        ...commonGradeFields,
        created_at: serverTimestamp(),
      },
      updateData: commonGradeFields,
    };
  }

  if (item.collection === 'announcements') {
    const ann = p as unknown as Announcement;
    const mutable = {
      title: sanitizeFirestoreString(ann.title, BLUEPRINT_LIMITS.announcementTitleMaxLength),
      body: sanitizeFirestoreString(ann.body, BLUEPRINT_LIMITS.announcementBodyMaxLength),
      category: sanitizeFirestoreString(ann.category, 64),
      priority: ann.priority,
      target_audience: ann.target_audience,
      ...(ann.target_ref_id ? { target_ref_id: sanitizeFirestoreString(ann.target_ref_id, 128) } : {}),
      start_at: sanitizeFirestoreString(ann.start_at, 64),
      end_at: sanitizeFirestoreString(ann.end_at, 64),
      is_published: Boolean(ann.is_published),
      is_archived: Boolean(ann.is_archived),
      updated_at: serverTimestamp(),
    };
    return {
      path: `announcements/${item.doc_id}`,
      createData: {
        id: item.doc_id,
        school_id: SCHOOL_ID,
        ...mutable,
        author_uid: actorUid,
        author_name: sanitizeFirestoreString(ann.author_name, 120),
        created_at: serverTimestamp(),
      },
      updateData: mutable,
    };
  }

  if (item.collection === 'announcement_reads') {
    const rd = p as unknown as AnnouncementRead;
    return {
      path: `announcement_reads/${item.doc_id}`,
      immutableCreateOnly: true,
      createData: {
        id: item.doc_id,
        announcement_id: sanitizeFirestoreString(rd.announcement_id, 128),
        user_uid: actorUid,
        read_at: serverTimestamp(),
      },
    };
  }

  if (item.collection === 'quiz_results') {
    const qr = p as unknown as QuizResult;
    return {
      path: `quiz_results/${item.doc_id}`,
      immutableCreateOnly: true,
      createData: {
        id: item.doc_id,
        school_id: SCHOOL_ID,
        student_id: sanitizeFirestoreString(qr.student_id, 128),
        owner_uid: actorUid,
        admin_uids: adminUids,
        module: qr.module,
        package_title: sanitizeFirestoreString(qr.package_title, 160),
        total_questions: Number(qr.total_questions),
        correct_count: Number(qr.correct_count),
        accuracy_percent: Number(qr.accuracy_percent),
        duration_seconds: Number(qr.duration_seconds),
        weak_topics: (qr.weak_topics ?? []).slice(0, 20),
        weak_surahs: (qr.weak_surahs ?? []).slice(0, 37),
        completed_at: serverTimestamp(),
      },
    };
  }

  return null;
}

export async function flushPendingSyncToFirestore(
  pendingItems: PendingSyncItem[],
  actorUid: string,
  context?: SyncContextData
): Promise<{ syncedIds: string[]; failedCount: number; lastError?: string }> {
  if (!auth.currentUser || pendingItems.length === 0) {
    return { syncedIds: [], failedCount: 0 };
  }

  const syncedIds: string[] = [];
  let failedCount = 0;
  let lastError: string | undefined;

  for (const item of pendingItems) {
    const target = buildSanitizedFirestorePayload(item, actorUid, context);
    if (!target) {
      syncedIds.push(item.id);
      continue;
    }
    try {
      const ref = doc(dbFirestore, target.path);
      if (item.operation === 'delete') {
        await deleteDoc(ref);
        syncedIds.push(item.id);
        continue;
      }

      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        if (target.immutableCreateOnly) {
          // Document already exists on immutable-create collections -> treat as already synced
          syncedIds.push(item.id);
          continue;
        }
        // For memorization/murajaah terminal state 'lulus', non-admins can only update WhatsApp fields
        const existingData = existingSnap.data();
        if (
          (item.collection === 'memorization_records' || item.collection === 'murajaah_records') &&
          existingData?.status === 'lulus' &&
          existingData?.teacher_uid === actorUid &&
          target.updateData
        ) {
          const shareOnlyPayload: Record<string, unknown> = {
            whatsapp_share_status: target.updateData.whatsapp_share_status,
            ...(target.updateData.whatsapp_shared_at
              ? { whatsapp_shared_at: target.updateData.whatsapp_shared_at }
              : {}),
            updated_at: serverTimestamp(),
          };
          await updateDoc(ref, shareOnlyPayload);
        } else {
          await updateDoc(ref, target.updateData ?? target.createData);
        }
      } else {
        await setDoc(ref, target.createData, { merge: false });
      }
      syncedIds.push(item.id);
    } catch (error) {
      failedCount += 1;
      lastError = error instanceof Error ? error.message : String(error);
      try {
        handleFirestoreError(error, OperationType.WRITE, target.path);
      } catch {
        // Logged via handleFirestoreError; retain in queue
      }
    }
  }

  return { syncedIds, failedCount, lastError };
}

export function subscribeAnnouncementsRealtime(
  onData: (items: Announcement[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'announcements';
  const q = query(collection(dbFirestore, path), where('school_id', '==', SCHOOL_ID));
  return onSnapshot(
    q,
    (snap) => {
      const list: Announcement[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          school_id: SCHOOL_ID,
          title: String(d.title ?? ''),
          body: String(d.body ?? ''),
          category: d.category,
          priority: d.priority,
          target_audience: d.target_audience,
          target_ref_id: typeof d.target_ref_id === 'string' ? d.target_ref_id : undefined,
          author_uid: String(d.author_uid ?? ''),
          author_name: String(d.author_name ?? ''),
          start_at: String(d.start_at ?? ''),
          end_at: String(d.end_at ?? ''),
          is_published: Boolean(d.is_published),
          is_archived: Boolean(d.is_archived),
          created_at: toIsoString(d.created_at),
          updated_at: toIsoString(d.updated_at),
        };
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function seedInitialSchoolDataToFirestore(
  actor: UserAccount,
  classes: ClassRoom[],
  halaqahs: Halaqah[],
  students: Student[],
  guardians: Guardian[],
  assignments: TeacherAssignment[],
  targets: TahfidzTarget[],
  announcements: Announcement[]
): Promise<void> {
  // Step 1: Commit classes and halaqahs first so student create exists() checks pass
  const batchParents = writeBatch(dbFirestore);
  for (const cls of classes) {
    batchParents.set(doc(dbFirestore, 'classes', cls.id), { ...cls, school_id: SCHOOL_ID });
  }
  for (const hal of halaqahs) {
    batchParents.set(doc(dbFirestore, 'halaqahs', hal.id), { ...hal, school_id: SCHOOL_ID });
  }
  try {
    await batchParents.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_initial_seed_parents');
  }

  // Step 2: Commit dependent entities and initial announcements
  const batch = writeBatch(dbFirestore);
  for (const stu of students) {
    batch.set(doc(dbFirestore, 'students', stu.id), {
      id: stu.id,
      school_id: SCHOOL_ID,
      nis_local: stu.nis_local,
      full_name: stu.full_name,
      class_id: stu.class_id,
      halaqah_id: stu.halaqah_id,
      guardian_ids: stu.guardian_ids.slice(0, 4),
      guardian_uids: [],
      assigned_teacher_uids: [actor.uid],
      admin_uids: [actor.uid],
      status: stu.status,
    });
  }
  for (const grd of guardians) {
    batch.set(doc(dbFirestore, 'guardians', grd.id), {
      id: grd.id,
      school_id: SCHOOL_ID,
      full_name: grd.full_name,
      relationship: grd.relationship,
      whatsapp_raw: grd.whatsapp_raw,
      whatsapp_e164: grd.whatsapp_e164,
      verification_status: grd.verification_status,
      communication_consent: grd.communication_consent,
      consent_updated_at: grd.consent_updated_at,
      student_ids: grd.student_ids.slice(0, 10),
      assigned_teacher_uids: [actor.uid],
      admin_uids: [actor.uid],
      updated_at: serverTimestamp(),
    });
  }
  for (const asg of assignments) {
    batch.set(doc(dbFirestore, 'teacher_assignments', asg.id), {
      ...asg,
      school_id: SCHOOL_ID,
      admin_uids: [actor.uid],
    });
  }
  for (const tgt of targets) {
    batch.set(doc(dbFirestore, 'tahfidz_targets', tgt.id), { ...tgt, school_id: SCHOOL_ID });
  }
  for (const ann of announcements) {
    batch.set(doc(dbFirestore, 'announcements', ann.id), {
      id: ann.id,
      school_id: SCHOOL_ID,
      title: sanitizeFirestoreString(ann.title, 160),
      body: sanitizeFirestoreString(ann.body, 1500),
      category: ann.category,
      priority: ann.priority,
      target_audience: ann.target_audience,
      ...(ann.target_ref_id ? { target_ref_id: ann.target_ref_id } : {}),
      author_uid: actor.uid,
      author_name: sanitizeFirestoreString(actor.display_name, 120),
      start_at: ann.start_at,
      end_at: ann.end_at,
      is_published: ann.is_published,
      is_archived: ann.is_archived,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  const auditId = `aud_seed_${Date.now()}`;
  batch.set(doc(dbFirestore, 'audit_logs', auditId), {
    id: auditId,
    school_id: SCHOOL_ID,
    actor_uid: actor.uid,
    actor_name: sanitizeFirestoreString(actor.display_name, 120),
    actor_role: actor.role,
    action: 'FIRESTORE_INITIAL_SCHOOL_SYNC',
    target: SCHOOL_ID,
    summary: `Sinkronisasi data awal SDN Jetiskarangpung 1 (${students.length} siswa, ${classes.length} kelas)`,
    timestamp: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_initial_seed');
  }
}

export async function fetchAuditLogsFromFirestore(): Promise<AuditLogEntry[]> {
  const path = 'audit_logs';
  try {
    const q = query(collection(dbFirestore, path), where('school_id', '==', SCHOOL_ID));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        actor_uid: String(d.actor_uid ?? ''),
        actor_name: String(d.actor_name ?? ''),
        actor_role: d.actor_role as UserRole,
        action: String(d.action ?? ''),
        target: String(d.target ?? ''),
        summary: String(d.summary ?? ''),
        timestamp: toIsoString(d.timestamp),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function appendCloudAuditLog(
  actor: UserAccount,
  action: string,
  target: string,
  summary: string
): Promise<void> {
  if (!auth.currentUser || !navigator.onLine) return;
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(dbFirestore, 'audit_logs', auditId), {
      id: auditId,
      school_id: SCHOOL_ID,
      actor_uid: actor.uid,
      actor_name: sanitizeFirestoreString(actor.display_name, BLUEPRINT_LIMITS.displayNameMaxLength),
      actor_role: actor.role,
      action: sanitizeFirestoreString(action, 80),
      target: sanitizeFirestoreString(target, 160),
      summary: sanitizeFirestoreString(summary, BLUEPRINT_LIMITS.auditSummaryMaxLength),
      timestamp: serverTimestamp(),
    });
  } catch {
    // Non-blocking audit log sync
  }
}

export interface HydratedSchoolData {
  settings?: SchoolSettings;
  classes: ClassRoom[];
  halaqahs: Halaqah[];
  students: Student[];
  guardians: Guardian[];
  assignments: TeacherAssignment[];
  targets: TahfidzTarget[];
  memorizationRecords: MemorizationRecord[];
  murajaahRecords: MurajaahRecord[];
  announcements: Announcement[];
  announcementReads: AnnouncementRead[];
  quizResults: QuizResult[];
}

async function safeGetDocs(
  q: Query<DocumentData>
): Promise<QuerySnapshot<DocumentData> | null> {
  try {
    return await getDocs(q);
  } catch {
    return null;
  }
}

export async function hydrateSchoolDataFromFirestore(
  profile: UserAccount
): Promise<HydratedSchoolData> {
  const baseSchoolFilter = where('school_id', '==', SCHOOL_ID);

  const [
    settingsSnap,
    classesSnap,
    halaqahsSnap,
    targetsSnap,
    announcementsSnap,
    readsSnap,
  ] = await Promise.all([
    safeGetDocs(query(collection(dbFirestore, 'school_settings'), baseSchoolFilter)),
    safeGetDocs(query(collection(dbFirestore, 'classes'), baseSchoolFilter)),
    safeGetDocs(query(collection(dbFirestore, 'halaqahs'), baseSchoolFilter)),
    safeGetDocs(query(collection(dbFirestore, 'tahfidz_targets'), baseSchoolFilter)),
    safeGetDocs(query(collection(dbFirestore, 'announcements'), baseSchoolFilter)),
    safeGetDocs(
      query(collection(dbFirestore, 'announcement_reads'), where('user_uid', '==', profile.uid))
    ),
  ]);

  // Role-scoped queries strictly matching firestore.rules allow list
  let studentsQuery: Query<DocumentData> | null = null;
  let guardiansQuery: Query<DocumentData> | null = null;
  let assignmentsQuery: Query<DocumentData> | null = null;
  let memQuery: Query<DocumentData> | null = null;
  let mrjQuery: Query<DocumentData> | null = null;
  let quizQuery: Query<DocumentData> | null = null;

  if (profile.role === 'super_admin') {
    studentsQuery = query(collection(dbFirestore, 'students'), baseSchoolFilter);
    guardiansQuery = query(collection(dbFirestore, 'guardians'), baseSchoolFilter);
    assignmentsQuery = query(collection(dbFirestore, 'teacher_assignments'), baseSchoolFilter);
    memQuery = query(collection(dbFirestore, 'memorization_records'), baseSchoolFilter);
    mrjQuery = query(collection(dbFirestore, 'murajaah_records'), baseSchoolFilter);
    quizQuery = query(collection(dbFirestore, 'quiz_results'), baseSchoolFilter);
  } else if (profile.role === 'school_admin') {
    const adminFilter = where('admin_uids', 'array-contains', profile.uid);
    studentsQuery = query(collection(dbFirestore, 'students'), baseSchoolFilter, adminFilter);
    guardiansQuery = query(collection(dbFirestore, 'guardians'), baseSchoolFilter, adminFilter);
    assignmentsQuery = query(collection(dbFirestore, 'teacher_assignments'), baseSchoolFilter, adminFilter);
    memQuery = query(collection(dbFirestore, 'memorization_records'), baseSchoolFilter, adminFilter);
    mrjQuery = query(collection(dbFirestore, 'murajaah_records'), baseSchoolFilter, adminFilter);
    quizQuery = query(collection(dbFirestore, 'quiz_results'), baseSchoolFilter, adminFilter);
  } else if (profile.role === 'teacher') {
    const teacherArrFilter = where('assigned_teacher_uids', 'array-contains', profile.uid);
    const teacherEqFilter = where('teacher_uid', '==', profile.uid);
    studentsQuery = query(collection(dbFirestore, 'students'), baseSchoolFilter, teacherArrFilter);
    guardiansQuery = query(collection(dbFirestore, 'guardians'), baseSchoolFilter, teacherArrFilter);
    assignmentsQuery = query(collection(dbFirestore, 'teacher_assignments'), baseSchoolFilter, teacherEqFilter);
    memQuery = query(collection(dbFirestore, 'memorization_records'), baseSchoolFilter, teacherEqFilter);
    mrjQuery = query(collection(dbFirestore, 'murajaah_records'), baseSchoolFilter, teacherEqFilter);
    quizQuery = query(collection(dbFirestore, 'quiz_results'), baseSchoolFilter, where('owner_uid', '==', profile.uid));
  } else if (profile.role === 'student') {
    const stuFilter = where('student_uid', '==', profile.uid);
    studentsQuery = query(collection(dbFirestore, 'students'), baseSchoolFilter, stuFilter);
    memQuery = query(collection(dbFirestore, 'memorization_records'), baseSchoolFilter, stuFilter);
    mrjQuery = query(collection(dbFirestore, 'murajaah_records'), baseSchoolFilter, stuFilter);
    quizQuery = query(collection(dbFirestore, 'quiz_results'), baseSchoolFilter, where('owner_uid', '==', profile.uid));
  } else if (profile.role === 'guardian') {
    const grdArrFilter = where('guardian_uids', 'array-contains', profile.uid);
    studentsQuery = query(collection(dbFirestore, 'students'), baseSchoolFilter, grdArrFilter);
    guardiansQuery = query(collection(dbFirestore, 'guardians'), baseSchoolFilter, where('guardian_uid', '==', profile.uid));
    memQuery = query(collection(dbFirestore, 'memorization_records'), baseSchoolFilter, grdArrFilter);
    mrjQuery = query(collection(dbFirestore, 'murajaah_records'), baseSchoolFilter, grdArrFilter);
  }

  const [stuSnap, grdSnap, asgSnap, memSnap, mrjSnap, quizSnap] = await Promise.all([
    studentsQuery ? safeGetDocs(studentsQuery) : Promise.resolve(null),
    guardiansQuery ? safeGetDocs(guardiansQuery) : Promise.resolve(null),
    assignmentsQuery ? safeGetDocs(assignmentsQuery) : Promise.resolve(null),
    memQuery ? safeGetDocs(memQuery) : Promise.resolve(null),
    mrjQuery ? safeGetDocs(mrjQuery) : Promise.resolve(null),
    quizQuery ? safeGetDocs(quizQuery) : Promise.resolve(null),
  ]);

  let hydratedSettings: SchoolSettings | undefined;
  if (settingsSnap && !settingsSnap.empty) {
    const d = settingsSnap.docs[0].data();
    hydratedSettings = {
      id: SCHOOL_ID,
      school_id: SCHOOL_ID,
      school_name: String(d.school_name ?? SCHOOL_NAME),
      slogan: String(d.slogan ?? SCHOOL_SLOGAN),
      logo_data_url: typeof d.logo_data_url === 'string' ? d.logo_data_url : undefined,
      app_version: String(d.app_version ?? APP_VERSION),
      auto_sync_enabled: Boolean(d.auto_sync_enabled),
      sync_interval_minutes: Number(d.sync_interval_minutes ?? 10),
      updated_by: String(d.updated_by ?? 'Admin'),
      updated_at: toIsoString(d.updated_at),
    };
  }

  const classes: ClassRoom[] = (classesSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      name: String(d.name ?? ''),
      grade_level: Number(d.grade_level ?? 1),
      academic_year: String(d.academic_year ?? '2026/2027'),
      homeroom_teacher_id: typeof d.homeroom_teacher_id === 'string' ? d.homeroom_teacher_id : undefined,
    };
  });

  const halaqahs: Halaqah[] = (halaqahsSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      name: String(d.name ?? ''),
      teacher_id: String(d.teacher_id ?? ''),
      class_ids: Array.isArray(d.class_ids) ? d.class_ids.map(String) : [],
      schedule_note: String(d.schedule_note ?? ''),
    };
  });

  const students: Student[] = (stuSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      nis_local: String(d.nis_local ?? ''),
      full_name: String(d.full_name ?? ''),
      class_id: String(d.class_id ?? ''),
      halaqah_id: String(d.halaqah_id ?? ''),
      guardian_ids: Array.isArray(d.guardian_ids) ? d.guardian_ids.map(String) : [],
      status: (d.status as Student['status']) ?? 'aktif',
    };
  });

  const guardians: Guardian[] = (grdSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      full_name: String(d.full_name ?? ''),
      relationship: (d.relationship as Guardian['relationship']) ?? 'Wali',
      whatsapp_raw: String(d.whatsapp_raw ?? ''),
      whatsapp_e164: String(d.whatsapp_e164 ?? ''),
      verification_status:
        (d.verification_status as Guardian['verification_status']) ?? 'belum_diverifikasi',
      communication_consent: Boolean(d.communication_consent),
      consent_updated_at: String(d.consent_updated_at ?? ''),
      student_ids: Array.isArray(d.student_ids) ? d.student_ids.map(String) : [],
      contact_history: [],
      updated_at: toIsoString(d.updated_at),
    };
  });

  const assignments: TeacherAssignment[] = (asgSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      teacher_uid: String(d.teacher_uid ?? ''),
      teacher_name: String(d.teacher_name ?? ''),
      class_ids: Array.isArray(d.class_ids) ? d.class_ids.map(String) : [],
      halaqah_ids: Array.isArray(d.halaqah_ids) ? d.halaqah_ids.map(String) : [],
      student_ids: Array.isArray(d.student_ids) ? d.student_ids.map(String) : [],
      can_announce: Boolean(d.can_announce),
      can_manage_guardian_contacts: Boolean(d.can_manage_guardian_contacts),
    };
  });

  const targets: TahfidzTarget[] = (targetsSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      scope: (d.scope as TahfidzTarget['scope']) ?? 'class',
      target_ref_id: String(d.target_ref_id ?? ''),
      period_label: String(d.period_label ?? ''),
      start_date: String(d.start_date ?? ''),
      end_date: String(d.end_date ?? ''),
      surah_number: Number(d.surah_number ?? 114),
      ayah_start: Number(d.ayah_start ?? 1),
      ayah_end: Number(d.ayah_end ?? 1),
      target_ayah_count: Number(d.target_ayah_count ?? 1),
    };
  });

  const memorizationRecords: MemorizationRecord[] = (memSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      student_id: String(d.student_id ?? ''),
      teacher_uid: String(d.teacher_uid ?? ''),
      teacher_name: String(d.teacher_name ?? ''),
      class_id: String(d.class_id ?? ''),
      halaqah_id: String(d.halaqah_id ?? ''),
      date: String(d.date ?? ''),
      surah_number: Number(d.surah_number ?? 114),
      surah_name: String(d.surah_name ?? ''),
      ayah_start: Number(d.ayah_start ?? 1),
      ayah_end: Number(d.ayah_end ?? 1),
      unique_ayah_keys: Array.isArray(d.unique_ayah_keys) ? d.unique_ayah_keys.map(String) : [],
      kelancaran: d.kelancaran as QualityGrade | undefined,
      ketepatan_bacaan: d.ketepatan_bacaan as QualityGrade | undefined,
      tajwid: d.tajwid as QualityGrade | undefined,
      makhraj: d.makhraj as QualityGrade | undefined,
      status: (d.status as MemorizationRecord['status']) ?? 'menunggu_penilaian',
      teacher_note: typeof d.teacher_note === 'string' ? d.teacher_note : undefined,
      audit_trail: [],
      whatsapp_share_status:
        (d.whatsapp_share_status as MemorizationRecord['whatsapp_share_status']) ?? 'belum_dibagikan',
      whatsapp_shared_at:
        typeof d.whatsapp_shared_at === 'string' ? d.whatsapp_shared_at : undefined,
      updated_at: toIsoString(d.updated_at),
    };
  });

  const murajaahRecords: MurajaahRecord[] = (mrjSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      student_id: String(d.student_id ?? ''),
      teacher_uid: String(d.teacher_uid ?? ''),
      teacher_name: String(d.teacher_name ?? ''),
      class_id: String(d.class_id ?? ''),
      halaqah_id: String(d.halaqah_id ?? ''),
      date: String(d.date ?? ''),
      surah_number: Number(d.surah_number ?? 114),
      surah_name: String(d.surah_name ?? ''),
      ayah_start: Number(d.ayah_start ?? 1),
      ayah_end: Number(d.ayah_end ?? 1),
      kelancaran: d.kelancaran as QualityGrade | undefined,
      ketepatan_bacaan: d.ketepatan_bacaan as QualityGrade | undefined,
      tajwid: d.tajwid as QualityGrade | undefined,
      makhraj: d.makhraj as QualityGrade | undefined,
      status: (d.status as MurajaahRecord['status']) ?? 'menunggu_penilaian',
      teacher_note: typeof d.teacher_note === 'string' ? d.teacher_note : undefined,
      whatsapp_share_status:
        (d.whatsapp_share_status as MurajaahRecord['whatsapp_share_status']) ?? 'belum_dibagikan',
      whatsapp_shared_at:
        typeof d.whatsapp_shared_at === 'string' ? d.whatsapp_shared_at : undefined,
      updated_at: toIsoString(d.updated_at),
    };
  });

  const announcements: Announcement[] = (announcementsSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      school_id: SCHOOL_ID,
      title: String(d.title ?? ''),
      body: String(d.body ?? ''),
      category: d.category as Announcement['category'],
      priority: d.priority as Announcement['priority'],
      target_audience: d.target_audience as Announcement['target_audience'],
      target_ref_id: typeof d.target_ref_id === 'string' ? d.target_ref_id : undefined,
      author_uid: String(d.author_uid ?? ''),
      author_name: String(d.author_name ?? ''),
      start_at: String(d.start_at ?? ''),
      end_at: String(d.end_at ?? ''),
      is_published: Boolean(d.is_published),
      is_archived: Boolean(d.is_archived),
      created_at: toIsoString(d.created_at),
      updated_at: toIsoString(d.updated_at),
    };
  });

  const announcementReads: AnnouncementRead[] = (readsSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      announcement_id: String(d.announcement_id ?? ''),
      user_uid: String(d.user_uid ?? ''),
      read_at: toIsoString(d.read_at),
    };
  });

  const quizResults: QuizResult[] = (quizSnap?.docs ?? []).map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      student_id: String(d.student_id ?? ''),
      module: (d.module as QuizResult['module']) ?? 'mapsi',
      package_title: String(d.package_title ?? ''),
      total_questions: Number(d.total_questions ?? 0),
      correct_count: Number(d.correct_count ?? 0),
      accuracy_percent: Number(d.accuracy_percent ?? 0),
      duration_seconds: Number(d.duration_seconds ?? 0),
      weak_topics: Array.isArray(d.weak_topics) ? d.weak_topics.map(String) : [],
      weak_surahs: Array.isArray(d.weak_surahs) ? d.weak_surahs.map(String) : [],
      completed_at: toIsoString(d.completed_at),
    };
  });

  return {
    settings: hydratedSettings,
    classes,
    halaqahs,
    students,
    guardians,
    assignments,
    targets,
    memorizationRecords,
    murajaahRecords,
    announcements,
    announcementReads,
    quizResults,
  };
}
