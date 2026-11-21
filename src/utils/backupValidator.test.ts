import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackupPayload } from './backupValidator';
import { SCHOOL_ID } from '../types/simtaq';

test('validateBackupPayload rejects foreign school_id and accepts valid SIMTAQ backup', () => {
  const wrongSchool = validateBackupPayload({
    schema_version: 'simtaq-v1',
    school_id: 'sekolah-lain',
    exported_at: '2026-11-21T00:00:00Z',
    data: {
      classes: [],
      halaqahs: [],
      students: [],
      guardians: [],
      memorization_records: [],
      murajaah_records: [],
      announcements: [],
    },
  });
  assert.equal(wrongSchool.valid, false);

  const valid = validateBackupPayload({
    schema_version: 'simtaq-v1',
    school_id: SCHOOL_ID,
    exported_at: '2026-11-21T00:00:00Z',
    data: {
      classes: [{}],
      halaqahs: [],
      students: [{}, {}],
      guardians: [],
      memorization_records: [{}],
      murajaah_records: [],
      announcements: [],
    },
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.summary?.students, 2);
});
