import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  XCircle, 
  FlaskConical, 
  Sparkles, 
  Eye
} from 'lucide-react';

// ---------------------------------------------------------
// 1. Badge Component
// ---------------------------------------------------------
export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'draft' | 'active' | 'completed' | 'needs-review' | 'warning' | 'critical' | 'simulated' | 'predicted' | 'observed';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'draft',
  className = ''
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border';
  
  const variantStyles = {
    draft: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    active: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    'needs-review': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    simulated: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    predicted: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    observed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  };

  const icons = {
    draft: null,
    active: null,
    completed: <CheckCircle2 size={10} />,
    'needs-review': <AlertTriangle size={10} />,
    warning: <AlertTriangle size={10} />,
    critical: <XCircle size={10} />,
    simulated: <FlaskConical size={10} />,
    predicted: <Sparkles size={10} />,
    observed: <Eye size={10} />,
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {icons[variant]}
      <span>{children}</span>
    </span>
  );
};

// ---------------------------------------------------------
// 2. Alert Component
// ---------------------------------------------------------
export interface AlertProps {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'ethical' | 'simulation-disclaimer';
  title?: string;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  onClose,
  className = ''
}) => {
  const baseStyles = 'p-4 rounded-2xl border flex gap-3 text-xs leading-relaxed';

  const variantStyles = {
    info: 'bg-[var(--ds-information-soft)] border-[var(--ds-information)]/20 text-[var(--ds-text-primary)]',
    success: 'bg-[var(--ds-success-soft)] border-[var(--ds-success)]/20 text-[var(--ds-text-primary)]',
    warning: 'bg-[var(--ds-warning-soft)] border-[var(--ds-warning)]/20 text-[var(--ds-text-primary)]',
    danger: 'bg-[var(--ds-danger-soft)] border-[var(--ds-danger)]/20 text-[var(--ds-text-primary)]',
    ethical: 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400',
    'simulation-disclaimer': 'bg-purple-500/5 border-purple-500/20 text-purple-700 dark:text-purple-300',
  };

  const icons = {
    info: <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />,
    success: <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />,
    danger: <XCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />,
    ethical: <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />,
    'simulation-disclaimer': <FlaskConical size={16} className="text-purple-500 shrink-0 mt-0.5" />,
  };

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`} role="alert">
      {icons[variant]}
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-extrabold m-0 text-inherit">{title}</h5>}
        <div className="m-0 text-inherit">{children}</div>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close alert" className="text-inherit hover:opacity-75 cursor-pointer ml-auto font-bold">×</button>
      )}
    </div>
  );
};

export const SimulationDisclaimer: React.FC = () => (
  <Alert variant="simulation-disclaimer" title="ملاحظة منهجية إحصائية">
    جميع الدرجات والمستويات الممثلة هنا ناتجة عن محاكاة رياضية لسيناريوهات محددة (Monte Carlo) لتسهيل الفحص والتصميم، وليست بيانات حقيقية تم قياسها ميدانياً.
  </Alert>
);

// ---------------------------------------------------------
// 3. Tooltip Component
// ---------------------------------------------------------
export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = ''
}) => {
  return (
    <div className={`relative group inline-block ${className}`}>
      {children}
      <div role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block group-focus-within:block z-50 bg-zinc-950 text-white text-[10px] p-2.5 rounded-xl shadow-lg border border-zinc-800 leading-normal select-none pointer-events-none">
        {content}
      </div>
    </div>
  );
};

// ---------------------------------------------------------
// 4. Progress Component
// ---------------------------------------------------------
export interface ProgressProps {
  value: number; // 0 to 100
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  variant = 'primary',
  className = ''
}) => {
  const barColors = {
    primary: 'bg-[var(--ds-primary)]',
    success: 'bg-[var(--ds-success)]',
    warning: 'bg-[var(--ds-warning)]',
    danger: 'bg-[var(--ds-danger)]',
  };

  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, value))} className={`h-2 w-full bg-[var(--ds-background-subtle)] rounded-full overflow-hidden ${className}`}>
      <div 
        className={`h-full transition-all duration-300 ${barColors[variant]}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
};

// ---------------------------------------------------------
// 5. Skeleton Component
// ---------------------------------------------------------
export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect'
}) => {
  const shapeClass = variant === 'circle' 
    ? 'rounded-full' 
    : variant === 'text' 
      ? 'h-3 rounded-md w-3/4' 
      : 'rounded-xl';

  return (
    <div aria-hidden="true" className={`animate-pulse bg-[var(--ds-surface-tertiary)] ${shapeClass} ${className}`} />
  );
};

// ---------------------------------------------------------
// 6. EmptyState Component
// ---------------------------------------------------------
export interface EmptyStateProps {
  title: string;
  description: string;
  illustration?: React.ReactNode;
  actionButton?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustration,
  actionButton,
  className = ''
}) => {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center gap-4 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl ${className}`}>
      {illustration && (
        <div className="text-[var(--ds-text-disabled)] opacity-80">
          {illustration}
        </div>
      )}
      <div className="space-y-1.5 max-w-sm">
        <h4 className="text-sm font-extrabold text-[var(--ds-text-primary)] m-0">{title}</h4>
        <p className="text-xs text-[var(--ds-text-muted)] leading-relaxed m-0">{description}</p>
      </div>
      {actionButton && (
        <div className="pt-2">
          {actionButton}
        </div>
      )}
    </div>
  );
};
