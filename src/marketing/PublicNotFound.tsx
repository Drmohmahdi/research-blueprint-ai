import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { Button } from '../design-system/components/Button';
import { ROUTES } from '../router/routes';
import { PublicFooter, PublicHeader } from './PublicChrome';

export const PublicNotFound: React.FC = () => {
  const { language } = useProject();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="baseerah-marketing min-h-screen flex flex-col font-sans">
      <PublicHeader isAr={isAr} />
      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center px-4 py-16">
        <section className="max-w-lg text-center space-y-5" aria-labelledby="public-not-found-title">
          <p className="text-overline text-[var(--ds-accent-gold-text)] m-0 ds-numeric">404</p>
          <h1 id="public-not-found-title" className="text-h1 m-0">
            {isAr ? 'هذه الصفحة غير موجودة' : 'This page does not exist'}
          </h1>
          <p className="text-body-sm text-[var(--ds-text-secondary)] m-0">
            {isAr
              ? 'الرابط قد يكون قديمًا أو مكتوبًا خطأ. عد إلى الرئيسية، أو ابدأ حسابًا مجانيًا، أو راسلنا إن كنت تبحث عن عرض للجامعة.'
              : 'The link may be outdated or mistyped. Return home, start a free account, or contact us if you were looking for a university demo.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button onClick={() => navigate(ROUTES.MARKETING_HOME)}>
              {isAr ? 'العودة للرئيسية' : 'Back to home'}
            </Button>
            <Button variant="outline" onClick={() => navigate(ROUTES.REGISTER)}>
              {isAr ? 'ابدأ مجانًا' : 'Start free'}
            </Button>
            <Button variant="ghost" onClick={() => navigate(ROUTES.MARKETING_CONTACT)}>
              {isAr ? 'تواصل معنا' : 'Contact us'}
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter isAr={isAr} />
    </div>
  );
};

export default PublicNotFound;
