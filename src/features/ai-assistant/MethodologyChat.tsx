import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Brain, Send, User, Bot, Sparkles, Loader2, Trash2, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PathPanel } from '../../design-system/components/Navigation';
import { EmptyState } from '../../design-system/components/Feedback';
import { apiAIAssist } from '../../utils/api';
import type { AIAssistResponse, AISourceRef } from '../../utils/api';
import { researchStorage } from '../../utils/researchStorage';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: AISourceRef[];
  grounded?: boolean;
  aiGenerated?: boolean;
  requiresVerification?: boolean;
  humanAuthority?: boolean;
  provider?: string;
  sourceError?: string;
}

// ── Local AI Engine (rule-based methodology assistant) ─────────────────────────
function generateLocalResponse(question: string, projectContext: any, lang: 'ar' | 'en'): string {
  const q = question.toLowerCase();
  const isAr = lang === 'ar';

  // Sample size questions
  if (q.includes('عينة') || q.includes('sample') || q.includes('حجم')) {
    const pop = projectContext?.sampleSettings?.populationSize || 100;
    const groups = projectContext?.sampleSettings?.groupsCount || 2;
    const effect = projectContext?.sampleSettings?.expectedEffectSize || 0.5;
    const power = projectContext?.sampleSettings?.expectedPower || 0.80;
    const minN = Math.ceil((Math.pow(1.96 + 0.84, 2) * 2) / (effect * effect));
    
    return isAr
      ? `بناءً على بيانات مشروعك:\n• حجم المجتمع: ${pop}\n• عدد المجموعات: ${groups}\n• حجم الأثر المتوقع (d): ${effect}\n• القوة الإحصائية المستهدفة: ${power}\n\n**الحد الأدنى المحسوب للعينة**: ${minN} مشاركاً لكل مجموعة\n**الإجمالي مع احتساب الفاقد (15%)**: ${Math.ceil(minN * groups * 1.15)} مشاركاً\n\n💡 **توصية**: إذا كان حجم الأثر صغيراً (d < 0.3)، ستحتاج عينة أكبر بكثير. راجع حاسبة حجم العينة.`
      : `Based on your project data:\n• Population: ${pop}\n• Groups: ${groups}\n• Expected effect size (d): ${effect}\n• Target power: ${power}\n\n**Minimum sample**: ${minN} per group\n**Total with 15% attrition**: ${Math.ceil(minN * groups * 1.15)} participants\n\n💡 **Tip**: For small effects (d < 0.3), you need a much larger sample.`;
  }

  // Statistical test questions
  if (q.includes('اختبار') || q.includes('test') || q.includes('إحصائي') || q.includes('statistical')) {
    const design = projectContext?.studyDesign || 'quasi_experimental_pre_post';
    const vars = projectContext?.variables || [];
    const depVars = vars.filter((v: any) => v.type === 'dependent');
    
    const testMap: Record<string, { ar: string; en: string }> = {
      'quasi_experimental_pre_post': { ar: 'تحليل التباين المصاحب (ANCOVA) — لضبط الفروق القبلية بين المجموعتين', en: 'ANCOVA — to control for pre-test differences' },
      'experimental_rct': { ar: 'اختبار تاء للمجموعات المستقلة أو ANOVA أحادي الاتجاه', en: 'Independent t-test or One-way ANOVA' },
      'single_group_pre_post': { ar: 'اختبار تاء للمجموعات المرتبطة (Paired t-test)', en: 'Paired t-test' },
      'descriptive': { ar: 'إحصاءات وصفية (متوسطات، انحرافات معيارية، تكرارات)', en: 'Descriptive statistics (means, SD, frequencies)' },
      'correlational': { ar: 'معامل ارتباط بيرسون أو سبيرمان حسب مستوى القياس', en: 'Pearson or Spearman correlation coefficient' },
      'predictive': { ar: 'تحليل الانحدار المتعدد (Multiple Regression)', en: 'Multiple Regression Analysis' },
    };

    const rec = testMap[design] || testMap['quasi_experimental_pre_post'];
    
    return isAr
      ? `بناءً على تصميم دراستك (${design}):\n\n**الاختبار الإحصائي الموصى به**: ${rec.ar}\n\n${depVars.length > 1 ? '⚠️ لديك أكثر من متغير تابع — فكر في استخدام MANOVA بدلاً من اختبارات منفصلة لتقليل خطأ Type I.' : ''}\n\n**شروط الاستخدام**:\n1. التوزيع الطبيعي للبيانات (اختبار Shapiro-Wilk)\n2. تجانس التباينات (اختبار Levene)\n3. استقلالية الملاحظات`
      : `Based on your study design (${design}):\n\n**Recommended test**: ${rec.en}\n\n${depVars.length > 1 ? '⚠️ Multiple DVs detected — consider MANOVA to control Type I error.' : ''}\n\n**Assumptions to check**:\n1. Normality (Shapiro-Wilk test)\n2. Homogeneity of variances (Levene's test)\n3. Independence of observations`;
  }

  // Missing data questions
  if (q.includes('فاقد') || q.includes('missing') || q.includes('مفقود') || q.includes('ناقص')) {
    return isAr
      ? `**معالجة القيم المفقودة — دليل سريع:**\n\n1. **أقل من 5% مفقود**: حذف الحالة (Listwise deletion) — مقبول\n2. **5-20% مفقود**: استبدال بالمتوسط أو الوسيط — مقبول بحذر\n3. **أكثر من 20% مفقود**: التعويض المتعدد (Multiple Imputation) — إلزامي\n\n⚠️ **تحذير**: لا تستخدم استبدال المتوسط إذا كانت البيانات مفقودة بشكل غير عشوائي (MNAR).\n\n**في SPSS**:\n\`\`\`\nANALYZE → MULTIPLE IMPUTATION → IMPUTE MISSING DATA VALUES\n\`\`\``
      : `**Handling Missing Data — Quick Guide:**\n\n1. **< 5% missing**: Listwise deletion — acceptable\n2. **5-20% missing**: Mean/median imputation — use cautiously\n3. **> 20% missing**: Multiple Imputation — mandatory\n\n⚠️ **Warning**: Don't use mean imputation if data is MNAR.\n\n**In SPSS**: ANALYZE → MULTIPLE IMPUTATION`;
  }

  // Effect size questions
  if (q.includes('أثر') || q.includes('effect') || q.includes('كوهين') || q.includes('cohen')) {
    return isAr
      ? `**تفسير حجم الأثر (Cohen's d):**\n\n| القيمة | التصنيف | المعنى العملي |\n|--------|---------|-------------|\n| d < 0.2 | ضعيف | فرق بالكاد ملاحظ |\n| d = 0.2-0.5 | صغير | فرق ملموس لكن بسيط |\n| d = 0.5-0.8 | متوسط | فرق واضح عملياً |\n| d > 0.8 | كبير | فرق جوهري مؤثر |\n\n**حجم الأثر في مشروعك**: d = ${projectContext?.sampleSettings?.expectedEffectSize || '?'}\n\n💡 في البحوث التربوية، d = 0.4 يُعتبر ذا دلالة عملية مقبولة (Hattie, 2009).`
      : `**Effect Size Interpretation (Cohen's d):**\n\n| Value | Category | Practical Meaning |\n|-------|----------|------------------|\n| d < 0.2 | Negligible | Barely noticeable |\n| d = 0.2-0.5 | Small | Tangible but modest |\n| d = 0.5-0.8 | Medium | Practically significant |\n| d > 0.8 | Large | Substantial impact |\n\n**Your project**: d = ${projectContext?.sampleSettings?.expectedEffectSize || '?'}`;
  }

  // Default response
  return isAr
    ? `شكراً لسؤالك! بناءً على بيانات مشروعك الحالي:\n\n• **التصميم**: ${projectContext?.studyDesign || 'غير محدد'}\n• **المتغيرات**: ${projectContext?.variables?.length || 0} متغير\n• **الفروض**: ${projectContext?.hypotheses?.length || 0} فرض\n\nيمكنني مساعدتك في:\n- حجم العينة المناسب\n- اختيار الاختبار الإحصائي\n- معالجة القيم المفقودة\n- تفسير حجم الأثر\n- صياغة الفروض الإحصائية\n\nاطرح سؤالاً محدداً وسأقدم لك إجابة منهجية دقيقة.`
    : `Thanks for your question! Based on your current project:\n\n• **Design**: ${projectContext?.studyDesign || 'Not set'}\n• **Variables**: ${projectContext?.variables?.length || 0}\n• **Hypotheses**: ${projectContext?.hypotheses?.length || 0}\n\nI can help with:\n- Sample size calculation\n- Statistical test selection\n- Missing data handling\n- Effect size interpretation\n- Hypothesis formulation\n\nAsk a specific question for a detailed methodological answer.`;
}

// ── Component ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'rb_chat_';

export const MethodologyChat: React.FC = () => {
  const { activeProject, language } = useProject();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const projectId = activeProject?.id || 'global';

  // Load chat history
  useEffect(() => {
    const saved = researchStorage.getItem(STORAGE_KEY + projectId);
    if (saved) setMessages(JSON.parse(saved));
    else setMessages([]);
  }, [projectId]);

  // Scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const persist = (msgs: ChatMessage[]) => {
    researchStorage.setItem(STORAGE_KEY + projectId, JSON.stringify(msgs));
    setMessages(msgs);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    const updatedWithUser = [...messages, userMsg];
    persist(updatedWithUser);
    setInput('');
    setIsTyping(true);

    // Preferred path: governed backend AI (entitlement-enforced). If the org
    // lacks AI_ASSISTANCE or the provider fails, fall back to the local
    // rule-based engine — clearly labeled as a local fallback.
    let content: string;
    let sources: AISourceRef[] = [];
    let grounded = false;
    let provider = 'local-rule-engine';
    let sourceError: string | undefined;
    let aiGenerated = false;

    try {
      const aiResp: AIAssistResponse | null = await apiAIAssist({
        use_case: 'METHODOLOGY_EXPLANATION',
        question: input,
        project_id: activeProject?.id,
      });
      if (aiResp) {
        content = aiResp.text;
        sources = aiResp.sources ?? [];
        grounded = aiResp.grounded;
        provider = aiResp.provider;
        aiGenerated = aiResp.ai_generated;
      } else {
        sourceError = isAr
          ? 'تعذر الوصول إلى الذكاء الاصطناعي المرخص؛ استخدم المحرك المحلي.'
          : 'Governed AI unavailable; using the local rule engine.';
        content = generateLocalResponse(input, activeProject, language);
      }
    } catch {
      sourceError = isAr
        ? 'تعذر الوصول إلى الذكاء الاصطناعي المرخص؛ استخدم المحرك المحلي.'
        : 'Governed AI unavailable; using the local rule engine.';
      content = generateLocalResponse(input, activeProject, language);
    }

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      sources,
      grounded,
      aiGenerated,
      requiresVerification: true,
      humanAuthority: true,
      provider,
      sourceError,
    };

    persist([...updatedWithUser, assistantMsg]);
    setIsTyping(false);
  };

  const clearChat = () => {
    persist([]);
  };

  const isAr = language === 'ar';

  // Quick suggestion buttons
  const suggestions = isAr
    ? ['هل حجم عينتي كافٍ؟', 'ما أنسب اختبار إحصائي؟', 'كيف أعالج القيم المفقودة؟', 'كيف أفسر حجم الأثر؟']
    : ['Is my sample size enough?', 'Best statistical test?', 'How to handle missing data?', 'How to interpret effect size?'];

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <PathPanel accent="var(--ds-path-data)">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-action/10">
            <Brain size={22} className="text-ai" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-ink m-0">
              {isAr ? 'مساعد المنهجية الذكي' : 'Methodology Assistant'}
            </h2>
            <p className="text-xs text-secondary m-0">
              {isAr ? 'اسألني عن تصميم دراستك، الاختبارات الإحصائية، أو أي سؤال منهجي' : 'Ask about study design, statistical tests, or any methodology question'}
            </p>
          </div>
        </div>
      </PathPanel>

      {/* Chat area */}
      <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ height: '500px' }}>
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <EmptyState
                bare
                className="py-2"
                illustration={<Sparkles size={32} />}
                title={isAr ? 'ابدأ بسؤال منهجي' : 'Start with a methodology question'}
                description={isAr ? 'سأساعدك بناءً على بيانات مشروعك الحالي.' : "I'll use your project data for context."}
              />
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); }}
                    className="px-3 py-1.5 rounded-xl bg-ai/5 border border-ai/15 text-[10px] font-bold text-[var(--ds-text-primary)] hover:bg-ai/10 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                msg.role === 'user' ? 'bg-action' : 'bg-action/10'
              }`}>
                {msg.role === 'user' ? <User size={13} className="text-on-action" /> : <Bot size={13} className="text-success" />}
              </div>
              <div className={`max-w-[80%] space-y-2 ${
                msg.role === 'user' ? '' : ''
              }`}>
                <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-action text-on-action rounded-tr-sm'
                    : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-primary)] border border-[var(--ds-border-subtle)] rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>

                {/* Source display */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="px-3 py-2 rounded-lg bg-[var(--ds-surface-tertiary)] text-[10px] space-y-1">
                    <div className="font-bold text-[var(--ds-text-muted)] flex items-center gap-1">
                      <FileText size={10} />
                      <span>{isAr ? 'المصادر المستخدمة' : 'Sources used'}</span>
                    </div>
                    {msg.sources.map((s, i) => (
                      <div key={i} className="text-[var(--ds-text-secondary)]">
                        {s.title || s.source_id} <span className="text-[var(--ds-text-muted)]">({s.type})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Integrity notice */}
                {msg.role === 'assistant' && msg.aiGenerated && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/5 border border-warning/15 text-[9px] font-bold text-warning">
                    <AlertTriangle size={10} />
                    <span>{isAr
                      ? 'محتوى منشأ بالذكاء الاصطناعي — يتطلب مراجعة أكاديمية والتحقق من المصادر.'
                      : 'AI-generated content — requires academic review and source verification.'}
                    </span>
                  </div>
                )}

                {/* Provider status */}
                {msg.role === 'assistant' && !msg.aiGenerated && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ai/5 border border-ai/15 text-[9px] font-bold text-[var(--ds-text-primary)]">
                    <CheckCircle2 size={10} />
                    <span>{isAr ? 'محرك القواعد المحلي' : 'Local rule engine'}</span>
                  </div>
                )}

                {/* Source error */}
                {msg.role === 'assistant' && msg.sourceError && (
                  <div className="text-[9px] text-warning font-semibold">
                    {msg.sourceError}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3" role="status" aria-live="polite" aria-label={isAr ? 'المساعد ينشئ ردًا' : 'Assistant is generating a response'}>
              <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-action/10">
                <Bot size={13} className="text-success" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-tl-sm">
                <Loader2 size={14} className="text-ai motion-safe:animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="p-3 border-t border-[var(--ds-border-subtle)] flex gap-2">
          <button onClick={clearChat} className="p-2 rounded-xl hover:bg-danger/10 text-[var(--ds-text-muted)] cursor-pointer transition-colors" title={isAr ? 'مسح المحادثة' : 'Clear chat'}>
            <Trash2 size={14} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isAr ? 'اكتب سؤالك المنهجي هنا...' : 'Type your methodology question...'}
            aria-label={isAr ? 'سؤال منهجي للمساعد' : 'Methodology question for the assistant'}
            className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2.5 text-xs text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-2 focus:ring-ai/50"
          />
          <button
            onClick={handleSend}
            aria-label={isAr ? 'إرسال السؤال المنهجي' : 'Send methodology question'}
            disabled={!input.trim() || isTyping}
            className="px-4 py-2 rounded-xl bg-action hover:bg-action-hover text-on-action disabled:opacity-40 cursor-pointer ds-transition flex items-center gap-1.5"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
