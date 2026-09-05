import React from 'react';
import { Card } from '../../../design-system/components/Card';
import { Button } from '../../../design-system/components/Button';
import { EmptyState } from '../../../design-system/components/Feedback';
import { MessageSquare } from 'lucide-react';
import type { useWorkspaceState } from '../useWorkspaceState';

type WorkspaceState = ReturnType<typeof useWorkspaceState>;

interface WorkspaceCommentsPanelProps {
  engine: WorkspaceState;
}

export const WorkspaceCommentsPanel: React.FC<WorkspaceCommentsPanelProps> = ({ engine }) => {
  const {
    comments,
    newCommentText,
    setNewCommentText,
    commentPriority,
    setCommentPriority,
    handlePostComment,
    handleResolveComment,
    language
  } = engine;

  return (
    <Card className="p-5 border-[var(--ds-border-subtle)] bg-[var(--ds-surface-primary)] rounded-2xl space-y-4 shadow-sm text-xs font-bold">
      <h5 className="text-xs font-black text-[var(--ds-text-muted)] uppercase tracking-widest flex items-center gap-1.5 border-b border-[var(--ds-border-subtle)] pb-2 m-0">
        <MessageSquare size={15} className="text-path-review" />
        <span>{language === 'ar' ? 'ملاحظات المشرف للخطوة' : 'Step Supervisor Notes'}</span>
      </h5>
      
      {/* Write comment form */}
      <form onSubmit={handlePostComment} className="space-y-3">
        <textarea
          placeholder={language === 'ar' ? 'أضف ملاحظة أو توجيه للمشرف...' : 'Add supervisor notes...'}
          rows={2}
          required
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-3 py-2 text-caption focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
        />
        <div className="flex justify-between items-center gap-2">
          <select
            value={commentPriority}
            onChange={(e) => setCommentPriority(e.target.value)}
            className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-lg px-2 py-1 text-caption text-[var(--ds-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
          >
            <option value="NORMAL">NORMAL</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <Button type="submit" className="px-3 py-1 rounded-xl text-caption font-black cursor-pointer">
            {language === 'ar' ? 'إرسال' : 'Send'}
          </Button>
        </div>
      </form>

      {/* List comments */}
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {comments.map((comm) => (
          <div key={comm.id} className="p-2.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl relative">
            <div className="flex justify-between text-[8px] text-[var(--ds-text-muted)] font-bold">
              <span>{comm.authorUsername || 'Guest'}</span>
              <span>{new Date(comm.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="m-0 mt-1 text-caption text-[var(--ds-text-secondary)] leading-relaxed font-semibold">{comm.contentAr}</p>
            <div className="flex justify-between items-center mt-2">
              <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                comm.priority === 'CRITICAL' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
              }`}>{comm.priority}</span>
              {!comm.resolved && (
                <button 
                  onClick={() => handleResolveComment(comm.id)}
                  className="text-[8px] text-success hover:underline cursor-pointer bg-transparent border-none font-bold"
                >
                  {language === 'ar' ? 'حل الملاحظة ✓' : 'Resolve'}
                </button>
              )}
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <EmptyState
            bare
            className="py-2"
            title={language === 'ar' ? 'لا توجد ملاحظات لهذه الخطوة' : 'No notes for this step'}
            description={language === 'ar' ? 'أضف ملاحظة للمشرف على هذه الخطوة.' : 'Post a supervisor note for this step.'}
          />
        )}
      </div>
    </Card>
  );
};
