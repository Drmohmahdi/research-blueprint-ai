import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiGetPublicProfile, apiGetPublicPhotoUrl } from '../utils/api';
import { getChannelLabel } from '../config/academicChannels';
import {
  Loader2,
  ShieldAlert,
  Globe,
  School,
  ExternalLink,
  Calendar,
  Link as LinkIcon
} from 'lucide-react';

const ASSET_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  JOURNAL_PAPER: { ar: 'ورقة علمية محكمة', en: 'Journal Paper' },
  RESEARCH_PROJECT: { ar: 'مشروع بحثي', en: 'Research Project' },
  BOOK: { ar: 'كتاب / مؤلف', en: 'Book / Monograph' },
  CONFERENCE_PAPER: { ar: 'ورقة مؤتمر', en: 'Conference Paper' },
  PATENT: { ar: 'براءة اختراع', en: 'Patent' },
  THESIS: { ar: 'رسالة علمية', en: 'Thesis / Dissertation' },
};

export const PublicResearcherProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [isAr, setIsAr] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      if (!username) { setNotFound(true); setLoading(false); return; }
      const data = await apiGetPublicProfile(username);
      if (data) {
        setProfile(data);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [username]);

  const wrap = (children: React.ReactNode) => (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--ds-background-canvas)] text-[var(--ds-text-primary)]">
      <div className="max-w-3xl mx-auto px-4 py-10">{children}</div>
    </div>
  );

  if (loading) {
    return wrap(
      <div className="flex items-center justify-center gap-2 py-24 text-[var(--ds-text-muted)]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm font-bold">{isAr ? 'جارِ تحميل الملف...' : 'Loading profile...'}</span>
      </div>
    );
  }

  if (notFound || !profile) {
    return wrap(
      <div className="text-center py-24 space-y-3">
        <ShieldAlert className="mx-auto text-rose-500" size={32} />
        <h1 className="text-lg font-bold">{isAr ? 'هذا الملف غير متاح' : 'This profile is not available'}</h1>
        <p className="text-sm text-[var(--ds-text-secondary)]">
          {isAr
            ? 'قد يكون الرابط غير صحيح، أو أن صاحب الملف لم يجعله عامًا بعد.'
            : 'The link may be incorrect, or the owner hasn’t made this profile public yet.'}
        </p>
      </div>
    );
  }

  const displayName = isAr
    ? (profile.preferred_name_ar || profile.preferred_name_en || username)
    : (profile.preferred_name_en || profile.preferred_name_ar || username);

  const identifiers: any[] = profile.identifiers || [];
  const affiliations: any[] = profile.affiliations || [];
  const assets: any[] = profile.scholarly_assets || [];

  const keywords = isAr
    ? (profile.keywords_ar_json || []).join('، ')
    : (profile.keywords_en_json || []).join(', ');

  const bio = isAr
    ? (profile.full_bio_ar || profile.full_bio_en)
    : (profile.full_bio_en || profile.full_bio_ar);

  return wrap(
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsAr(v => !v)}
          className="text-[11px] font-bold text-indigo-500 hover:underline cursor-pointer"
        >
          {isAr ? 'English' : 'عربي'}
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 pb-4 border-b border-[var(--ds-border-subtle)]">
        {profile.has_photo && username && (
          <img
            src={apiGetPublicPhotoUrl(username)}
            alt=""
            className="w-16 h-16 rounded-full object-cover border border-[var(--ds-border-subtle)] shrink-0"
          />
        )}
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {isAr ? 'الملف الأكاديمي العام' : 'Public Academic Profile'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold">{displayName}</h1>
          {(profile.academic_title || profile.current_rank) && (
            <p className="text-sm text-[var(--ds-text-secondary)] font-bold">
              {[profile.academic_title, profile.current_rank].filter(Boolean).join(' — ')}
            </p>
          )}
          {(profile.university || profile.college || profile.department) && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--ds-text-muted)]">
              <School size={13} />
              <span>{[profile.university, profile.college, profile.department].filter(Boolean).join(' · ')}</span>
            </div>
          )}
          {profile.public_email && (
            <p className="text-xs text-[var(--ds-text-muted)]">{profile.public_email}</p>
          )}
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-sm leading-relaxed text-[var(--ds-text-secondary)]">{bio}</p>
      )}

      {keywords && (
        <p className="text-xs font-mono text-[var(--ds-text-muted)]">{keywords}</p>
      )}

      {/* Channels */}
      {identifiers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {identifiers.filter(i => i.identifier_value).map((ident, idx) => (
            <a
              key={idx}
              href={ident.profile_url || '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)] hover:border-indigo-500/40 text-[var(--ds-text-secondary)]"
            >
              <span>{getChannelLabel(ident.identifier_type, isAr)}</span>
              {ident.profile_url && <ExternalLink size={11} />}
            </a>
          ))}
        </div>
      )}

      {/* Affiliations */}
      {affiliations.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-black text-[var(--ds-text-muted)] uppercase tracking-wide">
            {isAr ? 'الانتماءات الأكاديمية' : 'Affiliations'}
          </h2>
          <div className="space-y-1.5">
            {affiliations.map((aff, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-2.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg">
                <span className="font-bold">{aff.organization_name}{aff.position_title ? ` — ${aff.position_title}` : ''}</span>
                {aff.is_current && (
                  <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
                    {isAr ? 'حالي' : 'Current'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scholarly assets */}
      {assets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-black text-[var(--ds-text-muted)] uppercase tracking-wide">
            {isAr ? 'الأصول العلمية' : 'Publications & Works'}
          </h2>
          <div className="space-y-2">
            {assets.map((a) => (
              <div key={a.id} className="p-3 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-block mb-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {ASSET_TYPE_LABELS[a.asset_type] ? (isAr ? ASSET_TYPE_LABELS[a.asset_type].ar : ASSET_TYPE_LABELS[a.asset_type].en) : a.asset_type}
                    </span>
                    <p className="text-sm font-bold m-0">{isAr ? (a.title_ar || a.title_en) : (a.title_en || a.title_ar)}</p>
                    <p className="text-[11px] text-[var(--ds-text-muted)] m-0 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {a.publication_date && (
                        <span className="flex items-center gap-1"><Calendar size={11} />{a.publication_date}</span>
                      )}
                      {a.journal_name && <span>{a.journal_name}</span>}
                    </p>
                  </div>
                  {a.doi && (
                    <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noreferrer" className="shrink-0 text-sky-500 hover:text-sky-600">
                      <LinkIcon size={13} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-[var(--ds-text-muted)] text-center pt-6 border-t border-[var(--ds-border-subtle)]">
        {isAr ? 'مدعوم من منصة بصيرة للبحث العلمي' : 'Powered by Baseerah Research Platform'}
      </p>
    </div>
  );
};
