import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kendala tak terduga pada aplikasi.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F6F8F6] p-6">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <h1 className="text-base font-bold">Gangguan Aplikasi SIMTAQ</h1>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Sistem menangkap kesalahan akses atau runtime untuk menjaga keamanan data sekolah.
            </p>
            <pre className="max-h-36 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] font-mono text-slate-700">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Muat Ulang SIMTAQ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
