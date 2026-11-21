# SIMTAQ Security Specification & Payload-First TDD

## 1. Data Invariants (SDN Jetiskarangpung 1)

1. **Single-School Isolation**: Every persisted record MUST specify `school_id == "sdn-jetiskarangpung-1"`. Any read or write targeting another `school_id` is rejected.
2. **Verified Identity**: All writes and sensitive reads require `request.auth != null && request.auth.token.email_verified == true`.
3. **Atomic One-Time Super Admin Bootstrap**: `/system_bootstrap/super_admin` may ONLY be created once when `!exists(/system_bootstrap/super_admin)`, strictly by `request.auth.token.email == "dwiariwibowo313@gmail.com"` with `email_verified == true`, atomically alongside `/admins/{uid}` and `/users/{uid}` via `existsAfter(...)`. Updates and deletes to `/system_bootstrap/super_admin` are permanently denied.
4. **No Self-Role Escalation**: Unprivileged users registering `/users/{uid}` may ONLY create `role in ['student', 'guardian']` with `is_active == false` and `linked_entity_id == ""`. Only verified `super_admin` or `school_admin` may activate or elevate roles (`school_admin` cannot create `super_admin` or modify `super_admin`).
5. **PII Isolation**:
   - `/users/{uid}` (contains email) is readable (`get`) only by the owner UID or verified admin, and listable only by verified Super Admin.
   - `/guardians/{guardianId}` (contains WhatsApp phone numbers) is readable (`get` / `list`) only by Super Admin, School Admin (registered in doc `admin_uids` / `get`), the linked guardian UID, or an explicitly assigned teacher UID. Students and unassigned teachers are denied.
6. **Teacher Assignment Scope**: Teachers can only create/update `memorization_records` and `murajaah_records` when `teacher_uid == request.auth.uid` and the referenced `student_id` exists in `/students/{student_id}` with `request.auth.uid` in `assigned_teacher_uids`.
7. **Temporal Integrity & Immutability**: `created_at` and `updated_at` on newly created or updated Firestore documents MUST equal `request.time`. Immutable fields (`id`, `school_id`, `uid`, `created_at`, `author_uid`, `teacher_uid`) cannot change after creation.
8. **Terminal State Locking**: Once `memorization_records` or `murajaah_records` reaches `status == "lulus"`, a regular teacher cannot overwrite core grades/status unless overridden by verified Admin / Super Admin (except updating WhatsApp share metadata).

---

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Spoofed Super Admin Unverified Email**: Authenticated user with `email: "dwiariwibowo313@gmail.com"` and `email_verified: false` attempts to create `/system_bootstrap/super_admin`.
2. **Duplicate Super Admin Bootstrap Hijack**: After `/system_bootstrap/super_admin` exists, another user (or even re-attempted write) tries to `create` or `update` `/system_bootstrap/super_admin`.
3. **Self-Role Escalation on Registration**: Student user attempts `create /users/{uid}` with `role: "super_admin"` or `role: "teacher"` or `is_active: true`.
4. **Shadow Field Injection on Profile Update**: Authenticated user updates `/users/{uid}` injecting `{ display_name: "Ali", isAdmin: true }`.
5. **Foreign School Injection**: School admin attempts `create /students/stu-evil` with `school_id: "other-school"`.
6. **Path ID Poisoning (Denial of Wallet)**: Attacker writes document ID `../evil/1500chars...` exceeding 128 chars or containing non-`[a-zA-Z0-9_-]`.
7. **Unassigned Teacher Setoran Forgery**: Teacher B tries to create `/memorization_records/mem-x` for a student whose `assigned_teacher_uids` does not include Teacher B, or tries setting `teacher_uid` to Teacher A.
8. **Guardian PII Blanket List**: Student user executes `list /guardians` attempting to scrape parent WhatsApp phone numbers.
9. **Grade Tampering After Lulus (Terminal State Bypass)**: Non-admin tries to mutate `status` or `kelancaran` of a locked `lulus` memorization record.
10. **Client-Forged Timestamp Injection**: User creates `/announcements/ann-x` with `created_at: "2020-01-01T00:00:00Z"` instead of server `request.time`.
11. **Array Overflow / Unbounded List Attack**: Attacker sends `unique_ayah_keys` with 1000 items or non-string element `[123]`.
12. **Audit Log Deletion / Tampering**: School admin or teacher attempts `update` or `delete` on `/audit_logs/{logId}` to erase audit history.
