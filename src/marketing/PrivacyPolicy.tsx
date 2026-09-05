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
    titleAr: '1. مقدمة',
    titleEn: '1. Introduction',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        توضح هذه السياسة كيف تجمع منصة "بصيرة للبحث العلمي" بياناتك وتستخدمها وتحميها عند استخدامك للمنصة. نلتزم بمعالجة بياناتك بما يتوافق مع نظام حماية البيانات الشخصية في المملكة العربية السعودية.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        This policy explains how the "Baseerah Academic Suite" platform collects, uses, and protects your data when you use the Platform. We are committed to processing your data in a manner consistent with Saudi Arabia's Personal Data Protection Law (PDPL).
      </p>
    ),
  },
  {
    titleAr: '2. البيانات التي نجمعها',
    titleEn: '2. Data We Collect',
    bodyAr: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li><b className="text-[var(--ds-text-primary)]">بيانات الحساب:</b> اسم المستخدم، البريد الإلكتروني، كلمة المرور المُشفَّرة، الدور الأكاديمي.</li>
        <li><b className="text-[var(--ds-text-primary)]">بيانات بحثية:</b> عناوين الأبحاث، المتغيرات، الفرضيات، الملفات والبيانات التي ترفعها بنفسك ضمن مشاريعك البحثية.</li>
        <li><b className="text-[var(--ds-text-primary)]">بيانات الاستخدام:</b> سجلات الدخول، الإجراءات داخل المنصة، عناوين IP لأغراض الأمان ومنع إساءة الاستخدام.</li>
        <li><b className="text-[var(--ds-text-primary)]">بيانات الفوترة</b> (عند تفعيل الدفع الإلكتروني): تفاصيل الاشتراك، لا تُخزَّن أرقام البطاقات لدينا مباشرة، بل تُعالَج عبر بوابة دفع معتمدة.</li>
      </ul>
    ),
    bodyEn: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li><b className="text-[var(--ds-text-primary)]">Account data:</b> username, email, hashed password, academic role.</li>
        <li><b className="text-[var(--ds-text-primary)]">Research data:</b> study titles, variables, hypotheses, and any files or data you upload within your research projects.</li>
        <li><b className="text-[var(--ds-text-primary)]">Usage data:</b> login records, in-platform actions, and IP addresses for security and abuse-prevention purposes.</li>
        <li><b className="text-[var(--ds-text-primary)]">Billing data</b> (once online payment is enabled): subscription details — card numbers are never stored directly by us and are handled by a licensed payment gateway.</li>
      </ul>
    ),
  },
  {
    titleAr: '3. كيف نستخدم بياناتك',
    titleEn: '3. How We Use Your Data',
    bodyAr: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>تقديم وظائف المنصة الأساسية (تخزين مشاريعك، تحليل بياناتك، عرض لوحات التحكم).</li>
        <li>التواصل معك بشأن حسابك (تفعيل البريد، استعادة كلمة المرور، تنبيهات مهمة).</li>
        <li>تحسين الأمان واكتشاف الاستخدام غير الطبيعي أو المسيء.</li>
        <li>تطوير المنصة وتحسين أدائها، دون بيع بياناتك أو مشاركتها لأغراض تسويقية لأي طرف ثالث.</li>
      </ul>
    ),
    bodyEn: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>Providing core Platform functionality (storing your projects, analyzing your data, rendering dashboards).</li>
        <li>Communicating with you about your account (email verification, password recovery, important alerts).</li>
        <li>Improving security and detecting abnormal or abusive use.</li>
        <li>Improving the Platform's performance — we never sell your data or share it for third-party marketing purposes.</li>
      </ul>
    ),
  },
  {
    titleAr: '4. مشاركة البيانات مع أطراف ثالثة',
    titleEn: '4. Third-Party Data Sharing',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        عند استخدامك لميزات الذكاء الاصطناعي الاختيارية، يُرسَل نص طلبك (مثل عنوان بحثي) إلى مزوّد خدمة الذكاء الاصطناعي (Google Gemini) لمعالجته وإرجاع النتيجة، دون إرسال بياناتك البحثية الكاملة أو ملفاتك المرفوعة. تُستضاف المنصة على خوادم مزوّد استضافة (Hostinger). لا نشارك بياناتك مع أي طرف آخر إلا بموجب أمر قانوني نافذ.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        When you use optional AI features, your request text (e.g., a research title) is sent to our AI service provider (Google Gemini) for processing and returning a result — your full research data or uploaded files are not sent. The Platform is hosted on infrastructure provided by our hosting provider (Hostinger). We do not share your data with any other party except where required by a valid legal order.
      </p>
    ),
  },
  {
    titleAr: '5. تخزين البيانات وأمانها',
    titleEn: '5. Data Storage and Security',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        نستخدم تشفيرًا لكلمات المرور، ونطبّق ضوابط وصول صارمة تمنع أي مستخدم من الوصول لبيانات مشروع لا علاقة له به، حتى داخل المؤسسة نفسها. تُنسَخ قاعدة البيانات احتياطيًا بشكل يومي. رغم ذلك، لا يمكن ضمان أمان مطلق لأي نظام متصل بالإنترنت.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        We encrypt passwords and enforce strict access controls that prevent any user from accessing a project they have no relationship to, even within the same organization. The database is backed up daily. That said, no internet-connected system can guarantee absolute security.
      </p>
    ),
  },
  {
    titleAr: '6. مدة الاحتفاظ بالبيانات',
    titleEn: '6. Data Retention',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        نحتفظ ببياناتك طالما كان حسابك نشطًا. عند طلب حذف حسابك، تُحذف بياناتك الشخصية القابلة للتعريف خلال مدة معقولة، باستثناء ما يلزم الاحتفاظ به لأغراض نظامية أو محاسبية أو لحل نزاع قائم.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        We retain your data for as long as your account remains active. Upon a request to delete your account, your identifiable personal data is deleted within a reasonable period, except where retention is required for legal, accounting, or dispute-resolution purposes.
      </p>
    ),
  },
  {
    titleAr: '7. حقوقك على بياناتك',
    titleEn: '7. Your Rights Over Your Data',
    bodyAr: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>حق الاطلاع على بياناتك الشخصية المحفوظة لدينا.</li>
        <li>حق طلب تصحيح أي بيانات غير دقيقة.</li>
        <li>حق طلب حذف حسابك وبياناتك، وفق ما هو مبيّن في بند مدة الاحتفاظ أعلاه.</li>
        <li>حق سحب موافقتك على المعالجة غير الأساسية للخدمة في أي وقت.</li>
      </ul>
    ),
    bodyEn: (
      <ul className="text-body text-[var(--ds-text-secondary)] m-0 ps-5 space-y-2">
        <li>The right to access the personal data we hold about you.</li>
        <li>The right to request correction of any inaccurate data.</li>
        <li>The right to request deletion of your account and data, per the retention terms above.</li>
        <li>The right to withdraw consent for any non-essential processing at any time.</li>
      </ul>
    ),
  },
  {
    titleAr: '8. ملفات تعريف الارتباط (Cookies)',
    titleEn: '8. Cookies',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        نستخدم كوكي جلسة واحد فقط (HttpOnly) للحفاظ على تسجيل دخولك بأمان بين الطلبات — لا نستخدم أي كوكيز تتبّع إعلاني أو تحليل سلوك عبر مواقع أخرى.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        We use a single, HttpOnly session cookie to keep you securely signed in between requests — we do not use any advertising-tracking or cross-site behavioral-analytics cookies.
      </p>
    ),
  },
  {
    titleAr: '9. خصوصية القُصَّر',
    titleEn: '9. Children’s Privacy',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        المنصة موجَّهة للباحثين وطلاب الدراسات العليا، ولا تستهدف عمدًا الأطفال دون سن 18 عامًا. إن تبيّن لنا جمع بيانات قاصر دون موافقة ولي الأمر، سنبادر لحذفها.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        The Platform is intended for researchers and graduate students, and does not knowingly target children under 18. If we learn that a minor's data was collected without parental consent, we will delete it promptly.
      </p>
    ),
  },
  {
    titleAr: '10. التغييرات على هذه السياسة',
    titleEn: '10. Changes to This Policy',
    bodyAr: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        قد نُحدّث هذه السياسة من وقت لآخر. سيُنشَر أي تعديل جوهري هنا مع تحديث تاريخ آخر مراجعة أدناه.
      </p>
    ),
    bodyEn: (
      <p className="text-body text-[var(--ds-text-secondary)] m-0">
        We may update this policy from time to time. Any material change will be posted here with an updated "last revised" date below.
      </p>
    ),
  },
];

export const PrivacyPolicy: React.FC = () => {
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
        <h1 className="text-display-lg m-0 mb-2">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
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
            <h2 className="text-h3 m-0 mb-3">{isAr ? '11. التواصل لطلبات الخصوصية' : '11. Contact for Privacy Requests'}</h2>
            <p className="text-body text-[var(--ds-text-secondary)] m-0">
              {isAr
                ? <>لممارسة أي من حقوقك أعلاه أو لأي استفسار حول الخصوصية، يُرجى التواصل عبر البريد <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--ds-primary)] underline">{CONTACT_EMAIL}</a> أو الهاتف <span dir="ltr">{CONTACT_PHONE}</span>.</>
                : <>To exercise any of the rights above or for any privacy question, please contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--ds-primary)] underline">{CONTACT_EMAIL}</a> or by phone at <span dir="ltr">{CONTACT_PHONE}</span>.</>}
            </p>
          </section>
        </div>
      </main>
      <PublicFooter isAr={isAr} />
    </div>
  );
};

export default PrivacyPolicy;
