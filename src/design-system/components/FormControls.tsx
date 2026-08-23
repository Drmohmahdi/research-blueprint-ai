import React, { useId } from 'react';
import { Loader2 } from 'lucide-react';

interface BaseInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  success?: boolean;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  loading?: boolean;
  requiredIndicator?: boolean;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, BaseInputProps {}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  success,
  prefixIcon,
  suffixIcon,
  loading = false,
  requiredIndicator = false,
  className = '',
  disabled,
  id,
  type = 'text',
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helpId = `${inputId}-help`;

  const stateClass = error 
    ? 'border-rose-500/50 focus-visible:ring-rose-500/30'
    : success
      ? 'border-emerald-500/50 focus-visible:ring-emerald-500/30'
      : 'border-[var(--ds-border-default)] focus-visible:ring-[var(--ds-primary)]/30';

  return (
    <div className="flex flex-col gap-1.5 w-full text-xs">
      {label && (
        <label htmlFor={inputId} className="font-bold text-[var(--ds-text-secondary)] flex items-center gap-1 select-none">
          {label}
          {requiredIndicator && <span className="text-rose-500">*</span>}
        </label>
      )}
      
      <div className="relative w-full">
        {prefixIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--ds-text-muted)]">
            {prefixIcon}
          </div>
        )}
        
        <input
          id={inputId}
          type={type}
          disabled={disabled || loading}
          aria-invalid={error ? true : undefined}
          aria-describedby={(error || helperText) ? helpId : undefined}
          aria-busy={loading || undefined}
          required={props.required || requiredIndicator}
          className={`w-full bg-[var(--ds-surface-primary)] border rounded-xl px-3.5 py-2.5 text-xs text-[var(--ds-text-primary)] placeholder-[var(--ds-text-disabled)] transition-all focus:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${prefixIcon ? 'pl-9' : ''} ${suffixIcon || loading ? 'pr-9' : ''} ${stateClass} ${className}`}
          {...props}
        />

        {(suffixIcon || loading) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--ds-text-muted)]">
            {loading ? <Loader2 className="animate-spin text-[var(--ds-primary)]" size={16} /> : suffixIcon}
          </div>
        )}
      </div>

      {error && <span id={helpId} role="alert" className="text-[10px] font-semibold text-[var(--ds-danger)]">{error}</span>}
      {!error && helperText && <span id={helpId} className="text-[10px] text-[var(--ds-text-muted)]">{helperText}</span>}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, BaseInputProps {}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  success,
  loading = false,
  requiredIndicator = false,
  className = '',
  disabled,
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helpId = `${inputId}-help`;

  const stateClass = error 
    ? 'border-rose-500/50 focus-visible:ring-rose-500/30'
    : success
      ? 'border-emerald-500/50 focus-visible:ring-emerald-500/30'
      : 'border-[var(--ds-border-default)] focus-visible:ring-[var(--ds-primary)]/30';

  return (
    <div className="flex flex-col gap-1.5 w-full text-xs">
      {label && (
        <label htmlFor={inputId} className="font-bold text-[var(--ds-text-secondary)] flex items-center gap-1 select-none">
          {label}
          {requiredIndicator && <span className="text-rose-500">*</span>}
        </label>
      )}

      <textarea
        id={inputId}
        disabled={disabled || loading}
        aria-invalid={error ? true : undefined}
        aria-describedby={(error || helperText) ? helpId : undefined}
        aria-busy={loading || undefined}
        required={props.required || requiredIndicator}
        className={`w-full bg-[var(--ds-surface-primary)] border rounded-xl px-3.5 py-2.5 text-xs text-[var(--ds-text-primary)] placeholder-[var(--ds-text-disabled)] transition-all focus:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${stateClass} ${className}`}
        {...props}
      />

      {error && <span id={helpId} role="alert" className="text-[10px] font-semibold text-[var(--ds-danger)]">{error}</span>}
      {!error && helperText && <span id={helpId} className="text-[10px] text-[var(--ds-text-muted)]">{helperText}</span>}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, BaseInputProps {
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  helperText,
  error,
  success,
  options,
  requiredIndicator = false,
  className = '',
  disabled,
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helpId = `${inputId}-help`;

  const stateClass = error 
    ? 'border-rose-500/50 focus-visible:ring-rose-500/30'
    : success
      ? 'border-emerald-500/50 focus-visible:ring-emerald-500/30'
      : 'border-[var(--ds-border-default)] focus-visible:ring-[var(--ds-primary)]/30';

  return (
    <div className="flex flex-col gap-1.5 w-full text-xs">
      {label && (
        <label htmlFor={inputId} className="font-bold text-[var(--ds-text-secondary)] flex items-center gap-1 select-none">
          {label}
          {requiredIndicator && <span className="text-rose-500">*</span>}
        </label>
      )}

      <select
        id={inputId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={(error || helperText) ? helpId : undefined}
        required={props.required || requiredIndicator}
        className={`w-full bg-[var(--ds-surface-primary)] border rounded-xl px-3 py-2.5 text-xs font-semibold text-[var(--ds-text-primary)] transition-all focus:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${stateClass} ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {error && <span id={helpId} role="alert" className="text-[10px] font-semibold text-[var(--ds-danger)]">{error}</span>}
      {!error && helperText && <span id={helpId} className="text-[10px] text-[var(--ds-text-muted)]">{helperText}</span>}
    </div>
  );
};

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const checkId = id || generatedId;

  return (
    <div className="flex items-start gap-2.5 text-xs select-none">
      <input
        type="checkbox"
        id={checkId}
        className={`mt-0.5 h-4 w-4 rounded border-[var(--ds-border-default)] text-[var(--ds-primary)] focus:ring-[var(--ds-primary)] cursor-pointer ${className}`}
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={checkId} className="font-bold text-[var(--ds-text-primary)] cursor-pointer">
          {label}
        </label>
        {helperText && <span className="text-[10px] text-[var(--ds-text-muted)]">{helperText}</span>}
      </div>
    </div>
  );
};

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
}

export const Radio: React.FC<RadioProps> = ({
  label,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const radioId = id || generatedId;

  return (
    <div className="flex items-start gap-2.5 text-xs select-none">
      <input
        type="radio"
        id={radioId}
        className={`mt-0.5 h-4 w-4 border-[var(--ds-border-default)] text-[var(--ds-primary)] focus:ring-[var(--ds-primary)] cursor-pointer ${className}`}
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={radioId} className="font-bold text-[var(--ds-text-primary)] cursor-pointer">
          {label}
        </label>
        {helperText && <span className="text-[10px] text-[var(--ds-text-muted)]">{helperText}</span>}
      </div>
    </div>
  );
};

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onToggle'> {
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onToggle,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <label className={`flex items-center justify-between gap-3 text-xs font-bold text-[var(--ds-text-primary)] select-none cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <span>{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onToggle(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div className="w-9 h-5 bg-[var(--ds-background-subtle)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--ds-primary)] transition-colors" />
      </div>
    </label>
  );
};
