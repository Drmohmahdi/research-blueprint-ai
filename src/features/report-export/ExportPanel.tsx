import React, { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../../design-system/components/Card';
import { FileText, Printer } from 'lucide-react';
import { generateStatisticalSyntax } from '../../utils/syntaxGenerator';

export const ExportPanel: React.FC = () => {
  const { activeProject, language } = useProject();
  const [sections, setSections] = useState({
    info: true,
    methodology: true,
    variables: true,
    hypotheses: true,
    syntax: true,
    reviews: true,
  });

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--ds-text-muted)] text-sm">
        {language === 'ar' ? 'يرجى اختيار مشروع بحثي لعرض مصدّر التقارير' : 'Please select a research project to show the report compiler'}
      </div>
    );
  }

  const handleToggle = (sec: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const syntax = generateStatisticalSyntax(activeProject);
  const isAr = language === 'ar';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Build the compiled HTML content for printing
    const title = isAr ? activeProject.titleAr : activeProject.titleEn;
    const inst = isAr ? activeProject.institutionAr : activeProject.institutionEn;
    const dept = isAr ? activeProject.departmentAr : activeProject.departmentEn;
    const desc = isAr ? activeProject.descriptionAr : activeProject.descriptionEn;
    const prob = isAr ? activeProject.problemStatementAr : activeProject.problemStatementEn;

    let contentHtml = `
      <div class="print-document" dir="${isAr ? 'rtl' : 'ltr'}">
        <!-- Title Page -->
        <div class="title-page">
          <div class="header-info">
            <p>${inst || ''}</p>
            <p>${dept || ''}</p>
          </div>
          <div class="main-title">
            <h1>${title || ''}</h1>
            <p class="subtitle">${isAr ? 'تقرير منهجي إحصائي شامل لدراسة مقترحة' : 'Comprehensive Methodological & Statistical Research Blueprint'}</p>
          </div>
          <div class="footer-info">
            <p>${isAr ? 'منصة بصيرة للبحث العلمي' : 'Baseerah Research Platform'}</p>
            <p>${new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</p>
          </div>
        </div>

        <div class="page-break"></div>
    `;

    if (sections.info) {
      contentHtml += `
        <div class="section">
          <h2>${isAr ? '1. البيانات الأساسية وملخص الفكرة' : '1. Basic Information & Abstract'}</h2>
          <table class="data-table">
            <tr>
              <th>${isAr ? 'العنوان بالعربية' : 'Arabic Title'}</th>
              <td>${activeProject.titleAr || '—'}</td>
            </tr>
            <tr>
              <th>${isAr ? 'العنوان بالإنجليزية' : 'English Title'}</th>
              <td>${activeProject.titleEn || '—'}</td>
            </tr>
            <tr>
              <th>${isAr ? 'المؤسسة الأكاديمية' : 'Institution'}</th>
              <td>${activeProject.institutionAr || '—'}</td>
            </tr>
          </table>
          <h3>${isAr ? 'الملخص العلمي للبحث' : 'Research Abstract'}</h3>
          <p>${desc || '—'}</p>
          <h3>${isAr ? 'المشكلة البحثية والفجوة المعرفية' : 'Problem Statement'}</h3>
          <p>${prob || '—'}</p>
        </div>
      `;
    }

    if (sections.methodology) {
      contentHtml += `
        <div class="section">
          <h2>${isAr ? '2. المنهج وتصميم الدراسة' : '2. Study Design & Methodology'}</h2>
          <p>${isAr ? 'منهج الدراسة المعتمد:' : 'Primary methodology design:'} <strong>${activeProject.studyDesign.toUpperCase()}</strong></p>
          <table class="data-table">
            <tr>
              <th>${isAr ? 'مستوى الدلالة (α)' : 'Significance Level (α)'}</th>
              <td>${activeProject.sampleSettings?.marginOfError || 0.05}</td>
            </tr>
            <tr>
              <th>${isAr ? 'القوة الإحصائية المستهدفة' : 'Target Power (1-β)'}</th>
              <td>${activeProject.sampleSettings?.expectedPower || 0.80}</td>
            </tr>
            <tr>
              <th>${isAr ? 'حجم الأثر المتوقع (d)' : 'Expected Effect Size (d)'}</th>
              <td>${activeProject.sampleSettings?.expectedEffectSize || 0.5}</td>
            </tr>
          </table>
        </div>
      `;
    }

    if (sections.variables && activeProject.variables?.length > 0) {
      contentHtml += `
        <div class="section">
          <h2>${isAr ? '3. متغيرات وأدوات القياس' : '3. Variables & Measurement Tools'}</h2>
          <table class="items-table">
            <thead>
              <tr>
                <th>${isAr ? 'اسم المتغير' : 'Variable Name'}</th>
                <th>${isAr ? 'النوع' : 'Type'}</th>
                <th>${isAr ? 'مستوى القياس' : 'Scale'}</th>
              </tr>
            </thead>
            <tbody>
              ${activeProject.variables.map((v: any) => `
                <tr>
                  <td>${isAr ? v.nameAr || v.nameEn : v.nameEn || v.nameAr}</td>
                  <td>${v.type}</td>
                  <td>${v.scale}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (sections.hypotheses && activeProject.hypotheses?.length > 0) {
      contentHtml += `
        <div class="section">
          <h2>${isAr ? '4. الفروض الإحصائية وأسئلة الدراسة' : '4. Research Hypotheses & Questions'}</h2>
          <ul>
            ${activeProject.hypotheses.map((h: any) => `
              <li>${isAr ? h.textAr || h.textEn : h.textEn || h.textAr} (Type: ${h.type})</li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    if (sections.syntax) {
      contentHtml += `
        <div class="section">
          <h2>${isAr ? '5. أكواد وبروتوكولات التحليل الجاهزة' : '5. Statistical Analysis Syntax'}</h2>
          <h3>SPSS Syntax</h3>
          <pre class="code-block">${syntax.spss}</pre>
          <h3>R Code</h3>
          <pre class="code-block">${syntax.r}</pre>
        </div>
      `;
    }

    contentHtml += `</div>`;

    // Write printable document shell
    printWindow.document.write(`
      <html>
        <head>
          <title>${title || 'Research Blueprint'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Outfit:wght@400;700&display=swap');
            
            body {
              font-family: ${isAr ? "'Cairo', sans-serif" : "'Outfit', sans-serif"};
              background-color: white;
              color: #1a1a1a;
              margin: 0;
              padding: 0;
            }

            .print-document {
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
              line-height: 1.8;
            }

            .title-page {
              min-height: 90vh;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
              padding: 40px 0;
            }

            .header-info {
              font-size: 14px;
              font-weight: bold;
              text-align: right;
            }

            .main-title {
              margin: auto 0;
            }

            .main-title h1 {
              font-size: 32px;
              font-weight: 900;
              color: #2e1065;
              line-height: 1.4;
            }

            .subtitle {
              font-size: 16px;
              color: #6b7280;
              margin-top: 10px;
            }

            .footer-info {
              font-size: 12px;
              color: #6b7280;
            }

            .section {
              margin-bottom: 40px;
            }

            .section h2 {
              font-size: 20px;
              border-bottom: 2px solid #2e1065;
              padding-bottom: 8px;
              color: #2e1065;
              margin-top: 30px;
            }

            .data-table, .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }

            .data-table th, .data-table td, .items-table th, .items-table td {
              border: 1px solid #e5e7eb;
              padding: 12px;
              font-size: 13px;
            }

            .data-table th {
              background-color: #f9fafb;
              width: 30%;
              text-align: right;
            }

            .items-table th {
              background-color: #2e1065;
              color: white;
              text-align: right;
            }

            .code-block {
              background-color: #f3f4f6;
              border: 1px solid #e5e7eb;
              padding: 15px;
              border-radius: 8px;
              font-family: monospace;
              font-size: 11px;
              white-space: pre-wrap;
              direction: ltr;
              text-align: left;
            }

            .page-break {
              page-break-after: always;
            }

            @media print {
              body {
                padding: 0;
              }
              .print-document {
                padding: 0;
                max-width: 100%;
              }
              .title-page {
                min-height: 100%;
                page-break-after: always;
              }
              .code-block {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${contentHtml}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/30 via-violet-900/15 to-transparent border border-purple-500/15 rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-purple-600/10">
            <FileText size={22} className="text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--ds-text-primary)] m-0">
              {isAr ? 'مصدّر التقارير الأكاديمية والمناهج' : 'Academic Report Exporter'}
            </h2>
            <p className="text-xs text-[var(--ds-text-secondary)] m-0">
              {isAr ? 'تجميع وتصدير مخطط الدراسة بالكامل وطباعته أو حفظه كـ PDF وفقاً للمقاييس الأكاديمية' : 'Compile, customize, and export your research blueprint to print or save as PDF'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Settings */}
        <Card className="p-5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl space-y-4 md:col-span-1">
          <h3 className="text-sm font-bold text-[var(--ds-text-primary)] m-0 pb-2 border-b border-[var(--ds-border-subtle)]">
            {isAr ? 'خيارات التجميع' : 'Compilation Options'}
          </h3>
          <div className="space-y-3">
            {[
              { key: 'info', labelAr: 'البيانات الأساسية وملخص الدراسة', labelEn: 'Basic Info & Abstract' },
              { key: 'methodology', labelAr: 'المنهجية وحجم العينة', labelEn: 'Methodology & Sample' },
              { key: 'variables', labelAr: 'جدول المتغيرات ومستويات القياس', labelEn: 'Variables & Scales' },
              { key: 'hypotheses', labelAr: 'الأسئلة والفروض البحثية', labelEn: 'Questions & Hypotheses' },
              { key: 'syntax', labelAr: 'أكواد التحليل المقترحة (SPSS/R)', labelEn: 'Statistical Syntax' },
            ].map(sec => (
              <label key={sec.key} className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[var(--ds-text-secondary)]">
                <input
                  type="checkbox"
                  checked={sections[sec.key as keyof typeof sections]}
                  onChange={() => handleToggle(sec.key as keyof typeof sections)}
                  className="rounded accent-purple-600"
                />
                <span>{isAr ? sec.labelAr : sec.labelEn}</span>
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-[var(--ds-border-subtle)]">
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Printer size={14} />
              <span>{isAr ? 'طباعة وحفظ كـ PDF' : 'Print & Save to PDF'}</span>
            </button>
          </div>
        </Card>

        {/* Live Preview compilation */}
        <Card className="p-6 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-3xl md:col-span-2 space-y-6 max-h-[600px] overflow-y-auto">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--ds-border-subtle)]">
            <span className="text-xs font-black text-purple-500 uppercase tracking-widest">
              {isAr ? 'معاينة حية للمستند المجمع' : 'Document Live Preview'}
            </span>
            <span className="text-[10px] font-bold text-[var(--ds-text-muted)]">A4 Draft</span>
          </div>

          {/* Simulated Page */}
          <div className="space-y-6 text-xs text-[var(--ds-text-primary)] leading-relaxed select-none opacity-80">
            {sections.info && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-purple-600 border-b border-[var(--ds-border-subtle)] pb-1 m-0">
                  {isAr ? '1. البيانات الأساسية للبحث وملخص الدراسة' : '1. Basic Info & Abstract'}
                </h4>
                <p><strong>{isAr ? 'عنوان البحث:' : 'Title:'}</strong> {isAr ? activeProject.titleAr : activeProject.titleEn}</p>
                <p><strong>{isAr ? 'المؤسسة:' : 'Institution:'}</strong> {isAr ? activeProject.institutionAr : activeProject.institutionEn}</p>
                <p><strong>{isAr ? 'الملخص العلمي:' : 'Abstract:'}</strong> {isAr ? activeProject.descriptionAr : activeProject.descriptionEn}</p>
              </div>
            )}

            {sections.methodology && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-purple-600 border-b border-[var(--ds-border-subtle)] pb-1 m-0">
                  {isAr ? '2. المنهج وتصميم الدراسة' : '2. Study Design & Methodology'}
                </h4>
                <p><strong>{isAr ? 'المنهج المعتمد:' : 'Methodology:'}</strong> {activeProject.studyDesign.toUpperCase()}</p>
                <p><strong>{isAr ? 'حجم العينة المقترح:' : 'Suggested sample:'}</strong> {activeProject.sampleSettings?.populationSize || 100} ({isAr ? 'بدرجة دقة' : 'margin of error'} {activeProject.sampleSettings?.marginOfError})</p>
              </div>
            )}

            {sections.variables && activeProject.variables?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-purple-600 border-b border-[var(--ds-border-subtle)] pb-1 m-0">
                  {isAr ? '3. متغيرات الدراسة وأدوات القياس' : '3. Variables & Measurement Tools'}
                </h4>
                <div className="border border-[var(--ds-border-subtle)] rounded-xl overflow-hidden">
                  {activeProject.variables.map((v: any) => (
                    <div key={v.id} className="p-2 border-b border-[var(--ds-border-subtle)] flex justify-between bg-[var(--ds-surface-secondary)] text-[10px]">
                      <span>{isAr ? v.nameAr || v.nameEn : v.nameEn || v.nameAr}</span>
                      <span className="font-bold uppercase opacity-65">{v.type} ({v.scale})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.hypotheses && activeProject.hypotheses?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-purple-600 border-b border-[var(--ds-border-subtle)] pb-1 m-0">
                  {isAr ? '4. الفروض الإحصائية والأسئلة' : '4. Hypotheses & Questions'}
                </h4>
                <ul className="list-disc pl-4 space-y-1">
                  {activeProject.hypotheses.map((h: any) => (
                    <li key={h.id}>{isAr ? h.textAr || h.textEn : h.textEn || h.textAr}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
