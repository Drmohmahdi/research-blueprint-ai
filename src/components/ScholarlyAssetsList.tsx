import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PathPanel } from '../design-system/components/Navigation';
import { EmptyState } from '../design-system/components/Feedback';
import { useProject } from '../context/ProjectContext';
import {
  apiListScholarlyAssets,
  apiCreateScholarlyAsset,
  apiUpdateScholarlyAsset,
  apiDeleteScholarlyAsset
} from '../utils/api';
import {
  Plus,
  Trash2,
  Search,
  Users,
  ExternalLink,
  BookOpen,
  Calendar,
  X,
  Layers,
  Sparkles,
  Link,
  Pencil,
  ArrowUpDown
} from 'lucide-react';

const LIFECYCLE_STATUSES = ['DRAFT', 'UNDER_REVIEW', 'ACCEPTED', 'PUBLISHED', 'ARCHIVED'] as const;

export const ScholarlyAssetsList: React.FC = () => {
  const { language } = useProject();
  const { assetId } = useParams<{ assetId?: string }>();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Form states for creating asset
  const [newAsset, setNewAsset] = useState<any>({
    title_ar: '',
    title_en: '',
    abstract_ar: '',
    abstract_en: '',
    asset_type: 'JOURNAL_PAPER',
    lifecycle_status: 'PUBLISHED',
    primary_discipline: '',
    secondary_disciplines_json: [],
    keywords_json: [],
    doi: '',
    issn: '',
    isbn: '',
    journal_name: '',
    publisher: '',
    publication_date: '',
    acceptance_date: '',
    conference_name: '',
    language: 'ar',
    visibility: 'PUBLIC',
    source_module: 'FOUNDATION',
    contributors: [],
    files: []
  });

  const [contributorForm, setContributorForm] = useState<any>({
    external_name: '',
    orcid: '',
    author_order: 1,
    is_corresponding_author: false,
    contribution_roles_json: [],
    affiliation_text: '',
    contribution_percentage: 100
  });

  const CREDIT_ROLES = [
    { value: 'Conceptualization', labelAr: 'صياغة المفاهيم', labelEn: 'Conceptualization' },
    { value: 'Methodology', labelAr: 'المنهجية العلمية', labelEn: 'Methodology' },
    { value: 'Software', labelAr: 'البرمجيات وتطوير الأدوات', labelEn: 'Software' },
    { value: 'Validation', labelAr: 'التحقق والمطابقة', labelEn: 'Validation' },
    { value: 'Formal Analysis', labelAr: 'التحليل الإحصائي والشكلي', labelEn: 'Formal Analysis' },
    { value: 'Investigation', labelAr: 'التقصي والبحث الميداني', labelEn: 'Investigation' },
    { value: 'Resources', labelAr: 'توفير الموارد والأجهزة', labelEn: 'Resources' },
    { value: 'Data Curation', labelAr: 'تنظيم وتنسيق البيانات', labelEn: 'Data Curation' },
    { value: 'Writing - Original Draft', labelAr: 'كتابة المسودة الأولى', labelEn: 'Writing - Original Draft' },
    { value: 'Writing - Review & Editing', labelAr: 'المراجعة والتحرير اللغوي', labelEn: 'Writing - Review & Editing' },
    { value: 'Visualization', labelAr: 'التمثيل المرئي والمخططات', labelEn: 'Visualization' },
    { value: 'Supervision', labelAr: 'الإشراف والتوجيه الأكاديمي', labelEn: 'Supervision' },
  ];

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await apiListScholarlyAssets();
      if (data) {
        setAssets(data);
      }
    } catch (e) {
      console.error("Failed to load scholarly assets", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const handleAddContributor = () => {
    if (!contributorForm.external_name.trim()) return;
    setNewAsset({
      ...newAsset,
      contributors: [...newAsset.contributors, contributorForm]
    });
    setContributorForm({
      external_name: '',
      orcid: '',
      author_order: newAsset.contributors.length + 2,
      is_corresponding_author: false,
      contribution_roles_json: [],
      affiliation_text: '',
      contribution_percentage: 0
    });
  };

  const handleRemoveContributor = (idx: number) => {
    const updated = [...newAsset.contributors];
    updated.splice(idx, 1);
    setNewAsset({
      ...newAsset,
      contributors: updated
    });
  };

  const emptyAssetForm = {
    title_ar: '',
    title_en: '',
    abstract_ar: '',
    abstract_en: '',
    asset_type: 'JOURNAL_PAPER',
    lifecycle_status: 'PUBLISHED',
    primary_discipline: '',
    secondary_disciplines_json: [],
    keywords_json: [],
    doi: '',
    issn: '',
    isbn: '',
    journal_name: '',
    publisher: '',
    publication_date: '',
    acceptance_date: '',
    conference_name: '',
    language: 'ar',
    visibility: 'PUBLIC',
    source_module: 'FOUNDATION',
    contributors: [],
    files: []
  };

  const openAddModal = () => {
    setEditingAssetId(null);
    setNewAsset(emptyAssetForm);
    setShowAddModal(true);
  };

  const openEditModal = (asset: any) => {
    setEditingAssetId(asset.id);
    setNewAsset({
      title_ar: asset.title_ar || '',
      title_en: asset.title_en || '',
      abstract_ar: asset.abstract_ar || '',
      abstract_en: asset.abstract_en || '',
      asset_type: asset.asset_type || 'JOURNAL_PAPER',
      lifecycle_status: asset.lifecycle_status || 'PUBLISHED',
      primary_discipline: asset.primary_discipline || '',
      secondary_disciplines_json: asset.secondary_disciplines_json || [],
      keywords_json: asset.keywords_json || [],
      doi: asset.doi || '',
      issn: asset.issn || '',
      isbn: asset.isbn || '',
      journal_name: asset.journal_name || '',
      publisher: asset.publisher || '',
      publication_date: asset.publication_date || '',
      acceptance_date: asset.acceptance_date || '',
      conference_name: asset.conference_name || '',
      language: asset.language || 'ar',
      visibility: asset.visibility || 'PUBLIC',
      source_module: asset.source_module || 'FOUNDATION',
      contributors: asset.contributors || [],
      files: asset.files || []
    });
    setShowAddModal(true);
  };

  useEffect(() => {
    if (!assetId || assets.length === 0) return;
    const match = assets.find((asset: any) => asset.id === assetId);
    if (match) openEditModal(match);
  }, [assetId, assets]);

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = editingAssetId
        ? await apiUpdateScholarlyAsset(editingAssetId, newAsset)
        : await apiCreateScholarlyAsset(newAsset);
      if (res) {
        setShowAddModal(false);
        setEditingAssetId(null);
        setNewAsset(emptyAssetForm);
        loadAssets();
      }
    } catch (e) {
      console.error("Failed to save asset", e);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا الأصل العلمي؟' : 'Are you sure you want to delete this scholarly asset?')) return;
    try {
      const ok = await apiDeleteScholarlyAsset(id);
      if (ok) {
        loadAssets();
      }
    } catch (e) {
      console.error("Failed to delete asset", e);
    }
  };

  const filteredAssets = assets
    .filter((asset) => {
      const matchesSearch =
        (asset.title_ar && asset.title_ar.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.title_en && asset.title_en.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.journal_name && asset.journal_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = selectedTypeFilter === 'ALL' || asset.asset_type === selectedTypeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const dateA = a.publication_date || a.created_at || '';
      const dateB = b.publication_date || b.created_at || '';
      return sortOrder === 'newest' ? (dateB > dateA ? 1 : -1) : (dateA > dateB ? 1 : -1);
    });

  const getLifecycleStatusLabel = (status: string) => {
    const mapAr: Record<string, string> = {
      DRAFT: 'مسودة',
      UNDER_REVIEW: 'قيد المراجعة',
      ACCEPTED: 'مقبول',
      PUBLISHED: 'منشور',
      ARCHIVED: 'مؤرشف'
    };
    const mapEn: Record<string, string> = {
      DRAFT: 'Draft',
      UNDER_REVIEW: 'Under Review',
      ACCEPTED: 'Accepted',
      PUBLISHED: 'Published',
      ARCHIVED: 'Archived'
    };
    return language === 'ar' ? (mapAr[status] || status) : (mapEn[status] || status);
  };

  const getLifecycleStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'bg-[var(--ds-success-soft)] text-success border-success/20';
      case 'ACCEPTED': return 'bg-info/10 text-info border-info/20';
      case 'UNDER_REVIEW': return 'bg-warning/10 text-warning border-warning/20';
      case 'ARCHIVED': return 'bg-muted/10 text-muted border-muted/20';
      default: return 'bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-muted)] border-[var(--ds-border-subtle)]';
    }
  };

  const getAssetTypeBadgeLabel = (type: string) => {
    const typesMapAr: Record<string, string> = {
      RESEARCH_PROJECT: 'مشروع بحثي',
      JOURNAL_PAPER: 'ورقة علمية محكمة',
      BOOK: 'كتاب / مؤلف',
      CONFERENCE_PAPER: 'ورقة مؤتمر',
      PATENT: 'براءة اختراع',
      THESIS: 'رسالة علمية'
    };
    const typesMapEn: Record<string, string> = {
      RESEARCH_PROJECT: 'Research Project',
      JOURNAL_PAPER: 'Journal Paper',
      BOOK: 'Book / Monograph',
      CONFERENCE_PAPER: 'Conference Paper',
      PATENT: 'Patent',
      THESIS: 'Thesis / Dissertation'
    };
    return language === 'ar' ? (typesMapAr[type] || type) : (typesMapEn[type] || type);
  };

  const t = {
    title: language === 'ar' ? 'سجل الأصول العلمية الموحد' : 'Unified Scholarly Assets Registry',
    desc: language === 'ar' ? 'مستودع الأبحاث والأوراق وبراءات الاختراع الموحد لمنع الازدواجية وتكامل موديولات النشر والترقيات' : 'Unified repository of research, papers, and patents to prevent duplicate entry across modules',
    addAsset: language === 'ar' ? 'إضافة أصل علمي جديد' : 'Register New Scholarly Asset',
    searchPlaceholder: language === 'ar' ? 'ابحث في العنوان، المجلة، أو المؤلف...' : 'Search by title, journal, or author...',
    all: language === 'ar' ? 'الكل' : 'All',
    journalPaper: language === 'ar' ? 'ورقة علمية' : 'Journal Paper',
    researchProject: language === 'ar' ? 'مشروع بحثي' : 'Research Project',
    book: language === 'ar' ? 'كتاب / مؤلف' : 'Book / Monograph',
    patent: language === 'ar' ? 'براءة اختراع' : 'Patent',
    thesis: language === 'ar' ? 'رسالة علمية' : 'Thesis',
    conferencePaper: language === 'ar' ? 'ورقة مؤتمر' : 'Conference Paper',
    noAssets: language === 'ar' ? 'لا توجد أصول علمية مضافة حالياً.' : 'No scholarly assets registered currently.',
    modalTitleAdd: language === 'ar' ? 'تسجيل أصل علمي جديد بالسجل الموحد' : 'Register New Scholarly Asset',
    modalTitleEdit: language === 'ar' ? 'تعديل الأصل العلمي' : 'Edit Scholarly Asset',
    saveNew: language === 'ar' ? 'تسجيل الأصل' : 'Register Asset',
    saveEdit: language === 'ar' ? 'حفظ التعديلات' : 'Save Changes',
    cancel: language === 'ar' ? 'إلغاء' : 'Cancel',
    status: language === 'ar' ? 'حالة النشر' : 'Publication Status',
    sortNewest: language === 'ar' ? 'الأحدث أولاً' : 'Newest first',
    sortOldest: language === 'ar' ? 'الأقدم أولاً' : 'Oldest first',
    edit: language === 'ar' ? 'تعديل' : 'Edit',
    titleAr: language === 'ar' ? 'العنوان الرئيسي (بالعربية)' : 'Main Title (Arabic)',
    titleEn: language === 'ar' ? 'العنوان الرئيسي (بالإنجليزية)' : 'Main Title (English)',
    abstractAr: language === 'ar' ? 'الملخص العلمي (بالعربية)' : 'Abstract (Arabic)',
    abstractEn: language === 'ar' ? 'الملخص العلمي (بالإنجليزية)' : 'Abstract (English)',
    journalName: language === 'ar' ? 'اسم المجلة / الوعاء العلمي' : 'Journal Name / Venue',
    publisher: language === 'ar' ? 'دار النشر / الجهة المصدرة' : 'Publisher / Issuer',
    pubDate: language === 'ar' ? 'تاريخ النشر / الصدور' : 'Publication Date',
    doi: language === 'ar' ? 'معرف الكائن الرقمي (DOI)' : 'Digital Object Identifier (DOI)',
    contributors: language === 'ar' ? 'فريق العمل والمساهمون (طبقاً لـ CRediT)' : 'Contributors & Roles (CRediT Model)',
    addContributor: language === 'ar' ? 'إضافة مساهم' : 'Add Contributor',
    contributorName: language === 'ar' ? 'اسم المساهم (الخارجي)' : 'Contributor Full Name',
    contributorOrcid: language === 'ar' ? 'معرف ORCID للمساهم' : 'Orcid ID',
    creditRolesLabel: language === 'ar' ? 'أدوار المساهمة' : 'Contribution Roles',
    corresponding: language === 'ar' ? 'المؤلف المراسل' : 'Corresponding Author'
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 dir-auto" style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}>
      
      <PathPanel accent="var(--ds-path-identity)">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-h2 flex items-center gap-2 m-0 text-ink">
            <Layers className="w-7 h-7 text-path-identity" />
            <span>{t.title}</span>
          </h2>
          <p className="text-caption text-secondary mt-1">{t.desc}</p>
        </div>
        
        <button
          onClick={openAddModal}
          className="w-full md:w-auto px-5 py-2.5 bg-action hover:bg-action-hover text-on-action rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 ds-transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addAsset}</span>
        </button>
        </div>
      </PathPanel>

      {/* Filters and search bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Type Filter tabs */}
        <div className="flex flex-wrap gap-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] p-1 rounded-xl shadow-sm max-w-fit">
          {['ALL', 'JOURNAL_PAPER', 'CONFERENCE_PAPER', 'RESEARCH_PROJECT', 'BOOK', 'PATENT', 'THESIS'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedTypeFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedTypeFilter === filter
                  ? 'bg-[var(--ds-primary-soft)] text-ink'
                  : 'text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)]'
              }`}
            >
              {filter === 'ALL' && t.all}
              {filter === 'JOURNAL_PAPER' && t.journalPaper}
              {filter === 'CONFERENCE_PAPER' && t.conferencePaper}
              {filter === 'RESEARCH_PROJECT' && t.researchProject}
              {filter === 'BOOK' && t.book}
              {filter === 'PATENT' && t.patent}
              {filter === 'THESIS' && t.thesis}
            </button>
          ))}
        </div>

        {/* Sort */}
        <button
          onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-xl text-[11px] font-bold text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)] shadow-sm cursor-pointer shrink-0"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>{sortOrder === 'newest' ? t.sortNewest : t.sortOldest}</span>
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--ds-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:ring-2 focus:ring-[var(--ds-primary-soft)] focus:outline-none"
          />
        </div>
      </div>

      {/* Assets Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--ds-primary)] border-t-transparent motion-safe:animate-spin"></div>
          <p className="text-body-sm text-[var(--ds-text-secondary)] font-semibold">
            {language === 'ar' ? 'جاري تحميل الأصول العلمية...' : 'Loading Scholarly Assets...'}
          </p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          illustration={<BookOpen size={40} />}
          title={t.noAssets}
          description={language === 'ar' ? 'سجّل أول أصل علمي لربطه بالنشر والترقيات والهوية الأكاديمية.' : 'Register the first scholarly asset to connect publishing, promotion, and academic identity.'}
          actionButton={
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-action hover:bg-action-hover text-on-action rounded-lg text-xs font-bold ds-transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.addAsset}</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAssets.map((asset) => (
            <div 
              key={asset.id} 
              className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] p-5 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between gap-4 hover:border-[var(--ds-primary)]/30 transition-all"
            >
              <div className="space-y-2 flex-1">
                {/* Header indicators */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--ds-information-soft)] text-[var(--ds-information)] border border-info/20">
                    {getAssetTypeBadgeLabel(asset.asset_type)}
                  </span>

                  {asset.lifecycle_status && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getLifecycleStatusColor(asset.lifecycle_status)}`}>
                      {getLifecycleStatusLabel(asset.lifecycle_status)}
                    </span>
                  )}

                  {asset.source_module && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border border-[var(--ds-border-subtle)]">
                      {language === 'ar' ? `المصدر: ${asset.source_module}` : `Source: ${asset.source_module}`}
                    </span>
                  )}

                  {asset.doi && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-info/10 text-info border border-info/20 flex items-center gap-1">
                      <Link className="w-3 h-3" />
                      <span>DOI</span>
                    </span>
                  )}
                </div>

                {/* Titles */}
                <div>
                  <h3 className="text-h3 text-[var(--ds-text-primary)]">
                    {language === 'ar' ? (asset.title_ar || asset.title_en) : (asset.title_en || asset.title_ar)}
                  </h3>
                  {asset.title_ar && asset.title_en && (
                    <p className="text-caption text-[var(--ds-text-secondary)] font-medium mt-1">
                      {language === 'ar' ? asset.title_en : asset.title_ar}
                    </p>
                  )}
                </div>

                {/* Secondary Meta details */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--ds-text-secondary)] pt-1">
                  {asset.journal_name && (
                    <span className="flex items-center gap-1 font-semibold text-ink">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{asset.journal_name}</span>
                    </span>
                  )}
                  {asset.publisher && (
                    <span>{language === 'ar' ? `الناشر: ${asset.publisher}` : `Publisher: ${asset.publisher}`}</span>
                  )}
                  {asset.publication_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{asset.publication_date}</span>
                    </span>
                  )}
                </div>

                {/* Contributors List */}
                {asset.contributors && asset.contributors.length > 0 && (
                  <div className="pt-2 flex items-center gap-1.5 text-[11px]">
                    <Users className="w-3.5 h-3.5 text-[var(--ds-text-secondary)] shrink-0" />
                    <span className="text-[var(--ds-text-secondary)] font-semibold">{language === 'ar' ? 'فريق العمل:' : 'Contributors:'}</span>
                    <div className="flex flex-wrap gap-1">
                      {asset.contributors.map((c: any, idx: number) => (
                        <span key={idx} className="bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] px-2 py-0.5 rounded text-[10px] border border-[var(--ds-border-subtle)] font-medium">
                          {c.external_name}
                          {c.is_corresponding_author && ' *'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-row md:flex-col justify-end items-center gap-2 shrink-0 self-end md:self-center">
                {asset.doi && (
                  <a 
                    href={`https://doi.org/${asset.doi}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-2 text-info hover:bg-info/10 rounded-xl transition-all cursor-pointer"
                    title="View DOI Link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Edit/Delete: only for FOUNDATION source assets to prevent modifying core system records */}
                {asset.source_module === 'FOUNDATION' && (
                  <>
                    <button
                      onClick={() => openEditModal(asset)}
                      className="p-2 text-action hover:bg-[var(--ds-primary-soft)] rounded-xl transition-all cursor-pointer"
                      title={t.edit}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-all cursor-pointer"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[var(--ds-surface-overlay)] flex items-center justify-center p-4">
          <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-[var(--ds-shadow-overlay)] p-6 space-y-6 dir-auto" style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}>
            
            <div className="flex justify-between items-center border-b border-[var(--ds-border-subtle)] pb-3">
              <h3 className="text-h3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-path-identity" />
                <span>{editingAssetId ? t.modalTitleEdit : t.modalTitleAdd}</span>
              </h3>
              <button
                onClick={() => { setShowAddModal(false); setEditingAssetId(null); }}
                className="p-1 hover:bg-[var(--ds-surface-secondary)] rounded-lg text-[var(--ds-text-secondary)] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="space-y-5">

              {/* Asset Type + Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">نوع الأصل العلمي</label>
                  <select
                    value={newAsset.asset_type}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  >
                    <option value="JOURNAL_PAPER">{t.journalPaper}</option>
                    <option value="RESEARCH_PROJECT">{t.researchProject}</option>
                    <option value="BOOK">{t.book}</option>
                    <option value="CONFERENCE_PAPER">{t.conferencePaper}</option>
                    <option value="PATENT">{t.patent}</option>
                    <option value="THESIS">{t.thesis}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.status}</label>
                  <select
                    value={newAsset.lifecycle_status}
                    onChange={(e) => setNewAsset({ ...newAsset, lifecycle_status: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  >
                    {LIFECYCLE_STATUSES.map(status => (
                      <option key={status} value={status}>{getLifecycleStatusLabel(status)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">التخصص الأكاديمي الرئيسي</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: هندسة البرمجيات"
                    value={newAsset.primary_discipline}
                    onChange={(e) => setNewAsset({ ...newAsset, primary_discipline: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
              </div>

              {/* Titles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.titleAr}</label>
                  <input
                    type="text"
                    required
                    value={newAsset.title_ar}
                    onChange={(e) => setNewAsset({ ...newAsset, title_ar: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.titleEn}</label>
                  <input
                    type="text"
                    required
                    value={newAsset.title_en}
                    onChange={(e) => setNewAsset({ ...newAsset, title_en: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
              </div>

              {/* Abstracts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.abstractAr}</label>
                  <textarea
                    rows={3}
                    value={newAsset.abstract_ar}
                    onChange={(e) => setNewAsset({ ...newAsset, abstract_ar: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.abstractEn}</label>
                  <textarea
                    rows={3}
                    value={newAsset.abstract_en}
                    onChange={(e) => setNewAsset({ ...newAsset, abstract_en: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
              </div>

              {/* Publication venue info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.journalName}</label>
                  <input
                    type="text"
                    value={newAsset.journal_name}
                    onChange={(e) => setNewAsset({ ...newAsset, journal_name: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.publisher}</label>
                  <input
                    type="text"
                    value={newAsset.publisher}
                    onChange={(e) => setNewAsset({ ...newAsset, publisher: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.pubDate}</label>
                  <input
                    type="date"
                    value={newAsset.publication_date}
                    onChange={(e) => setNewAsset({ ...newAsset, publication_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
              </div>

              {/* Identifiers (DOI, ISSN, ISBN) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">{t.doi}</label>
                  <input
                    type="text"
                    placeholder="10.1016/j.datak.2026.102"
                    value={newAsset.doi}
                    onChange={(e) => setNewAsset({ ...newAsset, doi: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">ISSN</label>
                  <input
                    type="text"
                    placeholder="1234-5678"
                    value={newAsset.issn}
                    onChange={(e) => setNewAsset({ ...newAsset, issn: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--ds-text-secondary)] mb-1">ISBN</label>
                  <input
                    type="text"
                    placeholder="978-3-16-148410-0"
                    value={newAsset.isbn}
                    onChange={(e) => setNewAsset({ ...newAsset, isbn: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                </div>
              </div>

              {/* CRediT contributors form section */}
              <div className="space-y-3 pt-3 border-t border-[var(--ds-border-subtle)]">
                <h4 className="text-h4 text-ink">{t.contributors}</h4>
                
                {/* List of currently added contributors */}
                <div className="flex flex-wrap gap-2">
                  {newAsset.contributors.map((c: any, idx: number) => (
                    <span key={idx} className="bg-[var(--ds-primary-soft)] border border-[var(--ds-primary)]/20 text-ink px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5">
                      <span>{c.external_name} ({c.contribution_percentage}%)</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveContributor(idx)} 
                        className="hover:text-danger cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Sub-form to add contributor */}
                <div className="p-4 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">{t.contributorName}</label>
                      <input
                        type="text"
                        value={contributorForm.external_name}
                        onChange={(e) => setContributorForm({ ...contributorForm, external_name: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">{t.contributorOrcid}</label>
                      <input
                        type="text"
                        value={contributorForm.orcid}
                        onChange={(e) => setContributorForm({ ...contributorForm, orcid: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">{t.creditRolesLabel}</label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto border border-[var(--ds-border-subtle)] p-2 rounded-lg bg-[var(--ds-surface-primary)]">
                        {CREDIT_ROLES.map((role) => (
                          <div key={role.value} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              id={`role-${role.value}`}
                              checked={contributorForm.contribution_roles_json.includes(role.value)}
                              onChange={(e) => {
                                let updated = [...contributorForm.contribution_roles_json];
                                if (e.target.checked) {
                                  updated.push(role.value);
                                } else {
                                  updated = updated.filter(r => r !== role.value);
                                }
                                setContributorForm({ ...contributorForm, contribution_roles_json: updated });
                              }}
                              className="rounded border-[var(--ds-border-subtle)] text-[var(--ds-primary)] focus:ring-[var(--ds-primary-soft)] w-3.5 h-3.5 cursor-pointer"
                            />
                            <label htmlFor={`role-${role.value}`} className="text-[10px] text-[var(--ds-text-secondary)] cursor-pointer select-none">
                              {language === 'ar' ? role.labelAr : role.labelEn}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--ds-text-secondary)] mb-1">نسبة المساهمة (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={contributorForm.contribution_percentage}
                          onChange={(e) => setContributorForm({ ...contributorForm, contribution_percentage: parseInt(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] text-[var(--ds-text-primary)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="is-corresponding"
                          checked={contributorForm.is_corresponding_author}
                          onChange={(e) => setContributorForm({ ...contributorForm, is_corresponding_author: e.target.checked })}
                          className="rounded border-[var(--ds-border-subtle)] text-[var(--ds-primary)] focus:ring-[var(--ds-primary-soft)] w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="is-corresponding" className="text-[10px] font-bold text-[var(--ds-text-secondary)] cursor-pointer select-none">
                          {t.corresponding}
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddContributor}
                        className="w-full py-1.5 bg-action hover:bg-action-hover text-on-action rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'أضف المساهم للقائمة' : 'Add Contributor to List'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 border-t border-[var(--ds-border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingAssetId(null); }}
                  className="px-4 py-2 border border-[var(--ds-border-subtle)] hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-action hover:bg-action-hover text-on-action rounded-xl text-xs font-bold shadow-sm ds-transition cursor-pointer"
                >
                  {editingAssetId ? t.saveEdit : t.saveNew}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
