import test from 'node:test';
import assert from 'node:assert/strict';
import { filterActiveAnnouncements } from './announcementRules';
import { Announcement, SCHOOL_ID } from '../types/simtaq';

const baseList: Announcement[] = [
  {
    id: 'a1',
    school_id: SCHOOL_ID,
    title: 'Jadwal Tasmi Kelas 4',
    body: 'Tasmi dilaksanakan Jumat pagi.',
    category: 'Jadwal kegiatan',
    priority: 'Penting',
    target_audience: 'class',
    target_ref_id: 'cls-4a',
    author_uid: 'admin-1',
    author_name: 'Admin Sekolah',
    start_at: '2026-11-01T00:00:00Z',
    end_at: '2026-11-30T23:59:59Z',
    is_published: true,
    is_archived: false,
    created_at: '2026-11-01T08:00:00Z',
    updated_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'a2',
    school_id: SCHOOL_ID,
    title: 'Pengumuman Kedaluwarsa',
    body: 'Sudah lewat.',
    category: 'Informasi umum',
    priority: 'Normal',
    target_audience: 'all',
    author_uid: 'admin-1',
    author_name: 'Admin Sekolah',
    start_at: '2026-10-01T00:00:00Z',
    end_at: '2026-10-10T23:59:59Z',
    is_published: true,
    is_archived: false,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'a3',
    school_id: SCHOOL_ID,
    title: 'Motivasi Pagi',
    body: 'Semangat murajaah hari ini!',
    category: 'Motivasi belajar',
    priority: 'Mendesak',
    target_audience: 'student',
    author_uid: 'tch-1',
    author_name: 'Ustadz Ahmad',
    start_at: '2026-11-01T00:00:00Z',
    end_at: '2026-11-30T23:59:59Z',
    is_published: true,
    is_archived: false,
    created_at: '2026-11-02T08:00:00Z',
    updated_at: '2026-11-02T08:00:00Z',
  },
];

test('filterActiveAnnouncements enforces active date range, audience scope, and priority sort', () => {
  const student4A = filterActiveAnnouncements(
    baseList,
    { role: 'student', classId: 'cls-4a', halaqahId: 'hal-1' },
    '2026-11-21T10:00:00Z'
  );
  assert.equal(student4A.length, 2);
  assert.equal(student4A[0].id, 'a3'); // Mendesak first
  assert.equal(student4A[1].id, 'a1');

  const student5A = filterActiveAnnouncements(
    baseList,
    { role: 'student', classId: 'cls-5a', halaqahId: 'hal-2' },
    '2026-11-21T10:00:00Z'
  );
  assert.equal(student5A.length, 1);
  assert.equal(student5A[0].id, 'a3');
});
