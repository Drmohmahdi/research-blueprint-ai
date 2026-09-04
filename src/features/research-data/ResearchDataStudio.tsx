import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Database, FileSpreadsheet, FlaskConical, Gauge, Play, Plus, Shield, Stethoscope, Unlock } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { PathPanel } from '../../design-system/components/Navigation';
import { EmptyState } from '../../design-system/components/Feedback';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../router/routes';
import { apiGetResearchDataCommandCenter, apiImportResearchDataset, apiUploadResearchDatasetFile } from '../../utils/api';
import { DatasetWorkbench } from './DatasetWorkbench';

type Indicators = { data_readiness:number; data_quality:number; analysis_readiness:number; analysis_completion:number; approval_status:string; staleness:number; sensitive_status:string; next_best_data_action:{priority:string;title:string} };
type Center = { metrics: {datasets:number;variables:number;quality_issues:number;analyses:number;approved_analyses:number;stale_analyses:number;under_review_analyses:number}; indicators:Indicators; next_action:{priority:string;title:string}; datasets:Array<{id:string;name:string;rows:number;variables:number;version:string;status:string;open_quality_issues:number;access_level:string}> };
const empty: Center = { metrics:{datasets:0,variables:0,quality_issues:0,analyses:0,approved_analyses:0,stale_analyses:0,under_review_analyses:0}, indicators:{data_readiness:0,data_quality:0,analysis_readiness:0,analysis_completion:0,approval_status:'NONE',staleness:0,sensitive_status:'NON_SENSITIVE',next_best_data_action:{priority:'CRITICAL',title:'Import a research dataset'}}, next_action:{priority:'CRITICAL',title:'Import a research dataset'}, datasets:[] };
const NEXT_ACTION_AR: Record<string,string> = {
  'Import a research dataset': 'استورد مجموعة بيانات بحثية',
  'Resolve open data quality issues': 'عالج مشكلات جودة البيانات المفتوحة',
  'Create and run the first linked analysis': 'شغّل أول تحليل موثّق',
  'Complete analysis review': 'أكمل مراجعة التحليل',
  'Re-run stale analyses against the current dataset version': 'أعد تشغيل التحليلات القديمة على الإصدار الحالي',
  'Review and pin validated results': 'راجع النتائج المعتمدة وثبّتها',
};

export const ResearchDataStudio: React.FC = () => {
  const navigate = useNavigate();
  const { activeProject, language } = useProject(); const ar=language==='ar';
  const [center,setCenter]=useState<Center>(empty); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const fileRef=useRef<HTMLInputElement>(null);
  const [selectedDataset,setSelectedDataset]=useState('');
  useEffect(()=>{fileRef.current?.setAttribute('tabindex','-1')},[]);
  const refresh=async()=>{if(!activeProject)return;const fresh=await apiGetResearchDataCommandCenter(activeProject.id);if(fresh)setCenter(fresh)};
  useEffect(()=>{ if(activeProject) apiGetResearchDataCommandCenter(activeProject.id).then(v=>v&&setCenter(v)).catch(()=>setError(ar?'تعذر تحميل بيانات مساحة العمل.':'Could not load workspace data.')); },[activeProject,ar]);
  const upload=async(e:React.ChangeEvent<HTMLInputElement>)=>{ const file=e.target.files?.[0]; if(!file||!activeProject)return; setLoading(true);setError(''); try { const uploaded=await apiUploadResearchDatasetFile(file,activeProject.id); if(!uploaded) throw new Error(); const imported=await apiImportResearchDataset({project_id:activeProject.id,uploaded_file_id:uploaded.id,name:file.name.replace(/\.(csv|xlsx)$/i,''),source_type:'OTHER',sensitivity:'INTERNAL'}); setSelectedDataset(imported.id); await refresh(); } catch { setError(ar?'تعذر استيراد الملف. تحقق من الصيغة والصلاحيات.':'Import failed. Check file format and permissions.'); } finally {setLoading(false);e.target.value='';} };
  const ind = center.indicators;
  const next = ind.next_best_data_action ?? center.next_action;
  const nextTitle = ar ? (NEXT_ACTION_AR[next.title] || next.title) : next.title;
  const metrics: Array<{Icon: typeof Database; label: string; value: number; tone: string}> = [
    {Icon:Database,label:ar?'مجموعات البيانات':'Datasets',value:center.metrics.datasets,tone:'text-ink'},
    {Icon:FileSpreadsheet,label:ar?'المتغيرات':'Variables',value:center.metrics.variables,tone:'text-ink'},
    {Icon:AlertTriangle,label:ar?'مشكلات الجودة':'Quality issues',value:center.metrics.quality_issues,tone:center.metrics.quality_issues>0?'text-warning':'text-ink'},
    {Icon:CheckCircle2,label:ar?'التحليلات':'Analyses',value:center.metrics.analyses,tone:'text-ink'},
  ];
  return <section className="mx-auto max-w-[1440px] min-w-0 space-y-6 overflow-x-clip pb-16" aria-labelledby="studio-title">
    <PathPanel accent="var(--ds-path-data)"><header><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><span className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--ds-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--ds-primary)]"><BarChart3 size={15}/>{ar?'مساحة تشغيل بحثية':'Research operating workspace'}</span><h2 id="studio-title" className="m-0 text-2xl font-black md:text-4xl">{ar?'بصيرة للبيانات والتحليل البحثي':'Research Data & Analysis Studio'}</h2><p className="mt-3 max-w-3xl text-[var(--ds-text-secondary)]">{ar?'حوّل البيانات الخام إلى نتائج بحثية موثوقة وقابلة للتفسير، مع حفظ الإصدارات وسجل كامل لقابلية إعادة الإنتاج.':'Turn raw data into interpretable research results with versioned datasets and a reproducible analysis trail.'}</p><p className="mt-2 text-sm font-bold">{activeProject?(ar?activeProject.titleAr:activeProject.titleEn):(ar?'لا يوجد مشروع نشط':'No active project')}</p></div><div className="flex flex-wrap gap-2"><input ref={fileRef} className="sr-only" type="file" accept=".csv,.xlsx" tabIndex={-1} aria-hidden="true" onChange={upload}/><Button loading={loading} iconBefore={<Plus size={17}/>} onClick={()=>fileRef.current?.click()} disabled={!activeProject}>{ar?'مجموعة بيانات':'Dataset'}</Button><Button variant="outline" iconBefore={<FlaskConical size={17}/>} onClick={()=>navigate(ROUTES.ANALYSIS_PLAN)}>{ar?'خطة التحليل الإحصائي':'Statistical analysis plan'}</Button></div></div></header></PathPanel>
    {error&&<div role="alert" className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-soft)] p-4 text-sm font-bold">{error}</div>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={ar?'مؤشرات المسار':'Studio metrics'}>{metrics.map(({Icon,label,value,tone})=><Card key={label} padding="sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--ds-primary-soft)] p-2 text-[var(--ds-primary)]"><Icon size={20}/></span><div><span className="block text-xs text-[var(--ds-text-secondary)]">{label}</span><strong className={`text-2xl ds-numeric ${tone}`}>{value}</strong></div></div></Card>)}</section>
    {/* Separate indicator cards — no single-score conflation */}
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" aria-label={ar?'مؤشرات مستقلة':'Independent indicators'} data-testid="rdcc-indicators">
      <Card padding="sm" data-testid="ind-data-readiness"><div className="flex items-center gap-2"><Gauge size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'جاهزية البيانات':'Data readiness'}</span></div><p className="text-2xl font-black ds-numeric mt-1">{ind.data_readiness}%</p></Card>
      <Card padding="sm" data-testid="ind-data-quality"><div className="flex items-center gap-2"><Stethoscope size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'جودة البيانات':'Data quality'}</span></div><p className="text-2xl font-black ds-numeric mt-1">{ind.data_quality}%</p></Card>
      <Card padding="sm" data-testid="ind-analysis-readiness"><div className="flex items-center gap-2"><FlaskConical size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'جاهزية التحليل':'Analysis readiness'}</span></div><p className="text-2xl font-black ds-numeric mt-1">{ind.analysis_readiness}%</p></Card>
      <Card padding="sm" data-testid="ind-analysis-completion"><div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'إنجاز التحليل':'Analysis completion'}</span></div><p className="text-2xl font-black ds-numeric mt-1">{ind.analysis_completion}%</p></Card>
      <Card padding="sm" data-testid="ind-approval-status"><div className="flex items-center gap-2"><Shield size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'حالة الاعتماد':'Approval status'}</span></div><p className="text-lg font-black mt-1">{ind.approval_status}</p></Card>
      <Card padding="sm" data-testid="ind-staleness"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'التحليلات القديمة':'Stale analyses'}</span></div><p className="text-2xl font-black ds-numeric mt-1">{ind.staleness}</p></Card>
      <Card padding="sm" data-testid="ind-sensitive-status"><div className="flex items-center gap-2"><Unlock size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'حالة البيانات الحساسة':'Sensitive status'}</span></div><p className="text-lg font-black mt-1">{ind.sensitive_status}</p></Card>
      <Card padding="sm" variant={next.priority==='CRITICAL'||next.priority==='HIGH'?'warning':'ai-accent'} data-testid="ind-next-action"><div className="flex items-center gap-2"><Play size={16} className="text-[var(--ds-primary)]"/><span className="text-xs font-bold">{ar?'الإجراء التالي':'Next action'}</span></div><p className="text-sm font-bold mt-1">{nextTitle}</p><span className="inline-block mt-1 rounded-full bg-[var(--ds-surface-primary)] px-2 py-0.5 text-[10px] font-black">{next.priority}</span></Card>
    </section>
    <Card padding="none"><div className="border-b border-[var(--ds-border-subtle)] p-5"><h2 className="m-0 text-lg font-black">{ar?'مدير مجموعات البيانات':'Dataset manager'}</h2></div>{center.datasets.length===0?<EmptyState bare illustration={<Database size={42}/>} title={ar?'لا توجد مجموعات بيانات بعد':'No datasets yet'} description={ar?'ابدأ بملف CSV أو XLSX. سيبقى الملف الخام محفوظًا دون تعديل.':'Start with CSV or XLSX. The raw file remains immutable.'}/>:<div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]"><tr>{(ar?['الاسم','الصفوف','المتغيرات','الإصدار','الحالة','مشكلات مفتوحة','صلاحية الوصول']:['Name','Rows','Variables','Version','Status','Open issues','Access']).map(h=><th key={h} className="p-4 text-start">{h}</th>)}</tr></thead><tbody>{center.datasets.map(d=><tr key={d.id} className="border-t border-[var(--ds-border-subtle)]"><td className="p-4"><button className="font-bold text-action underline-offset-4 hover:underline" onClick={()=>setSelectedDataset(d.id)}>{d.name}</button></td><td className="p-4 ds-numeric">{d.rows}</td><td className="p-4 ds-numeric">{d.variables}</td><td className="p-4">v{d.version}</td><td className={`p-4 font-bold ${d.status==='STALE'?'text-warning':d.status==='READY'?'text-success':'text-ink'}`}>{d.status}</td><td className={`p-4 ds-numeric ${d.open_quality_issues>0?'text-warning':'text-ink'}`}>{d.open_quality_issues}</td><td className="p-4 font-bold text-[var(--ds-text-secondary)]">{d.access_level}</td></tr>)}</tbody></table></div>}</Card>
    {selectedDataset&&<DatasetWorkbench datasetId={selectedDataset} language={language} onChanged={refresh}/>} 
  </section>;
};
