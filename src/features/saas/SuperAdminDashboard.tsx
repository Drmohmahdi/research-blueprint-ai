import React, { useState, useEffect } from 'react';
import { apiListAuditLogs } from '../../utils/api';
import { Card } from '../../design-system/components/Card';
import { PathPanel } from '../../design-system/components/Navigation';
import { Terminal, Shield, User, Globe, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface SuperAdminDashboardProps {
  language: 'ar' | 'en';
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ language }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const list = await apiListAuditLogs();
      if (list) setLogs(list);
    } catch (e) {
      console.error("Failed to load audit logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-bold text-[var(--ds-text-muted)] motion-safe:animate-pulse">
        {language === 'ar' ? 'جاري تحميل سجلات نظام المراقبة والأمان...' : 'Loading security and system audit logs...'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PathPanel accent="var(--ds-path-identity)">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] rounded-xl flex items-center justify-center shadow-sm">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-h3 m-0 text-ink">
              {language === 'ar' ? 'سجل الرقابة الأمنية والعمليات (Audit Logs)' : 'Security Audit Trail & Logs'}
            </h3>
            <p className="text-[10px] text-[var(--ds-text-muted)] font-semibold mt-1 m-0">
              {language === 'ar' ? 'مراقبة فورية لجميع التعديلات والوصول لبيانات المشاريع الاستخبارية.' : 'Real-time telemetry tracking compliance updates and access logs.'}
            </p>
          </div>
        </div>
      </PathPanel>

      {/* Logs Table */}
      <Card className="border-[var(--ds-border-subtle)] rounded-2xl overflow-hidden bg-[var(--ds-surface-primary)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs font-bold">
            <thead>
              <tr className="bg-[var(--ds-surface-secondary)] border-b border-[var(--ds-border-subtle)] text-[var(--ds-text-muted)]">
                <th className="px-6 py-3.5">{language === 'ar' ? 'العملية' : 'Action'}</th>
                <th className="px-6 py-3.5">{language === 'ar' ? 'المستخدم' : 'Operator'}</th>
                <th className="px-6 py-3.5">{language === 'ar' ? 'عنوان IP' : 'IP Address'}</th>
                <th className="px-6 py-3.5">{language === 'ar' ? 'التوقيت' : 'Timestamp'}</th>
                <th className="px-6 py-3.5 text-center">{language === 'ar' ? 'التفاصيل' : 'Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ds-border-subtle)]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-xs font-semibold text-[var(--ds-text-muted)]">
                    {language === 'ar' ? 'لا توجد سجلات عمليات متاحة حالياً.' : 'No audit records logged yet.'}
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => {
                  const isExpanded = expandedLogId === log.id;
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-[var(--ds-surface-secondary)] transition-colors">
                        <td className="px-6 py-4 font-black">
                          <span className="inline-flex items-center gap-1.5 text-ink">
                            <Terminal size={14} className="shrink-0" />
                            <span>{log.action}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5">
                            <User size={13} className="text-[var(--ds-text-muted)] shrink-0" />
                            <span>{log.username || 'System / Guest'}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5">
                            <Globe size={13} className="text-[var(--ds-text-muted)] shrink-0" />
                            <span>{log.ip_address || '127.0.0.1'}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock size={13} className="text-[var(--ds-text-muted)] shrink-0" />
                            <span>{new Date(log.created_at).toLocaleString()}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="inline-flex items-center gap-1 text-[var(--ds-text-secondary)] hover:text-action hover:underline cursor-pointer"
                          >
                            <span>{isExpanded ? (language === 'ar' ? 'إغلاق' : 'Close') : (language === 'ar' ? 'عرض' : 'View')}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[var(--ds-surface-secondary)]/50">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="p-4 bg-canvas text-success rounded-2xl border border-subtle text-[10px] font-mono leading-relaxed overflow-x-auto max-h-[200px] no-scrollbar">
                              <pre className="m-0 whitespace-pre-wrap">{JSON.stringify(log.details || {}, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
