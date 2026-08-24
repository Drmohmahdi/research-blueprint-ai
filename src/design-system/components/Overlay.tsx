import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footerActions,
  size = 'md'
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        const firstFocusable = dialogRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        (firstFocusable ?? dialogRef.current)?.focus();
      });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        {/* Overlay backdrop */}
        <div 
          className="fixed inset-0 bg-[var(--ds-surface-overlay)] transition-opacity"
          onClick={onClose}
        />

        <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`relative w-full transform rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-6 text-start align-middle shadow-[var(--ds-shadow-overlay)] ds-transition ${sizeClasses[size]}`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-4 mb-4">
            <h3 id={titleId} className="text-sm font-extrabold text-[var(--ds-text-primary)] m-0">
              {title}
            </h3>
            <IconButton 
              variant="ghost" 
              size="sm" 
              icon={<X size={16} />} 
              ariaLabel="Close Modal" 
              onClick={onClose} 
            />
          </div>

          {/* Body */}
          <div className="text-xs text-[var(--ds-text-secondary)] leading-relaxed min-h-[60px]">
            {children}
          </div>

          {/* Footer */}
          {footerActions && (
            <div className="flex justify-end gap-3 border-t border-[var(--ds-border-subtle)] pt-4 mt-4">
              {footerActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  placement?: 'left' | 'right';
  footerActions?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  placement = 'right',
  footerActions
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus());
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) {
        event.preventDefault();
        drawerRef.current.focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const placementClass = placement === 'left' ? 'left-0' : 'right-0';
  const animClass = placement === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop overlay */}
        <div 
          className="absolute inset-0 bg-[var(--ds-surface-overlay)] transition-opacity"
          onClick={onClose}
        />

        <div className={`absolute inset-y-0 ${placementClass} flex max-w-full`}>
          <div ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-screen max-w-md transform bg-[var(--ds-surface-primary)] ${placement === 'left' ? 'border-r' : 'border-l'} border-[var(--ds-border-subtle)] p-6 shadow-[var(--ds-shadow-overlay)] flex flex-col justify-between ${animClass}`}>
            
            <div className="space-y-6 flex-1 flex flex-col overflow-y-auto no-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--ds-border-subtle)] pb-4">
                <h3 id={titleId} className="text-sm font-extrabold text-[var(--ds-text-primary)] m-0">
                  {title}
                </h3>
                <IconButton 
                  variant="ghost" 
                  size="sm" 
                  icon={<X size={16} />} 
                  ariaLabel="Close Drawer" 
                  onClick={onClose} 
                />
              </div>

              {/* Body */}
              <div className="text-xs text-[var(--ds-text-secondary)] leading-relaxed flex-1">
                {children}
              </div>
            </div>

            {/* Footer */}
            {footerActions && (
              <div className="border-t border-[var(--ds-border-subtle)] pt-4 mt-6 flex justify-end gap-3">
                {footerActions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
