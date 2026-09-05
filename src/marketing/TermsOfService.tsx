import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { PublicFooter, PublicHeader } from './PublicChrome';
import { CONTACT_EMAIL, CONTACT_PHONE } from './contact';
const LAST_UPDATED = '2026-09-05';

interface Section {
  titleAr: string;
  titleEn: string;
  bodyAr: React.ReactNode;
  bodyEn: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    titleAr: '1. مقدمة وقبول الشروط',
    titleEn: '1. Introduction and Acceptance',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        تحكم هذه الشروط والأحكام استخدامك لمنصة "بصيرة للبحث العلمي" ("المنصة")، المقدَّمة من مشغّل المنصة ("نحن"، "المشغّل"). بإنشائك حسابًا أو استخدامك للمنصة بأي شكل، فإنك تُقرّ بموافقتك على هذه الشروط بالكامل. إن كنت لا توافق على أي بند منها، يُرجى عدم استخدام المنصة.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        These Terms govern your use of the "Baseerah Academic Suite" platform ("the Platform"), provided by the platform operator ("we", "us"). By creating an account or using the Platform in any way, you acknowledge that you accept these Terms in full. If you do not agree to any provision, please do not use the Platform.
      </p>
    ),
  },
  {
    titleAr: '2. وصف الخدمة',
    titleEn: '2. Description of Service',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        بصيرة منصة رقمية تُقدّم أدوات لدعم دورة حياة البحث العلمي: تصميم الدراسات، تحليل البيانات، محاكاة النتائج المتوقعة، إدارة الرسائل العلمية، التحكيم العلمي، وتحضير النشر الأكاديمي. المنصة أداة مساعدة لتنظيم العمل البحثي وتحليله — وليست بديلاً عن الإشراف الأكاديمي أو المراجعة العلمية المتخصصة أو القرار النهائي للجهات المختصة (المشرف، لجنة المناقشة، المجلة العلمية).
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        Baseerah is a digital platform offering tools across the research lifecycle: study design, data analysis, outcome simulation, thesis management, peer review, and publication readiness. The Platform assists in organizing and analyzing research work — it does not replace academic supervision, specialized scholarly review, or the final decision of the relevant authority (supervisor, examination committee, or journal).
      </p>
    ),
  },
  {
    titleAr: '3. الحسابات والتسجيل',
    titleEn: '3. Accounts and Registration',
    bodyAr: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>يجب أن تكون المعلومات المُقدَّمة عند التسجيل دقيقة ومحدَّثة.</li>
        <li>أنت مسؤول عن الحفاظ على سرية بيانات دخولك وعن كل نشاط يتم عبر حسابك.</li>
        <li>يجب إخطارنا فورًا عند الاشتباه بأي استخدام غير مصرَّح به لحسابك.</li>
        <li>لا يجوز إنشاء أكثر من حساب واحد بغرض تجاوز حدود الباقة المجانية أو إساءة استخدام الموارد.</li>
      </ul>
    ),
    bodyEn: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>Information provided at registration must be accurate and kept up to date.</li>
        <li>You are responsible for safeguarding your login credentials and for all activity under your account.</li>
        <li>You must notify us immediately of any suspected unauthorized use of your account.</li>
        <li>Creating multiple accounts to circumvent free-tier limits or otherwise abuse platform resources is not permitted.</li>
      </ul>
    ),
  },
  {
    titleAr: '4. الاشتراكات والفوترة',
    titleEn: '4. Subscriptions and Billing',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        تُقدّم المنصة باقة مجانية بحدود استخدام محدّدة، وباقات مدفوعة توسّع هذه الحدود وتضيف ميزات إضافية. عند تفعيل الدفع الإلكتروني، ستُعرَض تفاصيل السعر والتجديد والإلغاء بوضوح قبل إتمام أي عملية اشتراك، ولن يُحصَّل أي مبلغ دون موافقتك الصريحة.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        The Platform offers a free tier with defined usage limits, and paid tiers that expand those limits and add features. Once online payment is enabled, pricing, renewal, and cancellation terms will be shown clearly before any subscription is completed, and no charge will be made without your explicit consent.
      </p>
    ),
  },
  {
    titleAr: '5. الاستخدام المقبول',
    titleEn: '5. Acceptable Use',
    bodyAr: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>عدم استخدام المنصة لأي غرض غير قانوني أو ينتهك حقوق الغير.</li>
        <li>عدم محاولة الوصول غير المصرَّح به لأنظمة المنصة أو بيانات مستخدمين آخرين.</li>
        <li>عدم رفع بيانات بحثية تحتوي على معلومات شخصية حساسة لمشاركين دون الحصول على موافقتهم المسبقة وفق الأصول الأخلاقية للبحث العلمي.</li>
        <li>عدم استغلال أدوات الذكاء الاصطناعي في المنصة لإنتاج محتوى مضلِّل أو انتحال أعمال علمية.</li>
      </ul>
    ),
    bodyEn: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>Do not use the Platform for any unlawful purpose or in a way that infringes others' rights.</li>
        <li>Do not attempt unauthorized access to Platform systems or other users' data.</li>
        <li>Do not upload research data containing sensitive personal information about participants without their prior informed consent, per standard research ethics.</li>
        <li>Do not use the Platform's AI tools to produce misleading content or to plagiarize academic work.</li>
      </ul>
    ),
  },
  {
    titleAr: '6. ملكية المحتوى والبيانات',
    titleEn: '6. Content and Data Ownership',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        تبقى كل بياناتك البحثية ومحتواك المرفوع على المنصة ملكًا خاصًا بك بالكامل. نحن لا نطالب بأي ملكية على أبحاثك أو بياناتك، ولا نستخدمها لأي غرض خارج تقديم الخدمة لك. تبقى حقوق الملكية الفكرية للمنصة نفسها (الكود، التصميم، العلامة التجارية) محفوظة للمشغّل.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        All your research data and uploaded content remain entirely your own property. We do not claim any ownership over your research or data, and we do not use it for any purpose beyond providing the service to you. Intellectual property rights in the Platform itself (code, design, branding) remain with the operator.
      </p>
    ),
  },
  {
    titleAr: '7. الذكاء الاصطناعي وإخلاء المسؤولية',
    titleEn: '7. AI Features and Disclaimer',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        تتضمن بعض أدوات المنصة مساعدة قائمة على الذكاء الاصطناعي (تحليل العناوين، التنبؤ بالنتائج، المساعدة الأكاديمية). هذه المخرجات استرشادية دائمًا، تتطلب مراجعة وتحققًا بشريًا، ولا تُعتبر بديلاً عن الحكم العلمي المتخصص أو قرارًا نهائيًا بأي شكل. المنصة توضح ذلك صراحة في كل مخرج يُنتجه الذكاء الاصطناعي.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        Some Platform tools include AI-assisted features (title analysis, outcome prediction, academic assistance). These outputs are always advisory, require human review and verification, and are never a substitute for specialized scholarly judgment or a final decision of any kind. The Platform states this explicitly on every AI-generated output.
      </p>
    ),
  },
  {
    titleAr: '8. إنهاء الحساب',
    titleEn: '8. Account Termination',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        يمكنك إغلاق حسابك في أي وقت. نحتفظ بالحق في تعليق أو إنهاء أي حساب يخالف هذه الشروط بشكل جوهري، مع إشعار مسبق حيثما أمكن ذلك عمليًا. لن يؤدي إنهاء الحساب إلى حذف بياناتك البحثية فورًا؛ راجع سياسة الخصوصية لمعرفة مدة الاحتفاظ بالبيانات.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        You may close your account at any time. We reserve the right to suspend or terminate any account that materially violates these Terms, with prior notice where practicable. Account termination does not immediately delete your research data; see the Privacy Policy for data retention details.
      </p>
    ),
  },
  {
    titleAr: '9. حدود المسؤولية',
    titleEn: '9. Limitation of Liability',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        تُقدَّم المنصة "كما هي" دون ضمانات صريحة أو ضمنية بخلوّها التام من الأخطاء. لا يتحمل المشغّل مسؤولية أي قرار أكاديمي أو بحثي يُتخذ بناءً حصرًا على مخرجات المنصة دون مراجعة بشرية مستقلة، ضمن الحدود التي يسمح بها النظام المعمول به.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        The Platform is provided "as is" without express or implied warranties of being entirely error-free. The operator is not liable for any academic or research decision made solely on Platform output without independent human review, to the extent permitted by applicable law.
      </p>
    ),
  },
  {
    titleAr: '10. القانون الحاكم',
    titleEn: '10. Governing Law',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        تخضع هذه الشروط وتُفسَّر وفقًا لأنظمة المملكة العربية السعودية.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        These Terms are governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia.
      </p>
    ),
  },
  {
    titleAr: '11. التعديلات على الشروط',
    titleEn: '11. Changes to These Terms',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        قد نُحدّث هذه الشروط من وقت لآخر. سيُنشَر أي تعديل جوهري على هذه الصفحة مع تحديث تاريخ آخر مراجعة أدناه، واستمرارك في استخدام المنصة بعد النشر يُعدّ قبولًا بالتحديث.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        We may update these Terms from time to time. Any material change will be posted on this page with an updated "last revised" date below, and continued use of the Platform after posting constitutes acceptance of the update.
      </p>
    ),
  },
];

export const TermsOfService: React.FC = () => {
  const { language } = useProject();
  const isAr = language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-[var(--ds-background-canvas)] flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      <PublicHeader isAr={isAr} />

      <main className="ds-measure mx-auto px-4 sm:px-6 py-12 flex-1 w-full">
        <Link to="/" className="inline-flex items-center gap-1.5 text-caption font-semibold text-[var(--ds-text-secondary)] no-underline hover:text-[var(--ds-primary)] mb-6">
          <BackIcon size={15} />
          {isAr ? 'العودة للرئيسية' : 'Back to home'}
        </Link>
        <h1 className="text-display-lg m-0 mb-2">{isAr ? 'الشروط والأحكام' : 'Terms of Service'}</h1>
        <p className="text-caption text-[var(--ds-text-muted)] m-0 mb-10">
          {isAr ? `آخر تحديث: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`}
        </p>

        <div className="space-y-10">
          {SECTIONS.map((s, i) => (
            <section key={i}>
              <h2 className="text-h3 m-0 mb-3">{isAr ? s.titleAr : s.titleEn}</h2>
              {isAr ? s.bodyAr : s.bodyEn}
            </section>
          ))}

          <section>
            <h2 className="text-h3 m-0 mb-3">{isAr ? '12. التواصل' : '12. Contact'}</h2>
            <p className="text-body text-[var(--ds-text-secondary)] m-0">
              {isAr
                ? <>لأي استفسار حول هذه الشروط، يُرجى التواصل عبر البريد <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--ds-primary)] underline">{CONTACT_EMAIL}</a> أو الهاتف <span dir="ltr">{CONTACT_PHONE}</span>.</>
                : <>For any question about these Terms, please contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--ds-primary)] underline">{CONTACT_EMAIL}</a> or by phone at <span dir="ltr">{CONTACT_PHONE}</span>.</>}
            </p>
          </section>
        </div>
      </main>
      <PublicFooter isAr={isAr} />
    </div>
  );
};

export default TermsOfService;
