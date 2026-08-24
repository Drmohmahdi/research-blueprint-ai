import React, { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { Card } from '../design-system/components/Card';

export const Login: React.FC = () => {
  const {
    login,
    register,
    language,
    setLanguage,
    theme,
    toggleTheme
  } = useProject();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<'Researcher' | 'Supervisor' | 'SystemAdmin'>('Researcher');
  
  // Inputs
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  
  // States
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
              ? 'تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.' 
              : 'Account created successfully! You can now sign in.'
          );
          setAuthMode('login');
          setPasswordInput('');
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
      id: 'Supervisor' as const,
      titleAr: 'محكّم علمي',
      titleEn: 'Scientific Reviewer',
      descAr: 'تحكيم الخطط البحثية، وإضافة تعليقات المراجعة، وتقييم الجاهزية للنشر.',
      descEn: 'Evaluate study protocols, add supervisor comments, and approve plans.',
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
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/25 text-[var(--ds-primary-bright)]">
            <Brain size={20} />
          </div>
          <span className="text-sm font-black tracking-widest baseerah-gradient-text">
            {language === 'ar' ? 'بصيرة' : 'BASEERAH'}
          </span>
        </div>

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
      <div className="w-full max-w-4xl z-10 space-y-6 animate-fade-in">
        
        {/* Main Content Layout */}
        <Card className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] shadow-[var(--ds-shadow-layered)] rounded-[32px] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          <div className="hidden lg:flex lg:col-span-5 bg-[var(--ds-surface-secondary)] p-8 flex-col justify-between border-e border-[var(--ds-border-subtle)] relative">
            <span aria-hidden className="absolute inset-y-0 start-0 w-1 bg-[var(--ds-primary)]" />
            
            <div className="space-y-4 relative z-10 ps-2">
              <span className="px-2.5 py-1 rounded-md text-[9px] font-black bg-[var(--ds-accent-gold-soft)] border border-[var(--ds-accent-gold)]/25 text-[var(--ds-accent-gold)] tracking-wider uppercase">
                {language === 'ar' ? 'الجودة الأكاديمية السعودية' : 'Saudi Academic Premium'}
              </span>
              <h1 className="text-2xl font-black leading-tight text-ink m-0">
                {language === 'ar' 
                  ? 'المختبر الأكاديمي الذكي للبحث العلمي' 
                  : 'The Intelligent Academic Research Lab'}
              </h1>
              <p className="text-xs text-secondary leading-relaxed font-semibold">
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
              <h2 className="text-xl md:text-2xl font-black text-ink m-0 tracking-wide">
                {authMode === 'login' 
                  ? (language === 'ar' ? 'مرحباً بك مجدداً في بصيرة' : 'Welcome Back to Baseerah')
                  : (language === 'ar' ? 'إنشاء حساب جديد بالمنصة' : 'Join Baseerah Platform')}
              </h2>
              <p className="text-xs text-[var(--ds-text-muted)] font-bold leading-normal">
                {authMode === 'login'
                  ? (language === 'ar' ? 'قم بتسجيل الدخول للبدء بمراجعة أو تعديل أبحاثك.' : 'Sign in to access your research workspace.')
                  : (language === 'ar' ? 'اختر نوع حسابك العلمي واملأ البيانات للتسجيل.' : 'Choose your academic account type and enter details.')}
              </p>
            </div>

            {/* Error and Success Alerts */}
            {errorMsg && (
              <div className="p-3.5 border border-danger/20 bg-danger/5 text-danger rounded-xl text-xs font-bold text-center leading-normal animate-shake">
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div className="p-3.5 border border-[var(--ds-success)]/20 bg-[var(--ds-success-soft)] text-[var(--ds-success)] rounded-xl text-xs font-bold text-center leading-normal">
                {successMsg}
              </div>
            )}

            {/* ── Registration Account Role Selector ── */}
            {authMode === 'register' && (
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
                          <h4 className="text-xs font-black text-ink m-0">
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
            )}

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-bold text-[var(--ds-text-secondary)]">
              
              {/* Username field */}
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--ds-text-muted)] block">{language === 'ar' ? 'اسم المستخدم' : 'Username'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-3.5 flex items-center text-[var(--ds-text-muted)]">
                    <UserIcon size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder={language === 'ar' ? 'أدخل اسم المستخدم...' : 'Enter username...'}
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-default)] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] text-[var(--ds-text-primary)] placeholder-[var(--ds-text-disabled)]"
                  />
                </div>
              </div>

              {/* Email field (Register Mode Only) */}
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--ds-text-muted)] block">{language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-3.5 flex items-center text-[var(--ds-text-muted)]">
                      <Mail size={14} />
                    </span>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-default)] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] text-[var(--ds-text-primary)] placeholder-[var(--ds-text-disabled)]"
                    />
                  </div>
                </div>
              )}

              {/* Password field */}
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--ds-text-muted)] block">{language === 'ar' ? 'كلمة المرور' : 'Password'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-3.5 flex items-center text-[var(--ds-text-muted)]">
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-default)] rounded-xl py-2.5 pr-10 pl-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] text-[var(--ds-text-primary)] placeholder-[var(--ds-text-disabled)]"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl font-black text-center flex justify-center items-center gap-2 cursor-pointer shadow-[var(--ds-shadow-glow)] bg-action hover:bg-action-hover text-on-action ds-transition disabled:opacity-50 disabled:cursor-not-allowed border-none text-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{language === 'ar' ? 'جاري التحقق...' : 'Authenticating...'}</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === 'login' ? (language === 'ar' ? 'تسجيل الدخول' : 'Sign In') : (language === 'ar' ? 'تسجيل الحساب' : 'Create Account')}</span>
                    {language === 'ar' ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                  </>
                )}
              </button>
            </form>

            {/* Bottom Form Switcher */}
            <div className="text-center pt-4 border-t border-[var(--ds-border-subtle)]">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-[var(--ds-primary-bright)] hover:text-[var(--ds-accent-gold)] hover:underline text-xs font-black bg-transparent border-none cursor-pointer"
              >
                {authMode === 'login' 
                  ? (language === 'ar' ? 'لا تملك حساباً؟ أنشئ حساباً أكاديمياً الآن' : 'Do not have an account? Sign up')
                  : (language === 'ar' ? 'لديك حساب بالفعل؟ سجل دخولك' : 'Already have an account? Sign in')}
              </button>
            </div>

          </div>
        </Card>
      </div>

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
