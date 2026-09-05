import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { 
  Brain, 
  Award, 
  User as UserIcon, 
  Lock, 
  Mail, 
  Globe, 
  Sun, 
  Moon, 
  ArrowRight,
  ArrowLeft,
  GraduationCap
} from 'lucide-react';
import { Card } from '../design-system/components/Card';
import { Button } from '../design-system/components/Button';
import { Input } from '../design-system/components/FormControls';
import { apiForgotPassword, apiResetPassword, apiVerifyEmail } from '../utils/api';
import { rememberIntendedPlan } from '../marketing/funnel';
import { FUNNEL_EVENTS, track } from '../utils/analytics';

const PLAN_DISPLAY_NAMES: Record<string, { ar: string; en: string }> = {
  STARTER: { ar: 'الباحث', en: 'Starter' },
  PROFESSIONAL: { ar: 'الفرق', en: 'Professional' },
  INSTITUTIONAL: { ar: 'المؤسسات', en: 'Institutional' },
};

export const Login: React.FC = () => {
  const {
    login,
    register,
    language,
    setLanguage,
    theme,
    toggleTheme
  } = useProject();

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [selectedRole, setSelectedRole] = useState<'Researcher' | 'Student' | 'Supervisor'>('Researcher');
  
  // Inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [searchParams] = useSearchParams();
  
  // States
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const verify = searchParams.get('verify');
    if (verify) {
      void apiVerifyEmail(verify).then((ok) => {
        setSuccessMsg(ok
          ? (language === 'ar' ? 'تم تأكيد بريدك. يمكنك تسجيل الدخول.' : 'Email confirmed. You can sign in.')
          : (language === 'ar' ? 'رابط التأكيد غير صالح أو منتهٍ.' : 'This confirmation link is invalid or expired.'));
        if (!ok) setErrorMsg(language === 'ar' ? 'تعذر تأكيد البريد.' : 'Could not confirm email.');
      });
    }
    const token = searchParams.get('token');
    if (token) {
      setResetToken(token);
      setAuthMode('reset');
      return;
    }
    if (searchParams.get('mode') === 'register') {
      setAuthMode('register');
      track(FUNNEL_EVENTS.beginRegistration, { plan: searchParams.get('plan') || 'FREE' });
    }
    rememberIntendedPlan(searchParams.get('plan'));
  }, [searchParams, language]);

  useEffect(() => {
    document.title = language === 'ar'
      ? 'دخول أو إنشاء حساب — بصيرة'
      : 'Sign in or create an account — Baseerah';
  }, [language]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (authMode === 'login') {
        const ok = await login(usernameInput, passwordInput);
        if (!ok) {
          setErrorMsg(
            language === 'ar' 
              ? 'فشل تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.' 
              : 'Login failed. Please check your username and password.'
          );
        }
      } else if (authMode === 'forgot') {
        const result = await apiForgotPassword(emailInput);
        if (result?.ok) {
          if (result.reset_token) {
            setSuccessMsg(
              language === 'ar'
                ? 'إن وُجد الحساب، صُدر رمز إعادة التعيين. استخدم الرمز الظاهر في بيئة التطوير.'
                : 'If the account exists, a reset token was issued. Use the development token shown below.'
            );
            setResetToken(result.reset_token);
            setAuthMode('reset');
          } else {
            setSuccessMsg(
              language === 'ar'
                ? 'إن وُجد الحساب، أُرسل رابط إعادة التعيين إلى البريد المسجّل.'
                : 'If the account exists, a reset link was sent to the registered email.'
            );
          }
        } else {
          setErrorMsg(language === 'ar' ? 'تعذر إرسال طلب إعادة التعيين.' : 'Could not request a password reset.');
        }
      } else if (authMode === 'reset') {
        if (passwordInput.length < 8 || !/[a-zA-Z]/.test(passwordInput) || !/[0-9]/.test(passwordInput)) {
          setErrorMsg(
            language === 'ar'
              ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل وأن تحتوي على أحرف وأرقام.'
              : 'Password must be at least 8 characters long and contain both letters and numbers.'
          );
          setIsLoading(false);
          return;
        }
        const ok = await apiResetPassword(resetToken, passwordInput);
        if (ok) {
          setSuccessMsg(language === 'ar' ? 'تم تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.' : 'Password updated. You can sign in now.');
          setAuthMode('login');
          setPasswordInput('');
        } else {
          setErrorMsg(language === 'ar' ? 'رمز إعادة التعيين غير صالح أو منتهٍ.' : 'The reset token is invalid or expired.');
        }
      } else {
        // Validate password strength on client
        if (passwordInput.length < 8 || !/[a-zA-Z]/.test(passwordInput) || !/[0-9]/.test(passwordInput)) {
          setErrorMsg(
            language === 'ar'
              ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل وأن تحتوي على أحرف وأرقام.'
              : 'Password must be at least 8 characters long and contain both letters and numbers.'
          );
          setIsLoading(false);
          return;
        }

        const ok = await register(usernameInput, passwordInput, emailInput, selectedRole);
        if (ok) {
          setSuccessMsg(
            language === 'ar'
              ? 'تم إنشاء الحساب وتسجيل الدخول.'
              : 'Account created. You are now signed in.'
          );
        } else {
          setErrorMsg(
            language === 'ar' 
              ? 'فشل إنشاء الحساب. ربما اسم المستخدم أو البريد الإلكتروني مسجل بالفعل.' 
              : 'Registration failed. Username or email may already be in use.'
          );
        }
      }
    } catch  {
      setErrorMsg(
        language === 'ar' 
          ? 'حدث خطأ غير متوقع أثناء الاتصال بالخادم.' 
          : 'An unexpected error occurred while connecting to server.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const intendedPlan = searchParams.get('plan');
  const rolesConfig = [
    {
      id: 'Researcher' as const,
      titleAr: 'باحث أكاديمي',
      titleEn: 'Academic Researcher',
      descAr: 'تصميم الدراسات، ومحاكاة البيانات، والتنبؤ بالنتائج وتصدير التقارير.',
      descEn: 'Design studies, simulate data, forecast outcomes, and export reports.',
      icon: Brain,
      shadow: 'shadow-[var(--ds-shadow-glow)]'
    },
    {
      id: 'Student' as const,
      titleAr: 'طالب دراسات عليا',
      titleEn: 'Graduate student',
      descAr: 'رسالة أو أطروحة: تصميم المنهجية، البيانات، والتقدم مع المشرف.',
      descEn: 'Thesis path: method design, data, and progress with a supervisor.',
      icon: GraduationCap,
      shadow: 'shadow-[var(--ds-shadow-layered)]'
    },
    {
      id: 'Supervisor' as const,
      titleAr: 'مشرف / محكّم',
      titleEn: 'Supervisor / reviewer',
      descAr: 'تحكيم الخطط البحثية، وإضافة تعليقات المراجعة، وتقييم الجاهزية.',
      descEn: 'Evaluate study protocols, add comments, and review readiness.',
      icon: Award,
      shadow: 'shadow-[var(--ds-shadow-layered)]'
    }
  ];

  return (
    <div className="baseerah-marketing min-h-screen w-full relative flex items-center justify-center overflow-hidden font-sans select-none px-4 py-12">
      
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -right-[20%] w-[80vw] h-[80vw] rounded-full bg-[var(--ds-aurora-emerald)] blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[20%] w-[70vw] h-[70vw] rounded-full bg-[var(--ds-aurora-gold)] blur-[120px]" />
        <div className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] rounded-full bg-[var(--ds-aurora-navy)] blur-[80px]" />
      </div>

      {/* ── Top Floating Toggles ── */}
      <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center max-w-6xl mx-auto">
        {/* Brand Name Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline text-inherit">
          <div className="p-2 rounded-xl bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/25 text-[var(--ds-primary-bright)]">
            <Brain size={20} />
          </div>
          <span className="text-sm font-black tracking-widest baseerah-gradient-text">
            {language === 'ar' ? 'بصيرة' : 'BASEERAH'}
          </span>
        </Link>

        {/* Toggles */}
        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] hover:bg-[var(--ds-surface-secondary)] text-xs font-bold text-[var(--ds-text-secondary)] ds-transition cursor-pointer shadow-sm"
          >
            <Globe size={14} className="text-[var(--ds-primary-bright)]" />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? (language === 'ar' ? 'تفعيل الوضع الفاتح' : 'Use light theme') : (language === 'ar' ? 'تفعيل الوضع الداكن' : 'Use dark theme')}
            className="p-2 rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] ds-transition cursor-pointer shadow-sm"
          >
            {theme === 'dark' ? <Sun size={14} className="text-[var(--ds-accent-gold)]" /> : <Moon size={14} className="text-[var(--ds-navy-elevated)]" />}
          </button>
        </div>
      </div>

      {/* ── Login Glassmorphism Box ── */}
      <main className="w-full max-w-4xl z-10 space-y-6 animate-fade-in">
        
        {/* Main Content Layout */}
        <Card className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] shadow-[var(--ds-shadow-layered)] rounded-[32px] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          <div className="hidden lg:flex lg:col-span-5 bg-[var(--ds-surface-secondary)] p-8 flex-col justify-between border-e border-[var(--ds-border-subtle)] relative">
            <span aria-hidden className="absolute inset-y-0 start-0 w-1 bg-[var(--ds-primary)]" />
            
            <div className="space-y-4 relative z-10 ps-2">
              <span className="px-2.5 py-1 rounded-md text-[9px] font-black bg-[var(--ds-accent-gold-soft)] border border-[var(--ds-accent-gold)]/25 text-[var(--ds-accent-gold)] tracking-wider uppercase">
                {language === 'ar' ? 'الجودة الأكاديمية السعودية' : 'Saudi Academic Premium'}
              </span>
              <h1 className="text-h1 text-ink m-0">
                {language === 'ar' 
                  ? 'المختبر الأكاديمي الذكي للبحث العلمي' 
                  : 'The Intelligent Academic Research Lab'}
              </h1>
              <p className="text-caption text-secondary font-semibold">
                {language === 'ar'
                  ? 'بوابة متكاملة لتصميم الدراسات، التحليل الإحصائي التلقائي، محاكاة السيناريوهات، المراجعة والتحكيم وعزل البيانات.'
                  : 'An all-in-one portal for designing studies, automated statistics, outcome forecasting, peer review, and secure isolation.'}
              </p>
            </div>

            {/* Premium Illustration SVG */}
            <div className="my-8 flex justify-center items-center">
              <svg className="w-48 h-48" viewBox="0 0 200 200" fill="none">
                <circle cx="100" cy="100" r="70" stroke="url(#paint0_linear)" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="100" cy="100" r="50" stroke="url(#paint1_linear)" strokeWidth="1.5" />
                <path d="M70 100 H130 M100 70 V130" stroke="var(--ds-primary)" strokeWidth="0.5" strokeOpacity="0.5" />
                
                <circle cx="70" cy="100" r="4" fill="var(--ds-primary)" />
                <circle cx="130" cy="100" r="4" fill="var(--ds-accent-gold)" />
                <circle cx="100" cy="70" r="4" fill="var(--ds-primary-bright)" />
                <circle cx="100" cy="130" r="4" fill="var(--ds-accent-gold-bright)" />
                
                {/* Center Core glowing brain icon symbol */}
                <g transform="translate(85,85)">
                  <path d="M15 5 C10 5, 5 10, 5 15 C5 22, 12 28, 15 30 C18 28, 25 22, 25 15 C25 10, 20 5, 15 5 Z" fill="url(#paint2_linear)" opacity="0.8" />
                  <path d="M15 11 A4 4 0 1 0 15 19 A4 4 0 1 0 15 11" fill="#ffffff" />
                </g>
                
                <defs>
                  <linearGradient id="paint0_linear" x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--ds-primary)" />
                    <stop offset="1" stopColor="var(--ds-accent-gold)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="paint1_linear" x1="50" y1="50" x2="150" y2="150" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--ds-accent-gold)" />
                    <stop offset="1" stopColor="var(--ds-primary-active)" />
                  </linearGradient>
                  <linearGradient id="paint2_linear" x1="5" y1="5" x2="25" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--ds-primary)" />
                    <stop offset="1" stopColor="var(--ds-accent-gold)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="text-[10px] text-[var(--ds-text-muted)] font-bold border-t border-[var(--ds-border-subtle)] pt-4">
              {language === 'ar' ? 'منصة بصيرة © ٢٠٢٦ حقوق الطبع محفوظة.' : 'Baseerah © 2026. All rights reserved.'}
            </div>
          </div>

          {/* Right Column: Interactive Login/Register Form */}
          <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between space-y-6">
            
            {/* Header info */}
            <div className="space-y-1.5 text-center lg:text-right">
              <h2 className="text-h2 text-ink m-0">
                {authMode === 'login' 
                  ? (language === 'ar' ? 'مرحباً بك مجدداً في بصيرة' : 'Welcome Back to Baseerah')
                  : authMode === 'forgot'
                  ? (language === 'ar' ? 'استعادة كلمة المرور' : 'Reset your password')
                  : authMode === 'reset'
                  ? (language === 'ar' ? 'كلمة مرور جديدة' : 'Choose a new password')
                  : (language === 'ar' ? 'إنشاء حساب جديد بالمنصة' : 'Join Baseerah Platform')}
              </h2>
              <p className="text-caption text-[var(--ds-text-muted)] font-bold">
                {authMode === 'login'
                  ? (language === 'ar' ? 'قم بتسجيل الدخول للبدء بمراجعة أو تعديل أبحاثك.' : 'Sign in to access your research workspace.')
                  : authMode === 'forgot'
                  ? (language === 'ar' ? 'أدخل بريد الحساب. إن وُجد سيُصدر رمز إعادة التعيين.' : 'Enter the account email. If it exists, a reset token will be issued.')
                  : authMode === 'reset'
                  ? (language === 'ar' ? 'أدخل الرمز وكلمة المرور الجديدة.' : 'Enter the token and a new password.')
                  : (language === 'ar' ? 'اختر نوع حسابك العلمي واملأ البيانات للتسجيل.' : 'Choose your academic account type and enter details.')}
              </p>
            </div>

            {/* Error and Success Alerts */}
            {errorMsg && (
              <div role="alert" className="p-3.5 border border-danger/20 bg-danger/5 text-danger rounded-xl text-xs font-bold text-center leading-normal animate-shake">
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div role="status" className="p-3.5 border border-[var(--ds-success)]/20 bg-[var(--ds-success-soft)] text-[var(--ds-success)] rounded-xl text-xs font-bold text-center leading-normal">
                {successMsg}
              </div>
            )}

            {/* ── Registration Account Role Selector ── */}
            {authMode === 'register' && (
              <>
            {intendedPlan && (
              <p className="m-0 text-[11px] font-semibold text-[var(--ds-text-secondary)] rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] p-3">
                {language === 'ar'
                  ? `اخترت باقة ${PLAN_DISPLAY_NAMES[intendedPlan]?.ar ?? intendedPlan}. بعد الدخول يمكنك طلب الترقية من الفوترة داخل الحساب.`
                  : `You selected the ${PLAN_DISPLAY_NAMES[intendedPlan]?.en ?? intendedPlan} plan. After sign-in you can request the upgrade from billing.`}
              </p>
            )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest block">
                  {language === 'ar' ? 'حدد نوع حسابك الأكاديمي' : 'Select Academic Account Type'}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {rolesConfig.map((roleItem) => {
                    const RoleIcon = roleItem.icon;
                    const isSelected = selectedRole === roleItem.id;
                    return (
                      <button
                        key={roleItem.id}
                        type="button"
                        onClick={() => setSelectedRole(roleItem.id)}
                        className={`text-right flex flex-col justify-between p-3.5 rounded-2xl border ds-transition cursor-pointer relative overflow-hidden group bg-[var(--ds-surface-secondary)] ${
                          isSelected 
                            ? `border-[var(--ds-primary)]/70 ${roleItem.shadow}`
                            : 'border-[var(--ds-border-subtle)] hover:border-[var(--ds-border-default)] hover:bg-[var(--ds-surface-tertiary)]'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <div className="p-2 rounded-xl bg-action text-on-action">
                            <RoleIcon size={16} />
                          </div>
                          {isSelected && (
                            <span className="h-2 w-2 rounded-full bg-[var(--ds-primary-bright)]" />
                          )}
                        </div>
                        <div className="mt-4">
                          <h4 className="text-h4 text-ink m-0">
                            {language === 'ar' ? roleItem.titleAr : roleItem.titleEn}
                          </h4>
                          <p className="text-[9px] text-[var(--ds-text-muted)] font-bold leading-normal mt-1 mb-0 line-clamp-2">
                            {language === 'ar' ? roleItem.descAr : roleItem.descEn}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-bold text-[var(--ds-text-secondary)]">
              {authMode === 'login' || authMode === 'register' ? (
              <Input
                label={language === 'ar' ? 'اسم المستخدم' : 'Username'}
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل اسم المستخدم...' : 'Enter username...'}
                prefixIcon={<UserIcon size={14} />}
              />
              ) : null}

              {(authMode === 'register' || authMode === 'forgot') && (
                <Input
                  label={language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  prefixIcon={<Mail size={14} />}
                />
              )}

              {authMode === 'reset' && (
                <Input
                  label={language === 'ar' ? 'رمز إعادة التعيين' : 'Reset token'}
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                />
              )}

              {(authMode === 'login' || authMode === 'register' || authMode === 'reset') && (
                <Input
                  label={language === 'ar' ? 'كلمة المرور' : 'Password'}
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  prefixIcon={<Lock size={14} />}
                />
              )}

              <Button type="submit" loading={isLoading} fullWidth iconAfter={language === 'ar' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}>
                {authMode === 'login' ? (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')
                  : authMode === 'forgot' ? (language === 'ar' ? 'طلب إعادة التعيين' : 'Request reset')
                  : authMode === 'reset' ? (language === 'ar' ? 'حفظ كلمة المرور' : 'Save password')
                  : (language === 'ar' ? 'تسجيل الحساب' : 'Create Account')}
              </Button>
            </form>

            {/* Bottom Form Switcher */}
            <div className="text-center pt-4 border-t border-[var(--ds-border-subtle)] space-y-2">
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setErrorMsg(''); setSuccessMsg(''); }}
                  className="block w-full text-[var(--ds-text-muted)] hover:text-[var(--ds-primary-bright)] text-xs font-bold bg-transparent border-none cursor-pointer"
                >
                  {language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'register' || authMode === 'forgot' || authMode === 'reset' ? 'login' : 'register');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-[var(--ds-primary-bright)] hover:text-[var(--ds-accent-gold)] hover:underline text-xs font-black bg-transparent border-none cursor-pointer"
              >
                {authMode === 'login'
                  ? (language === 'ar' ? 'لا تملك حساباً؟ أنشئ حساباً أكاديمياً الآن' : 'Do not have an account? Sign up')
                  : (language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to sign in')}
              </button>
            </div>

          </div>
        </Card>
      </main>

      {/* Styled Animations Injected */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        .animate-fade-in {
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

    </div>
  );
};
export default Login;
