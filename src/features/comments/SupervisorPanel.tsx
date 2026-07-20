import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { MessageSquare, Send, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

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

const STORAGE_KEY = 'rb_comments_';

export const SupervisorPanel: React.FC = () => {
  const { activeProject, language } = useProject();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newPriority, setNewPriority] = useState('NORMAL');
  const [filterResolved, setFilterResolved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const projectId = activeProject?.id;

  // Load comments from localStorage
  useEffect(() => {
    if (!projectId) return;
    const saved = localStorage.getItem(STORAGE_KEY + projectId);
    if (saved) setComments(JSON.parse(saved));
  }, [projectId]);

  // Save to localStorage
  const persist = (updated: Comment[]) => {
    if (!projectId) return;
    localStorage.setItem(STORAGE_KEY + projectId, JSON.stringify(updated));
    setComments(updated);
  };

  const handleAdd = () => {
    if (!newComment.trim() || !projectId) return;
    const comment: Comment = {
      id: `c-${Date.now()}`,
      projectId,
      authorUsername: language === 'ar' ? 'المشرف' : 'Supervisor',
      contentAr: language === 'ar' ? newComment : '',
      contentEn: language === 'en' ? newComment : '',
      resolved: false,
      priority: newPriority,
      createdAt: new Date().toISOString(),
    };
    persist([comment, ...comments]);
    setNewComment('');
  };

  const handleResolve = (id: string) => {
    persist(comments.map(c => c.id === id ? { ...c, resolved: !c.resolved, resolvedAt: !c.resolved ? new Date().toISOString() : undefined } : c));
  };

  const handleDelete = (id: string) => {
    persist(comments.filter(c => c.id !== id));
  };

  const filtered = filterResolved ? comments : comments.filter(c => !c.resolved);
  const unresolvedCount = comments.filter(c => !c.resolved).length;

  if (!activeProject) return null;

  const priorityColors: Record<string, string> = {
    CRITICAL: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    HIGH: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    NORMAL: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
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
          <MessageSquare size={16} className="text-purple-500" />
          <span className="text-sm font-bold text-[var(--ds-text-primary)]">
            {language === 'ar' ? 'ملاحظات المشرف' : 'Supervisor Comments'}
          </span>
          {unresolvedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-500">
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
              className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            />
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value)}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-2 py-1 text-[10px] font-bold text-[var(--ds-text-secondary)] focus:outline-none"
            >
              <option value="LOW">{language === 'ar' ? 'منخفض' : 'Low'}</option>
              <option value="NORMAL">{language === 'ar' ? 'عادي' : 'Normal'}</option>
              <option value="HIGH">{language === 'ar' ? 'مهم' : 'High'}</option>
              <option value="CRITICAL">{language === 'ar' ? 'حرج' : 'Critical'}</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={!newComment.trim()}
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 cursor-pointer transition-colors"
            >
              <Send size={14} />
            </button>
          </div>

          {/* Filter toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={filterResolved} onChange={() => setFilterResolved(!filterResolved)} className="rounded" />
              <span className="text-[10px] text-[var(--ds-text-muted)] font-semibold">
                {language === 'ar' ? 'إظهار المحلولة' : 'Show resolved'}
              </span>
            </label>
          </div>

          {/* Comments list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-[var(--ds-text-muted)] py-4">
                {language === 'ar' ? 'لا ملاحظات حالياً' : 'No comments yet'}
              </p>
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
                      <button onClick={() => handleResolve(c.id)} className="p-1 rounded hover:bg-emerald-500/10 cursor-pointer transition-colors" title={c.resolved ? 'Unresolve' : 'Resolve'}>
                        <Check size={12} className={c.resolved ? 'text-emerald-500' : 'text-[var(--ds-text-muted)]'} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1 rounded hover:bg-rose-500/10 cursor-pointer transition-colors">
                        <Trash2 size={12} className="text-[var(--ds-text-muted)]" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[var(--ds-text-muted)]">
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
