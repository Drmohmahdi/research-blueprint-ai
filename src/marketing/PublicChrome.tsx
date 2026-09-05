import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Menu, X } from 'lucide-react';
import { ROUTES } from '../router/routes';

const FOOTER_LINKS = [
  { to: ROUTES.MARKETING_FEATURES, ar: 'المميزات', en: 'Features' },
  { to: ROUTES.MARKETING_PRICING, ar: 'الباقات', en: 'Pricing' },
  { to: ROUTES.MARKETING_CONTACT, ar: 'تواصل', en: 'Contact' },
  { to: ROUTES.MARKETING_INSTITUTIONAL, ar: 'للجامعات', en: 'Universities' },
  { to: ROUTES.LOGIN, ar: 'دخول', en: 'Sign in' },
  { to: ROUTES.MARKETING_TERMS, ar: 'الشروط', en: 'Terms' },
  { to: ROUTES.MARKETING_PRIVACY, ar: 'الخصوصية', en: 'Privacy' },
] as const;

const HEADER_LINKS = [
  { to: ROUTES.MARKETING_HOME, ar: 'الرئيسية', en: 'Home' },
  { to: ROUTES.MARKETING_PRICING, ar: 'الباقات', en: 'Pricing' },
  { to: ROUTES.MARKETING_INSTITUTIONAL, ar: 'للجامعات', en: 'Universities' },
  { to: ROUTES.LOGIN, ar: 'دخول', en: 'Sign in' },
] as const;

export const PublicHeader: React.FC<{ isAr: boolean }> = ({ isAr }) => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--ds-border-subtle)] baseerah-glass print:hidden">
      <div className="ds-shell mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to={ROUTES.MARKETING_HOME} className="flex min-w-0 items-center gap-2.5 no-underline text-inherit">
          <div className="p-2 rounded-xl bg-action text-on-action shadow-[var(--ds-shadow-glow)] shrink-0">
            <Brain size={16} />
          </div>
          <span className="text-label font-bold truncate baseerah-gradient-text">
            {isAr ? 'بصيرة' : 'Baseerah'}
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-4 text-caption font-semibold">
          {HEADER_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[var(--ds-text-secondary)] no-underline hover:text-[var(--ds-primary-bright)] ds-transition"
            >
              {isAr ? item.ar : item.en}
            </Link>
          ))}
          <Link
            to={ROUTES.REGISTER}
            className="text-[var(--ds-primary-bright)] no-underline font-bold hover:text-[var(--ds-primary-hover)] ds-transition"
          >
            {isAr ? 'ابدأ مجانًا' : 'Start free'}
          </Link>
        </nav>
        <div className="flex md:hidden items-center gap-2">
          <Link
            to={ROUTES.REGISTER}
            className="text-caption font-bold text-[var(--ds-primary-bright)] no-underline px-2 py-1.5"
          >
            {isAr ? 'ابدأ' : 'Start'}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--ds-border-default)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] ds-transition cursor-pointer"
            aria-label={isAr ? 'فتح القائمة' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label={isAr ? 'قائمة الموقع' : 'Site menu'}>
          <div className="absolute inset-0 bg-[var(--ds-surface-overlay)] animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 inset-inline-end-0 w-[min(88vw,20rem)] bg-[var(--ds-surface-primary)] border-inline-start border-[var(--ds-border-subtle)] shadow-[var(--ds-shadow-overlay)] p-5 flex flex-col gap-4 animate-slide-in">
            <div className="flex items-center justify-between">
              <span className="text-label text-[var(--ds-text-primary)]">{isAr ? 'التنقل' : 'Menu'}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--ds-surface-secondary)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {HEADER_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-body-sm no-underline text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] ds-transition"
                >
                  {isAr ? item.ar : item.en}
                </Link>
              ))}
              <Link
                to={ROUTES.REGISTER}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-body-sm no-underline font-bold text-[var(--ds-primary-bright)] bg-[var(--ds-primary-soft)]"
              >
                {isAr ? 'ابدأ مجانًا' : 'Start free'}
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export const PublicFooter: React.FC<{ isAr: boolean }> = ({ isAr }) => (
  <footer className="py-8 px-4 sm:px-6 border-t border-[var(--ds-border-subtle)] print:hidden">
    <div className="ds-shell mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to={ROUTES.MARKETING_HOME} className="flex items-center gap-2 no-underline text-inherit">
          <div className="p-1.5 rounded-lg bg-action text-on-action">
            <Brain size={14} />
          </div>
          <span className="text-caption font-bold">{isAr ? 'بصيرة' : 'Baseerah'}</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-caption font-semibold text-[var(--ds-text-muted)]">
          {FOOTER_LINKS.map((item) => (
            <Link key={item.to} to={item.to} className="hover:text-[var(--ds-primary-bright)] no-underline text-inherit ds-transition">
              {isAr ? item.ar : item.en}
            </Link>
          ))}
        </nav>
      </div>
      <p className="m-0 text-center text-caption text-[var(--ds-text-muted)]">
        © {new Date().getFullYear()} {isAr ? 'بصيرة للبحث العلمي — جميع الحقوق محفوظة.' : 'Baseerah — All rights reserved.'}
      </p>
    </div>
  </footer>
);
