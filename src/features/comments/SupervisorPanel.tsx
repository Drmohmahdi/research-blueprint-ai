import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { MessageSquare, Send, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { EmptyState } from '../../design-system/components/Feedback';
import { apiCreateProjectComment, apiDeleteProjectComment, apiListProjectComments, apiResolveProjectComment } from '../../utils/api';

interface Comment {
  id: string;
  projectId: string;
  authorUsername: string;
  fieldKey?: string;
  step?: string;
  contentAr: string;
  contentEn?: string;
  resolved: boolean;
  priority: string;
  createdAt: string;
  resolvedAt?: string;
}

export const SupervisorPanel: React.FC = () => {
  const { activeProject, language } = useProject();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newPriority, setNewPriority] = useState('NORMAL');
  const [filterResolved, setFilterResolved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const projectId = activeProject?.id;

  useEffect(() => {
    if (!projectId) return;
    void apiListProjectComments(projectId).then((list) => {
      if (list) setComments(list);
    });
  }, [projectId]);

  const handleAdd = async () => {
    if (!newComment.trim() || !projectId) return;
    const created = await apiCreateProjectComment({
      projectId,
      contentAr: newComment,
      step: undefined,
      priority: newPriority,
    });
    if (created) {
      setComments((current) => [created, ...current]);
      setNewComment('');
    }
  };

  const handleResolve = async (id: string) => {
    const current = comments.find((item) => item.id === id);
    if (!current) return;
    const updated = await apiResolveProjectComment(id, !current.resolved);
    if (updated) {
      setComments((items) => items.map((item) => item.id === id ? { ...item, resolved: !item.resolved, resolvedAt: !item.resolved ? new Date().toISOString() : undefined } : item));
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await apiDeleteProjectComment(id);
    if (ok) setComments((items) => items.filter((item) => item.id !== id));
  };

  const filtered = filterResolved ? comments : comments.filter(c => !c.resolved);
  const unresolvedCount = comments.filter(c => !c.resolved).length;

  if (!activeProject) return null;

  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-danger/10 text-danger border-danger/20',
    HIGH: 'bg-warning/10 text-warning border-warning/20',
    NORMAL: 'bg-[var(--ds-information-soft)] text-[var(--ds-information)] border-info/20',
    LOW: 'bg-[var(--ds-surface-secondary)] text-[var(--ds-text-muted)] border-[var(--ds-border-subtle)]',
  };

  return (
    <div className="bg-[var(--ds-surface-primary)] border border-[var(--ds-border-subtle)] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--ds-surface-secondary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-path-review" />
          <span className="text-sm font-bold text-[var(--ds-text-primary)]">
            {language === 'ar' ? 'ملاحظات المشرف' : 'Supervisor Comments'}
          </span>
          {unresolvedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-caption font-black bg-danger/10 text-danger">
              {unresolvedCount}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={14} className="text-[var(--ds-text-muted)]" /> : <ChevronDown size={14} className="text-[var(--ds-text-muted)]" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--ds-border-subtle)]">
          {/* Add comment */}
          <div className="flex gap-2 pt-3">
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={language === 'ar' ? 'أضف ملاحظة...' : 'Add a comment...'}
              className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
            />
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value)}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-2 py-1 text-caption font-bold text-[var(--ds-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
            >
              <option value="LOW">{language === 'ar' ? 'منخفض' : 'Low'}</option>
              <option value="NORMAL">{language === 'ar' ? 'عادي' : 'Normal'}</option>
              <option value="HIGH">{language === 'ar' ? 'مهم' : 'High'}</option>
              <option value="CRITICAL">{language === 'ar' ? 'حرج' : 'Critical'}</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={!newComment.trim()}
              className="p-2 rounded-xl bg-action hover:bg-action-hover text-on-action disabled:opacity-40 cursor-pointer ds-transition"
            >
              <Send size={14} />
            </button>
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={filterResolved} onChange={() => setFilterResolved(!filterResolved)} className="h-4 w-4 rounded border-[var(--ds-border-default)] text-[var(--ds-primary)] focus:ring-[var(--ds-primary)] cursor-pointer" />
              <span className="text-caption text-[var(--ds-text-muted)] font-semibold">
                {language === 'ar' ? 'إظهار المحلولة' : 'Show resolved'}
              </span>
            </label>
          </div>

          {/* Comments list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <EmptyState
                bare
                className="py-3"
                title={language === 'ar' ? 'لا ملاحظات حالياً' : 'No comments yet'}
                description={language === 'ar' ? 'أضف ملاحظة للمشرف أو للفريق على هذا المشروع.' : 'Add a note for the supervisor or team on this project.'}
              />
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                    c.resolved ? 'opacity-50 bg-[var(--ds-surface-secondary)] border-[var(--ds-border-subtle)]' : priorityColors[c.priority] || priorityColors.NORMAL
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-[var(--ds-text-primary)] m-0 leading-relaxed">
                        {language === 'ar' ? c.contentAr || c.contentEn : c.contentEn || c.contentAr}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleResolve(c.id)} className="p-1 rounded hover:bg-action/10 cursor-pointer transition-colors" title={c.resolved ? 'Unresolve' : 'Resolve'}>
                        <Check size={12} className={c.resolved ? 'text-success' : 'text-[var(--ds-text-muted)]'} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-danger/10 cursor-pointer transition-colors">
                        <Trash2 size={12} className="text-[var(--ds-text-muted)]" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-caption text-[var(--ds-text-muted)]">
                    <span>{c.authorUsername}</span>
                    <span>•</span>
                    <span>{new Date(c.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                    {c.priority !== 'NORMAL' && (
                      <>
                        <span>•</span>
                        <span className="font-black uppercase">{c.priority}</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
