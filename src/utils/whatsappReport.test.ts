import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppClickToChatUrl,
  buildWhatsAppReportText,
  normalizeIndonesianWhatsApp,
} from './whatsappReport';

test('normalizeIndonesianWhatsApp converts 08xx and 628xx without altering digits', () => {
  const r1 = normalizeIndonesianWhatsApp('0812-3456-7890');
  assert.equal(r1.valid, true);
  assert.equal(r1.e164, '+6281234567890');
  assert.equal(r1.waDigits, '6281234567890');

  const r2 = normalizeIndonesianWhatsApp('6285711223344');
  assert.equal(r2.valid, true);
  assert.equal(r2.e164, '+6285711223344');

  const invalid = normalizeIndonesianWhatsApp('0215551234');
  assert.equal(invalid.valid, false);
});

test('buildWhatsAppReportText uses stored assessment data and marks unassessed fields honestly', () => {
  const report = buildWhatsAppReportText({
    studentName: 'Fatimah Az-Zahra',
    classOrHalaqah: 'Kelas 4A / Halaqah Abu Bakar',
    teacherName: 'Ustadz Ahmad Fauzi, S.Pd.I',
    activityType: 'Hafalan Baru',
    record: {
      date: '2026-11-20',
      surah_name: 'Al-Ikhlas',
      ayah_start: 1,
      ayah_end: 4,
      kelancaran: 'Mumtaz (Sangat Baik)',
      ketepatan_bacaan: undefined,
      tajwid: 'Jayyid Jiddan (Baik Sekali)',
      makhraj: undefined,
      status: 'lulus',
      teacher_note: 'Pertahankan makhraj huruf qalqalah.',
    },
  });

  assert.ok(report.includes('SDN JETISKARANGPUNG 1'));
  assert.ok(report.includes('Fatimah Az-Zahra'));
  assert.ok(report.includes('Kelancaran: Mumtaz (Sangat Baik)'));
  assert.ok(report.includes('Ketepatan Bacaan: Belum dinilai'));
  assert.ok(report.includes('Makhraj: Belum dinilai'));
  assert.ok(report.includes('Status: Lulus'));
  assert.ok(report.includes('Catatan Guru: Pertahankan makhraj huruf qalqalah.'));

  const url = buildWhatsAppClickToChatUrl('081234567890', report);
  assert.ok(url?.startsWith('https://wa.me/6281234567890?text='));
});
