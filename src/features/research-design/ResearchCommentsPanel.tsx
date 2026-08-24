import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, CheckCircle } from 'lucide-react';

import type { ResearchStepId } from './researchDesignConfig';
import { apiListProjectComments, apiCreateProjectComment, apiResolveProjectComment } from '../../utils/api';

interface ResearchCommentsPanelProps {
  projectId: string;
  activeStepId: ResearchStepId;
  language: 'ar' | 'en';
  onCommentsCountChange?: (count: number) => void;
}

export const ResearchCommentsPanel: React.FC<ResearchCommentsPanelProps> = ({
  projectId,
  activeStepId,
  language,
  onCommentsCountChange
}) => {
  const isAr = language === 'ar';
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const data = await apiListProjectComments(projectId, activeStepId);
      setComments(data || []);
      if (onCommentsCountChange) {
        onCommentsCountChange(data ? data.filter((c: any) => !c.resolved).length : 0);
      }
    } catch (err) {
      console.error('Failed to load step comments:', err);
    }
  }, [activeStepId, onCommentsCountChange, projectId]);

  useEffect(() => {
    if (projectId && activeStepId) {
      fetchComments();
    }
  }, [projectId, activeStepId, fetchComments]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setLoading(true);
    try {
      await apiCreateProjectComment({
        projectId,
        contentAr: newCommentText,
        step: activeStepId,
        priority
      });
      setNewCommentText('');
      fetchComments();
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleResolve = async (commentId: string, currentResolved: boolean) => {
    try {
      await apiResolveProjectComment(commentId, !currentResolved);
      fetchComments();
    } catch (err) {
      console.error('Failed to update comment resolution:', err);
    }
  };

  return (
    <div className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-ai font-bold text-xs">
          <MessageSquare size={16} />
          <span>{isAr ? 'ملاحظات المشرف الأكاديمي للخطوة' : 'Step Supervisor Comments'}</span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-ai/10 text-ai dark:bg-ai/10 dark:text-ai">
          {comments.filter(c => !c.resolved).length} {isAr ? 'مفتوحة' : 'Open'}
        </span>
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleAddComment} className="space-y-2">
        <textarea
          rows={2}
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder={isAr ? 'اكتب ملاحظة أو توجيه أكاديمي لهذه الخطوة...' : 'Add supervisor feedback or direction for this step...'}
          className="w-full p-2.5 rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)] text-xs focus:ring-1 focus:ring-ai outline-none resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <select
            value={priority}
            onChange={(e: any) => setPriority(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] text-[var(--ds-text-primary)]"
          >
            <option value="NORMAL">{isAr ? 'أولوية عادية' : 'Normal Priority'}</option>
            <option value="HIGH">{isAr ? 'أولوية عالية' : 'High Priority'}</option>
            <option value="CRITICAL">{isAr ? 'ملاحظة حاسمة' : 'Critical Issue'}</option>
          </select>

          <button
            type="submit"
            disabled={loading || !newCommentText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-action hover:bg-action-hover text-on-action border-none cursor-pointer disabled:opacity-50 ds-transition"
          >
            <Send size={12} />
            <span>{isAr ? 'إرسال الملاحظة' : 'Post Comment'}</span>
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-2 max-h-60 overflow-y-auto pt-2 border-t border-[var(--ds-border-subtle)]">
        {comments.length === 0 ? (
          <p className="text-xs text-[var(--ds-text-secondary)] text-center py-2">
            {isAr ? 'لا توجد ملاحظات مسجلة على هذه الخطوة بعد.' : 'No comments recorded for this step yet.'}
          </p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                c.resolved
                  ? 'bg-surface-subtle border-subtle opacity-60'
                  : 'bg-[var(--ds-surface-primary)] border-[var(--ds-border-subtle)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--ds-text-primary)]">
                  {c.authorUsername || (isAr ? 'مشرف أكاديمي' : 'Supervisor')}
                </span>
                <button
                  onClick={() => handleToggleResolve(c.id, c.resolved)}
                  className="flex items-center gap-1 text-[11px] text-[var(--ds-text-secondary)] hover:text-ai border-none bg-transparent cursor-pointer"
                >
                  <CheckCircle size={12} className={c.resolved ? 'text-success' : ''} />
                  <span>{c.resolved ? (isAr ? 'معالجة' : 'Resolved') : (isAr ? 'تحديد كمعالجة' : 'Resolve')}</span>
                </button>
              </div>
              <p className="text-[var(--ds-text-secondary)] leading-relaxed">{c.contentAr}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default ResearchCommentsPanel;
