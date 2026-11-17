import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kesalahan pada aplikasi.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      let displayMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          displayMessage = `${parsed.error} (${parsed.operationType || 'operasi'} pada ${parsed.path || 'database'})`;
        }
      } catch {
        // Keep raw error message
      }

      return (
        <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#D8E0EB] rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[#DC2626] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">
                  Terjadi Gangguan Sistem
                </h2>
                <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                  {displayMessage}
                </p>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F2A56] rounded-md hover:bg-[#1E3A8A] transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Muat Ulang Tampilan
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
