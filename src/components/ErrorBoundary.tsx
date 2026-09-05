import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  language?: 'ar' | 'en';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, language = 'ar' } = this.props;

    if (!hasError) return children;
    if (fallback) return fallback;

    const isAr = language === 'ar';

    return (
      <div
        className="flex flex-col items-center justify-center min-h-[300px] p-8 rounded-2xl border border-danger/20 bg-danger/5 text-center gap-5"
        role="alert"
      >
        <div className="p-4 rounded-2xl bg-danger/10">
          <AlertTriangle size={36} className="text-danger" />
        </div>

        <div className="space-y-2">
          <h2 className="text-h2 text-[var(--ds-text-primary)] m-0">
            {isAr ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred'}
          </h2>
          <p className="text-body-sm text-[var(--ds-text-secondary)] m-0 max-w-md">
            {isAr
              ? 'تعذّر تحميل هذا القسم. أعد المحاولة أو عد إلى مساحة العمل. إن تكرر الخطأ، أرسل وصف الخطوة الأخيرة إلى الدعم.'
              : 'This section failed to load. Try again or return to the workspace. If it repeats, send support the last step you took.'}
          </p>

          {/* Show error details in development */}
          {import.meta.env.DEV && error && (
            <pre className="mt-3 p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl text-caption text-danger font-mono text-right overflow-x-auto max-w-xl mx-auto">
              {error.message}
            </pre>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-action hover:bg-action-hover text-on-action text-sm font-bold cursor-pointer ds-transition shadow-md"
          >
            <RefreshCw size={14} />
            <span>{isAr ? 'إعادة المحاولة' : 'Try Again'}</span>
          </button>
          <button
            onClick={() => { window.location.href = '/app'; }}
            className="px-4 py-2 rounded-xl border border-[var(--ds-border-subtle)] text-[var(--ds-text-secondary)] text-sm font-bold cursor-pointer hover:bg-[var(--ds-surface-secondary)] transition-colors"
          >
            {isAr ? 'مساحة العمل' : 'Workspace'}
          </button>
        </div>
      </div>
    );
  }
}
