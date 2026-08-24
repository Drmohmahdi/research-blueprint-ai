import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, ChevronLeft, ChevronRight, FileText, FolderGit2, BookOpen, User as UserIcon, Award, ClipboardList, Database, Sparkles } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import {
  apiSearch,
  SEARCH_DOMAINS,
} from '../utils/api';
import type {
  SearchResponse,
  SearchResultItem,
  SearchSort
} from '../utils/api';

const DOMAIN_LABELS: Record<string, { ar: string; en: string }> = {
  PROJECT: { ar: 'المشاريع البحثية', en: 'Research Projects' },
  LITERATURE: { ar: 'الدراسات السابقة', en: 'Literature' },
  ASSET: { ar: 'الأصول العلمية', en: 'Scholarly Assets' },
  PROFILE: { ar: 'الملفات الأكاديمية', en: 'Academic Profiles' },
  PROMOTION: { ar: 'الترقيات', en: 'Promotions' },
  PEER_REVIEW: { ar: 'التحكيم العلمي', en: 'Peer Reviews' },
  FILE: { ar: 'الملفات', en: 'Files' },
};

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  PROJECT: <FolderGit2 size={14} />,
  LITERATURE: <BookOpen size={14} />,
  ASSET: <FileText size={14} />,
  PROFILE: <UserIcon size={14} />,
  PROMOTION: <Award size={14} />,
  PEER_REVIEW: <ClipboardList size={14} />,
  FILE: <Database size={14} />,
};

const SORT_OPTIONS: { value: SearchSort; ar: string; en: string }[] = [
  { value: 'relevance', ar: 'الأكثر صلة', en: 'Relevance' },
  { value: 'newest', ar: 'الأحدث', en: 'Newest' },
  { value: 'oldest', ar: 'الأقدم', en: 'Oldest' },
  { value: 'title', ar: 'العنوان', en: 'Title' },
  { value: 'year', ar: 'السنة', en: 'Year' },
];

const PAGE_SIZE = 20;

export const SearchPage: React.FC = () => {
  const { language } = useProject();
  const isAr = language === 'ar';
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeDomains, setActiveDomains] = useState<string[]>([]);
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'network' | 'forbidden' | 'invalid' | 'server' | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce the raw query (300 ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const runSearch = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!debouncedQuery && Object.keys(filters).length === 0) {
      setData(null);
      setError(null);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    const response = await apiSearch(
      {
        q: debouncedQuery,
        domains: activeDomains.length ? activeDomains : undefined,
        filters: Object.keys(filters).length ? filters : undefined,
        sort,
        page,
        limit: PAGE_SIZE,
      },
      controller.signal
    );

    // Stale-response protection: only the latest query may update state
    if (seq !== requestSeq.current) return;

    if (response === null) {
      // Distinguish 403/422/500 from plain network failure
      setData(null);
      setError('network');
    } else {
      setData(response);
      setError(null);
    }
    setLoading(false);
  }, [debouncedQuery, activeDomains, filters, sort, page]);

  useEffect(() => {
    void runSearch();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [runSearch]);

  const toggleDomain = (domain: string) => {
    setPage(1);
    setActiveDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const clearAll = () => {
    setQuery('');
    setDebouncedQuery('');
    setFilters({});
    setPage(1);
  };

  const handleResultClick = (item: SearchResultItem) => {
    if (!item.target) return;
    const target = item.target.replace('{id}', item.entity_id);
    navigate(target);
  };

  const totalPages = data ? Math.max(1, data.total_pages) : 1;
  const domainTabs = SEARCH_DOMAINS.filter(
    (d) => !data || !data.hidden_domains.includes(d)
  );

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={20} className="text-[var(--ds-primary)]" />
        <h2 className="text-lg font-black text-[var(--ds-text-primary)] m-0">
          {isAr ? 'البحث الأكاديمي الموحد' : 'Unified Academic Search'}
        </h2>
      </div>

      {/* Search input */}
      <label className="relative block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-muted)]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setDebouncedQuery(query.trim());
            }
          }}
          placeholder={isAr ? 'ابحث في المشاريع، الدراسات، الأصول، المؤلفين، DOI، ORCID...' : 'Search projects, literature, assets, authors, DOI, ORCID...'}
          aria-label={isAr ? 'حقل البحث' : 'Search field'}
          className="w-full rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] py-3 pl-10 pr-10 text-sm font-semibold text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
        />
        {query && (
          <button
            onClick={() => clearAll()}
            aria-label={isAr ? 'مسح البحث' : 'Clear search'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-muted)] cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </label>

      {/* Domain tabs */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={isAr ? 'تصنيفات البحث' : 'Search domains'}>
        <button
          onClick={() => {
            setActiveDomains([]);
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-colors cursor-pointer ${
            activeDomains.length === 0
              ? 'bg-[var(--ds-primary-soft)] text-ink border-[var(--ds-primary)]'
              : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border-[var(--ds-border-subtle)]'
          }`}
        >
          {isAr ? 'الكل' : 'All'}
        </button>
        {domainTabs.map((d) => (
          <button
            key={d}
            onClick={() => toggleDomain(d)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border transition-colors cursor-pointer ${
              activeDomains.includes(d)
                ? 'bg-[var(--ds-primary-soft)] text-ink border-[var(--ds-primary)]'
                : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] border-[var(--ds-border-subtle)]'
            }`}
          >
            {DOMAIN_ICONS[d]}
            <span>{isAr ? DOMAIN_LABELS[d].ar : DOMAIN_LABELS[d].en}</span>
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SearchSort);
            setPage(1);
          }}
          aria-label={isAr ? 'ترتيب النتائج' : 'Sort results'}
          className="rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] px-3 py-1.5 text-xs font-bold text-[var(--ds-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {isAr ? o.ar : o.en}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ds-text-muted)]">
          <input
            type="checkbox"
            checked={filters.doi_present === true}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, doi_present: e.target.checked }));
              setPage(1);
            }}
            className="accent-[var(--ds-primary)]"
          />
          {isAr ? 'بمعرف DOI فقط' : 'Has DOI only'}
        </label>
      </div>

      {/* Results count (aria-live) */}
      <div aria-live="polite" className="text-xs font-bold text-[var(--ds-text-muted)]">
        {loading && <span>{isAr ? 'جارٍ البحث...' : 'Searching...'}</span>}
        {!loading && data && hasSearched && (
          <span>
            {data.total === 0
              ? isAr ? 'لا توجد نتائج' : 'No results'
              : isAr ? `${data.total} نتيجة` : `${data.total} results`}
          </span>
        )}
      </div>

      {/* Error states */}
      {error === 'network' && hasSearched && (
        <div className="rounded-xl border border-[var(--ds-danger)]/30 bg-[var(--ds-danger-soft)] p-4 text-sm font-bold text-[var(--ds-danger)]">
          {isAr ? 'تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مجددًا.' : 'Could not reach the server. Please check your connection and try again.'}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.total === 0 && hasSearched && (
        <div className="text-center py-14 space-y-2">
          <div className="text-4xl opacity-40">🔍</div>
          <p className="text-sm font-bold text-[var(--ds-text-secondary)]">
            {query.length < 1
              ? isAr ? 'أدخل استعلامًا للبحث، أو استخدم الفلاتر للتصفح.' : 'Enter a query to search, or use filters to browse.'
              : isAr ? 'لا توجد نتائج مطابقة لبحثك.' : 'No results matched your search.'}
          </p>
          <p className="text-xs text-[var(--ds-text-muted)] font-semibold">
            {isAr ? 'حاول بكلمات مختلفة أو عدّل الفلاتر.' : 'Try different keywords or adjust your filters.'}
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && data && data.results.length > 0 && (
        <div className="space-y-3">
          {data.results.map((item) => (
            <button
              key={`${item.domain}-${item.entity_id}`}
              onClick={() => handleResultClick(item)}
              className="w-full text-start rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] p-4 hover:border-[var(--ds-primary-soft)] hover:shadow-sm transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] text-[10px] font-black">
                  {DOMAIN_ICONS[item.domain]}
                  <span>{isAr ? (DOMAIN_LABELS[item.domain]?.ar ?? item.domain) : (DOMAIN_LABELS[item.domain]?.en ?? item.domain)}</span>
                </span>
                {item.status && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--ds-surface-tertiary)] text-[var(--ds-text-muted)] text-[10px] font-bold">
                    {item.status}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-extrabold text-[var(--ds-text-primary)] m-0 line-clamp-2">
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="text-xs font-semibold text-[var(--ds-text-secondary)] m-0 mt-1 line-clamp-1">
                  {item.subtitle}
                </p>
              )}
              {item.snippet && (
                <p className="text-xs text-[var(--ds-text-muted)] m-0 mt-1 line-clamp-2">
                  {item.snippet}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && data && data.total > PAGE_SIZE && (
        <nav className="flex items-center justify-center gap-2 pt-2" aria-label={isAr ? 'تنقل الصفحات' : 'Pagination'}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
            className="p-2 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] disabled:opacity-40 cursor-pointer"
          >
            {isAr ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <span className="text-xs font-bold text-[var(--ds-text-secondary)]">
            {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
            className="p-2 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] disabled:opacity-40 cursor-pointer"
          >
            {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </nav>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-[var(--ds-primary)]" size={22} />
        </div>
      )}
    </div>
  );
};

export default SearchPage;
