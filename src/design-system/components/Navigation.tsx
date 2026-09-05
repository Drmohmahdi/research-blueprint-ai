import React from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

// ---------------------------------------------------------
// 1. Tabs Component
// ---------------------------------------------------------
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex border-b border-[var(--ds-border-subtle)] gap-4 overflow-x-auto no-scrollbar ds-edge-fade-x ${className}`}>
      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 text-label transition-all cursor-pointer whitespace-nowrap ${
              isActive 
                ? 'border-[var(--ds-primary)] text-[var(--ds-primary)]'
                : 'border-transparent text-[var(--ds-text-secondary)] hover:text-[var(--ds-text-primary)] hover:border-[var(--ds-border-default)]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------
// 2. Stepper Component
// ---------------------------------------------------------
export interface StepItem {
  id: string;
  label: string;
  status?: 'completed' | 'current' | 'available' | 'locked' | 'needs-review' | 'error';
}

export interface StepperProps {
  steps: StepItem[];
  currentStepId: string;
  onStepClick?: (id: string) => void;
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepId,
  onStepClick,
  layout = 'horizontal',
  className = ''
}) => {
  const { language } = useProject();
  const isRtl = language === 'ar';

  const isVertical = layout === 'vertical';

  return (
    <div className={`flex ${isVertical ? 'flex-col gap-4' : 'items-center justify-between gap-2 overflow-x-auto py-2'} ${className}`}>
      {steps.map((step, idx) => {
        const isCurrent = step.id === currentStepId;
        const isCompleted = step.status === 'completed';
        const isLocked = step.status === 'locked';
        const hasError = step.status === 'error';
        const needsReview = step.status === 'needs-review';

        let badgeColor = 'bg-[var(--ds-surface-tertiary)] border-[var(--ds-border-default)] text-[var(--ds-text-secondary)]';
        if (isCurrent) {
          badgeColor = 'bg-action border-[var(--ds-action-fill)] text-on-action shadow-sm';
        } else if (isCompleted) {
          badgeColor = 'bg-[var(--ds-success-soft)] border-[var(--ds-success)]/30 text-[var(--ds-success)]';
        } else if (hasError) {
          badgeColor = 'bg-[var(--ds-danger-soft)] border-[var(--ds-danger)]/30 text-[var(--ds-danger)]';
        } else if (needsReview) {
          badgeColor = 'bg-[var(--ds-warning-soft)] border-[var(--ds-warning)]/30 text-[var(--ds-warning)]';
        }

        const ArrowIcon = isRtl ? ChevronLeft : ChevronRight;

        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => onStepClick && !isLocked && onStepClick(step.id)}
              disabled={isLocked || !onStepClick}
              className={`flex items-center gap-2.5 text-body-sm font-semibold select-none text-start disabled:cursor-not-allowed ${
                isCurrent ? 'text-[var(--ds-text-primary)] font-bold' : 'text-[var(--ds-text-secondary)]'
              }`}
            >
              <div className={`h-6 w-6 rounded-full border flex items-center justify-center text-caption font-bold shrink-0 ${badgeColor}`}>
                {isCompleted ? <CheckCircle2 size={12} /> : needsReview ? <AlertTriangle size={12} /> : idx + 1}
              </div>
              <span className="truncate">{step.label}</span>
            </button>

            {!isVertical && idx < steps.length - 1 && (
              <ArrowIcon size={14} className="text-[var(--ds-text-muted)] shrink-0 hidden sm:block" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------
// 3. Breadcrumbs Component
// ---------------------------------------------------------
export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  className = ''
}) => {
  const { language } = useProject();
  const ArrowIcon = language === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <nav className={`flex items-center gap-1.5 text-label text-[var(--ds-text-secondary)] ${className}`}>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {item.onClick ? (
            <button 
              onClick={item.onClick} 
              className="hover:text-[var(--ds-primary)] transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-[var(--ds-text-primary)] font-bold">{item.label}</span>
          )}
          {idx < items.length - 1 && (
            <ArrowIcon size={12} className="text-[var(--ds-text-muted)]" />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// ---------------------------------------------------------
// 4. PageHeader & SectionHeader
// ---------------------------------------------------------
export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  eyebrow,
  status,
  actions,
  breadcrumbs,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          {eyebrow && (
            <p className="m-0 text-overline text-[var(--ds-text-muted)]">{eyebrow}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-h2 text-[var(--ds-text-primary)] m-0">
              {title}
            </h2>
            {status}
          </div>
          {description && (
            <p className="text-body-sm text-[var(--ds-text-muted)] m-0">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export const PathPanel: React.FC<{
  accent?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ accent = 'var(--ds-path-research)', children, className = '' }) => (
  <section className={`relative overflow-hidden rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] shadow-[var(--ds-shadow-layered)] ${className}`}>
    <span aria-hidden className="absolute inset-y-0 start-0 w-1" style={{ background: accent }} />
    <div className="relative p-6 ps-7">{children}</div>
  </section>
);

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-[var(--ds-border-subtle)] pb-3 ${className}`}>
      <div className="space-y-0.5">
        <h3 className="text-h3 text-[var(--ds-text-primary)] m-0">
          {title}
        </h3>
        {subtitle && (
          <p className="text-caption text-[var(--ds-text-muted)] m-0">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// 5. Table Component
// ---------------------------------------------------------
export interface TableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({
  headers,
  children,
  className = ''
}) => {
  return (
    <div className={`w-full overflow-x-auto border border-[var(--ds-border-subtle)] rounded-lg bg-[var(--ds-surface-primary)] ${className}`}>
      <table className="w-full text-body-sm text-start border-collapse">
        <thead>
          <tr className="border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] text-overline text-[var(--ds-text-muted)]">
            {headers.map((h, idx) => (
              <th key={idx} className="p-3 text-start font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ds-border-subtle)] [&_tr]:ds-transition [&_tr:hover]:bg-[var(--ds-surface-secondary)]">
          {children}
        </tbody>
      </table>
    </div>
  );
};
