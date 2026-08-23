import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Eye,
  EyeOff,
  Settings,
  X,
  ExternalLink,
  Award,
  BookOpen,
  FolderGit2,
  Sliders,
  Check
} from 'lucide-react';
import {
  type InAppNotification,
  type NotificationPreferenceItem,
  apiListNotifications,
  apiGetUnreadNotificationCount,
  apiMarkNotificationRead,
  apiMarkNotificationUnread,
  apiMarkAllNotificationsRead,
  apiGetNotificationPreferences,
  apiUpdateNotificationPreferences
} from '../../utils/api';

interface NotificationCenterProps {
  language: 'ar' | 'en';
  onNavigate?: (view: string, targetId?: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  language,
  onNavigate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterUnread, setFilterUnread] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [preferences, setPreferences] = useState<NotificationPreferenceItem[]>([]);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Fetch unread count & initial batch
  const loadUnreadCount = useCallback(async () => {
    const count = await apiGetUnreadNotificationCount();
    setUnreadCount(count);
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const cat = categoryFilter === 'ALL' ? undefined : categoryFilter;
    const res = await apiListNotifications(1, 30, filterUnread, cat);
    if (res) {
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    }
    setLoading(false);
  }, [filterUnread, categoryFilter]);

  const loadPreferences = useCallback(async () => {
    const prefs = await apiGetNotificationPreferences();
    if (prefs) setPreferences(prefs);
  }, []);

  useEffect(() => {
    loadUnreadCount();
    // Non-aggressive refresh every 45 seconds
    const interval = setInterval(loadUnreadCount, 45000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowPreferences(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Actions
  const handleMarkRead = async (notif: InAppNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = await apiMarkNotificationRead(notif.id);
    if (updated) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: updated.read_at } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkUnread = async (notif: InAppNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = await apiMarkNotificationUnread(notif.id);
    if (updated) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: null } : n));
      setUnreadCount(prev => prev + 1);
    }
  };

  const handleMarkAllRead = async () => {
    const ok = await apiMarkAllNotificationsRead();
    if (ok) {
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
      setUnreadCount(0);
    }
  };

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.read_at) {
      await handleMarkRead(notif);
    }
    setIsOpen(false);

    if (onNavigate) {
      if (notif.target_type === 'PROMOTION_APPLICATION' || notif.category === 'PROMOTION') {
        onNavigate('promotion', notif.target_id || undefined);
      } else if (notif.target_type === 'PEER_REVIEW_CASE' || notif.category === 'PEER_REVIEW') {
        onNavigate('peerReview', notif.target_id || undefined);
      } else if (notif.target_type === 'RESEARCH_PROJECT' || notif.category === 'RESEARCH_WORKFLOW') {
        onNavigate('dashboard', notif.target_id || undefined);
      } else {
        onNavigate('portal');
      }
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    const updated = await apiUpdateNotificationPreferences(preferences);
    if (updated) {
      setPreferences(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
    setSavingPrefs(false);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PROMOTION':
        return <Award size={15} className="text-[var(--ds-primary)]" />;
      case 'PEER_REVIEW':
        return <BookOpen size={15} className="text-amber-500" />;
      case 'RESEARCH_WORKFLOW':
        return <FolderGit2 size={15} className="text-emerald-500" />;
      default:
        return <Sliders size={15} className="text-blue-500" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    if (language === 'ar') {
      switch (category) {
        case 'PROMOTION': return 'ترقيات';
        case 'PEER_REVIEW': return 'تحكيم';
        case 'RESEARCH_WORKFLOW': return 'أبحاث';
        case 'SYSTEM': return 'النظام';
        default: return category;
      }
    } else {
      switch (category) {
        case 'PROMOTION': return 'Promotion';
        case 'PEER_REVIEW': return 'Peer Review';
        case 'RESEARCH_WORKFLOW': return 'Research';
        case 'SYSTEM': return 'System';
        default: return category;
      }
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (language === 'ar') {
        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        if (diffDays < 30) return `منذ ${diffDays} يوم`;
        return date.toLocaleDateString('ar-SA');
      } else {
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 30) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US');
      }
    } catch {
      return isoString;
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Notification Bell Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowPreferences(false);
        }}
        aria-label={language === 'ar' ? `الإشعارات (${unreadCount} غير مقروء)` : `Notifications (${unreadCount} unread)`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`relative p-2 rounded-xl transition-all cursor-pointer ${
          isOpen
            ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] ring-2 ring-[var(--ds-primary)]/20'
            : 'hover:bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)]'
        }`}
        title={language === 'ar' ? 'مركز الإشعارات الأكاديمية' : 'Academic Notification Center'}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-[var(--ds-danger)] text-[10px] font-black text-white ring-2 ring-[var(--ds-surface-primary)] shadow-sm animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          dir={language === 'ar' ? 'rtl' : 'ltr'}
          role="dialog"
          aria-modal="false"
          aria-label={language === 'ar' ? 'مركز الإشعارات الأكاديمية' : 'Academic notification center'}
          className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-[92vw] sm:w-[420px] max-h-[85vh] bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-4 border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]">
                <Bell size={16} />
              </div>
              <h2 className="text-sm font-black text-[var(--ds-text-primary)] m-0">
                {language === 'ar' ? 'الإشعارات الأكاديمية' : 'Academic Notifications'}
              </h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-[var(--ds-danger-soft)] text-[var(--ds-danger)]">
                  {unreadCount} {language === 'ar' ? 'جديد' : 'new'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (!showPreferences) loadPreferences();
                  setShowPreferences(!showPreferences);
                }}
                className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  showPreferences
                    ? 'bg-[var(--ds-primary)] text-white'
                    : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-surface-secondary)]'
                }`}
                title={language === 'ar' ? 'إعدادات الإشعارات' : 'Notification Preferences'}
                aria-label={language === 'ar' ? 'فتح إعدادات الإشعارات' : 'Open notification preferences'}
                aria-pressed={showPreferences}
              >
                <Settings size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label={language === 'ar' ? 'إغلاق مركز الإشعارات' : 'Close notification center'}
                className="p-1.5 rounded-lg text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-surface-secondary)] transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Preferences View Mode */}
          {showPreferences ? (
            <div className="p-4 flex-1 overflow-y-auto max-h-[60vh]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-[var(--ds-text-primary)] uppercase tracking-wider">
                  {language === 'ar' ? 'تفضيلات قنوات الإشعارات' : 'Notification Channel Preferences'}
                </h3>
                <span className="text-[11px] text-[var(--ds-text-muted)]">
                  {language === 'ar' ? 'تخصيص القنوات لكل فئة' : 'Customize per category'}
                </span>
              </div>

              <div className="space-y-3">
                {preferences.map(pref => (
                  <div
                    key={pref.category}
                    className="p-3 rounded-xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      {getCategoryIcon(pref.category)}
                      <div>
                        <div className="text-xs font-bold text-[var(--ds-text-primary)]">
                          {getCategoryLabel(pref.category)}
                        </div>
                        <div className="text-[10px] text-[var(--ds-text-muted)]">
                          {pref.category === 'PROMOTION' || pref.category === 'PEER_REVIEW'
                            ? (language === 'ar' ? 'إشعارات الإجراءات المؤسسية' : 'Institutional workflow notices')
                            : (language === 'ar' ? 'تحديثات المشاريع والتعليقات' : 'Project workspace updates')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* In-App Toggle */}
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ds-text-secondary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.in_app_enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setPreferences(prev => prev.map(p => p.category === pref.category ? { ...p, in_app_enabled: val } : p));
                          }}
                          className="rounded text-[var(--ds-primary)] focus:ring-[var(--ds-primary-soft)]"
                        />
                        <span>{language === 'ar' ? 'داخل المنصة' : 'In-App'}</span>
                      </label>

                      {/* Email Toggle */}
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ds-text-secondary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pref.email_enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setPreferences(prev => prev.map(p => p.category === pref.category ? { ...p, email_enabled: val } : p));
                          }}
                          className="rounded text-[var(--ds-primary)] focus:ring-[var(--ds-primary-soft)]"
                        />
                        <span>{language === 'ar' ? 'البريد' : 'Email'}</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--ds-border-subtle)] flex items-center justify-between">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-secondary)] transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  onClick={handleSavePreferences}
                  disabled={savingPrefs}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--ds-primary)] text-white text-xs font-black shadow-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saveSuccess ? <Check size={14} /> : null}
                  <span>{saveSuccess ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : (language === 'ar' ? 'حفظ التفضيلات' : 'Save Preferences')}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Filter Tabs & Bulk Actions */}
              <div className="px-4 py-2 border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilterUnread(false)}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                      !filterUnread
                        ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]'
                        : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]'
                    }`}
                  >
                    {language === 'ar' ? 'الكل' : 'All'}
                  </button>
                  <button
                    onClick={() => setFilterUnread(true)}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                      filterUnread
                        ? 'bg-[var(--ds-primary-soft)] text-[var(--ds-primary)]'
                        : 'text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]'
                    }`}
                  >
                    {language === 'ar' ? 'غير المقروءة' : 'Unread'}
                  </button>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] font-bold text-[var(--ds-primary)] hover:underline cursor-pointer"
                  >
                    <CheckCheck size={14} />
                    <span>{language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}</span>
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="px-4 py-1.5 border-b border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]/20 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                {['ALL', 'PROMOTION', 'PEER_REVIEW', 'RESEARCH_WORKFLOW'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-0.5 rounded-full font-bold transition-all shrink-0 cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-[var(--ds-primary)] text-white shadow-2xs'
                        : 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-secondary)]/80'
                    }`}
                  >
                    {cat === 'ALL'
                      ? (language === 'ar' ? 'جميع الفئات' : 'All Categories')
                      : getCategoryLabel(cat)}
                  </button>
                ))}
              </div>

              {/* Notification Items List */}
              <div className="flex-1 overflow-y-auto max-h-[60vh] divide-y divide-[var(--ds-border-subtle)]">
                {loading ? (
                  <div className="p-8 text-center text-xs font-bold text-[var(--ds-text-muted)]">
                    {language === 'ar' ? 'جارٍ تحميل الإشعارات...' : 'Loading notifications...'}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                    <div className="p-3 rounded-full bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)]">
                      <Bell size={24} />
                    </div>
                    <p className="text-xs font-bold text-[var(--ds-text-muted)] m-0">
                      {filterUnread
                        ? (language === 'ar' ? 'لا توجد إشعارات غير مقروءة' : 'No unread notifications')
                        : (language === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet')}
                    </p>
                  </div>
                ) : (
                  notifications.map(notif => {
                    const isUnread = !notif.read_at;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-[var(--ds-surface-secondary)]/60 ${
                          isUnread ? 'bg-[var(--ds-primary-soft)]/20' : ''
                        }`}
                      >
                        {/* Category Icon */}
                        <div className="p-2 rounded-xl bg-[var(--ds-surface-secondary)] shrink-0 mt-0.5 shadow-2xs">
                          {getCategoryIcon(notif.category)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h4 className={`text-xs m-0 truncate ${isUnread ? 'font-black text-[var(--ds-text-primary)]' : 'font-bold text-[var(--ds-text-secondary)]'}`}>
                              {language === 'ar' ? notif.title_ar : notif.title_en}
                            </h4>
                            <span className="text-[10px] font-semibold text-[var(--ds-text-muted)] shrink-0">
                              {formatRelativeTime(notif.created_at)}
                            </span>
                          </div>

                          <p className="text-[11px] text-[var(--ds-text-secondary)] line-clamp-2 m-0 leading-relaxed font-medium">
                            {language === 'ar' ? notif.message_ar : notif.message_en}
                          </p>

                          <div className="mt-2 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)]">
                              {getCategoryLabel(notif.category)}
                            </span>

                            <div className="flex items-center gap-1">
                              {isUnread ? (
                                <button
                                  onClick={(e) => handleMarkRead(notif, e)}
                                  aria-label={language === 'ar' ? 'تحديد الإشعار كمقروء' : 'Mark notification as read'}
                                  className="p-1 rounded-md text-[var(--ds-text-muted)] hover:text-[var(--ds-primary)] hover:bg-[var(--ds-surface-secondary)] transition-colors cursor-pointer"
                                  title={language === 'ar' ? 'تحديد كمقروء' : 'Mark as read'}
                                >
                                  <Eye size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => handleMarkUnread(notif, e)}
                                  aria-label={language === 'ar' ? 'تحديد الإشعار كغير مقروء' : 'Mark notification as unread'}
                                  className="p-1 rounded-md text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] hover:bg-[var(--ds-surface-secondary)] transition-colors cursor-pointer"
                                  title={language === 'ar' ? 'تحديد كغير مقروء' : 'Mark as unread'}
                                >
                                  <EyeOff size={13} />
                                </button>
                              )}
                              <ExternalLink size={12} className="text-[var(--ds-text-muted)]" />
                            </div>
                          </div>
                        </div>

                        {/* Unread Indicator Dot */}
                        {isUnread && (
                          <div className="h-2 w-2 rounded-full bg-[var(--ds-primary)] shrink-0 mt-2" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 border-t border-[var(--ds-border-subtle)] bg-[var(--ds-surface-secondary)]/30 text-center">
                <span className="text-[10px] font-bold text-[var(--ds-text-muted)]">
                  {language === 'ar' ? 'منصة بصيرة — محرك الإشعارات والأحداث الموثوقة' : 'Baseerah Suite — Reliable Academic Events Engine'}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
