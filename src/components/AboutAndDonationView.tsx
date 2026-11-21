import React, { useState } from 'react';
import {
  APP_VERSION,
  CREATOR_INFO,
  DONATION_ACCOUNT,
  SCHOOL_NAME,
  SCHOOL_SLOGAN,
} from '../types/simtaq';
import { Award, Check, Copy, HeartHandshake, Info, Landmark, ShieldCheck } from 'lucide-react';

export const AboutSimtaqView: React.FC = () => {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <Info className="h-4 w-4" aria-hidden="true" />
              <span>Tentang Aplikasi · Versi {APP_VERSION}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              SIMTAQ — Sistem Informasi Manajemen Tahfidz Al-Qur’an
            </h1>
            <p className="text-sm font-semibold text-amber-800">
              {SCHOOL_NAME} · {SCHOOL_SLOGAN}
            </p>
            <p className="text-base leading-relaxed text-slate-700">{CREATOR_INFO.description}</p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-emerald-800/15 bg-emerald-50/60 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <Award className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <span>Identitas Pengembang</span>
            </div>
            <p className="mt-3 text-xl font-bold tracking-tight text-slate-900">
              {CREATOR_INFO.name}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-600">{CREATOR_INFO.role}</p>
            <div className="mt-4 border-t border-emerald-900/10 pt-3 text-xs text-slate-600">
              Dikembangkan khusus untuk lingkungan pendidikan SDN Jetiskarangpung 1 (Single School Edition).
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">
          Informasi Hak Penggunaan Materi &amp; Audio
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm text-slate-600">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="font-semibold text-slate-900">Teks Al-Qur’an</p>
            <p className="mt-1 leading-relaxed">
              Menggunakan rujukan naskah Uthmani/Tanzil dengan status verifikasi terstruktur oleh
              guru sebelum dipublikasikan penuh. Tidak mengubah huruf maupun harakat asli.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="font-semibold text-slate-900">Audio Tilawah Qari</p>
            <p className="mt-1 leading-relaxed">
              Menggunakan sumber audio tilawah qari per-ayat sesuai atribusi dan izin sumber masing-masing.
              SIMTAQ tidak menghasilkan bacaan Al-Qur’an sintetis menggunakan AI.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="font-semibold text-slate-900">Privasi &amp; Data Anak</p>
            <p className="mt-1 leading-relaxed">
              Rekaman suara latihan siswa (Talking Duet) tersimpan lokal di perangkat dengan izin mikrofon
              dan tidak pernah diunggah otomatis ke internet.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export const DonationView: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopyAccount = async () => {
    setCopyError(null);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(DONATION_ACCOUNT.accountNumber);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 3000);
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch {
      try {
        const input = document.createElement('input');
        input.value = DONATION_ACCOUNT.accountNumber;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 3000);
      } catch {
        setCopyError('Salin otomatis tidak tersedia. Silakan catat nomor rekening: 3010033050');
      }
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
          <HeartHandshake className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <span>Dukungan Sukarela</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Dukung Pengembangan SIMTAQ
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          {DONATION_ACCOUNT.voluntaryStatement}
        </p>

        <div className="mt-6 rounded-2xl border border-emerald-800/20 bg-emerald-50/70 p-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
            <Landmark className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Informasi Rekening Transfer Manual</span>
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-slate-500">Bank</dt>
              <dd className="mt-1 text-base font-bold text-slate-900">
                {DONATION_ACCOUNT.bankName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Nomor Rekening</dt>
              <dd className="mt-1 font-mono text-lg font-bold tracking-wide text-emerald-900 tabular-nums">
                {DONATION_ACCOUNT.accountNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Nama Pemilik Rekening</dt>
              <dd className="mt-1 text-base font-bold text-slate-900">
                {DONATION_ACCOUNT.accountHolder}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCopyAccount()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Nomor Rekening Tersalin
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Salin Nomor Rekening
                </>
              )}
            </button>
          </div>

          {copyError && (
            <p className="mt-2 text-xs font-medium text-amber-800" role="status">
              {copyError}
            </p>
          )}
        </div>

        <div className="mt-5 space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">{DONATION_ACCOUNT.transferNotice}</p>
              <p className="text-xs leading-relaxed text-amber-900">
                {DONATION_ACCOUNT.manualNotice}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
