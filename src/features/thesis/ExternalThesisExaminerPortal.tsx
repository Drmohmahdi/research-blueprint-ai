import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GraduationCap, ShieldCheck, Send } from 'lucide-react';
import { PathPanel } from '../../design-system/components/Navigation';
import { EmptyState } from '../../design-system/components/Feedback';
import { apiExternalThesisPortal, apiExternalThesisReport, apiExternalThesisRespond } from '../../utils/api';

export const ExternalThesisExaminerPortal: React.FC = () => {
  const { token = '' } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [assessment, setAssessment] = useState('');
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [confidential, setConfidential] = useState('');
  const [coi, setCoi] = useState('No conflict declared by examiner');
  const [recommendation, setRecommendation] = useState('MAJOR_CORRECTIONS');
  const [busy, setBusy] = useState(false);

  const load = () => apiExternalThesisPortal(token).then(setData).catch(e => setError(e.message));
  useEffect(() => {
    void apiExternalThesisPortal(token).then(setData).catch(e => setError(e.message));
  }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      await apiExternalThesisRespond(token, true, { disclosure: true, declaration: coi });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await apiExternalThesisReport(token, {
        rubric_version: 'THESIS-1',
        rubric_response: {},
        general_assessment: assessment,
        strengths,
        major_concerns: concerns,
        required_corrections: [],
        recommendation,
        confidential_comments: confidential || null,
        confidentiality_level: 'COMMITTEE_ONLY'
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--ds-surface-secondary)] p-6" dir="ltr">
        <EmptyState
          illustration={<ShieldCheck size={40} />}
          title="Invitation unavailable"
          description="The secure examiner link is invalid, expired, or revoked."
        />
      </main>
    );
  }

  if (!data) {
    return (
      <div role="status" className="p-10 text-center text-sm font-bold text-[var(--ds-text-muted)]">
        Loading secure examination assignment…
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ds-surface-secondary)] p-4 sm:p-8" dir="ltr">
      <div className="mx-auto max-w-4xl space-y-5">
        <PathPanel accent="var(--ds-path-review)">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-9 w-9 text-path-review" />
            <div>
              <p className="text-xs font-black text-path-review m-0">BASEERAH · RESTRICTED EXTERNAL EXAMINATION</p>
              <h1 className="text-2xl font-black m-0">Assigned thesis examination</h1>
            </div>
          </div>
          <p className="mt-4 text-sm text-secondary m-0">
            You can access only the frozen thesis version assigned to this examination. Current student workspaces and other reports are not available.
          </p>
        </PathPanel>

        <section className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-6">
          <h2 className="text-xl font-black m-0">{data.thesis.title_en || data.thesis.title_ar || 'Frozen thesis'}</h2>
          <p className="mt-2 font-mono text-xs text-[var(--ds-text-muted)]">Fingerprint: {data.thesis_fingerprint}</p>
            <p className="mt-3 text-sm m-0">Assignment: {data.assignment.status} · Due: {data.assignment.due_at || 'Not specified'}</p>
          {data.instructions && <p className="mt-3 text-sm">{data.instructions}</p>}
          <section className="mt-4 rounded-xl bg-[var(--ds-surface-secondary)] p-4" aria-labelledby="rubric-title">
            <h2 id="rubric-title" className="m-0 text-sm font-black">Evaluation rubric</h2>
            <ul className="mb-0 mt-2 space-y-1 p-0 text-sm">
              <li className="list-none">Scientific contribution</li>
              <li className="list-none">Methodology integrity</li>
              <li className="list-none">Argument and evidence</li>
              <li className="list-none">Presentation and academic writing</li>
            </ul>
          </section>
          {data.assignment.status === 'INVITED' && (
            <>
              <label className="mt-4 block text-sm font-bold">
                Conflict of interest disclosure
                <textarea value={coi} onChange={e => setCoi(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
              </label>
              <button disabled={busy} onClick={accept} className="mt-5 rounded-xl bg-action px-5 py-3 font-bold text-on-action">
                Accept assignment and declare COI
              </button>
            </>
          )}
        </section>

        {data.assignment.status === 'ACCEPTED' && (
          <section className="rounded-2xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-primary)] p-6">
            <h2 className="font-black m-0">Examiner report</h2>
            <label className="mt-4 block text-sm font-bold">
              General assessment
              <textarea
                value={assessment}
                onChange={e => setAssessment(e.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Strengths
              <textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Major concerns
              <textarea value={concerns} onChange={e => setConcerns(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Confidential comments (committee / graduate studies only)
              <textarea value={confidential} onChange={e => setConfidential(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]" />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Recommendation
              <select
                value={recommendation}
                onChange={e => setRecommendation(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--ds-border-default)] bg-[var(--ds-surface-secondary)] p-3 text-[var(--ds-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              >
                <option>PASS</option>
                <option>MINOR_CORRECTIONS</option>
                <option>MAJOR_CORRECTIONS</option>
                <option>REEXAMINATION</option>
                <option>FAIL</option>
              </select>
            </label>
            <button
              disabled={busy || !assessment.trim()}
              onClick={submit}
              className="mt-5 flex items-center gap-2 rounded-xl bg-action px-5 py-3 font-bold text-on-action"
            >
              <Send className="h-4 w-4" />
              Submit immutable report
            </button>
          </section>
        )}

        {data.own_report?.status === 'SUBMITTED' && (
          <p className="rounded-xl bg-[var(--ds-success-soft)] p-4 text-sm font-bold text-success m-0">
            Report submitted and locked at {data.own_report.submitted_at}.
          </p>
        )}
      </div>
    </main>
  );
};

export default ExternalThesisExaminerPortal;
