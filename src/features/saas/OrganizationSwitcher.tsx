import React, { useState, useEffect } from 'react';
import { 
  apiListOrganizations, 
  apiGetActiveOrganization, 
  apiCreateOrganization, 
  apiListMembers, 
  apiInviteMember, 
  apiListInvitations, 
  apiAcceptInvitation,
  setApiActiveOrgId,
  isPlanLimitError,
} from '../../utils/api';
import { PlanLimitNotice } from '../../components/PlanLimitNotice';
import { Building2, UserPlus, Send, CheckCircle, Mail, Plus, Shield, Users } from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { PathPanel } from '../../design-system/components/Navigation';
import { useProject } from '../../context/ProjectContext';

interface OrganizationSwitcherProps {
  language: 'ar' | 'en';
}

const buildHierarchy = (orgs: any[]): any[] => {
  const roots = orgs.filter(o => !o.parent_id);
  const result: any[] = [];
  
  const traverse = (org: any) => {
    result.push(org);
    const children = orgs.filter(o => o.parent_id === org.id);
    children.forEach(traverse);
  };
  
  roots.forEach(traverse);
  
  const addedIds = new Set(result.map(o => o.id));
  orgs.forEach(o => {
    if (!addedIds.has(o.id)) {
      result.push(o);
    }
  });
  
  return result;
};

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({ language }) => {
  const { user } = useProject();
  const canInvite = Boolean(user?.permissions?.includes('members.invite'));
  const canViewPii = Boolean(user?.permissions?.includes('members.view_pii'));
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  
  // Modals / forms
  const [newOrgName, setNewOrgName] = useState('');
  const [parentId, setParentId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('RESEARCHER');
  const [inviteToken, setInviteToken] = useState('');
  const [planLimitHit, setPlanLimitHit] = useState(false);
  const [issuedToken, setIssuedToken] = useState('');
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const active = await apiGetActiveOrganization();
      if (active) {
        setActiveOrg(active);
        setApiActiveOrgId(active.id);
      }
      
      const list = await apiListOrganizations();
      if (list) setOrganizations(list);
      
      const mbrs = await apiListMembers();
      if (mbrs) setMembers(mbrs);
      
      const invites = await apiListInvitations();
      if (invites) setInvitations(invites);
    } catch (e) {
      console.error("Failed to load organizations data", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSwitch = async (orgId: string) => {
    setApiActiveOrgId(orgId);
    // Reload data for the new organization context
    const active = await apiGetActiveOrganization();
    if (active) {
      setActiveOrg(active);
      window.location.reload(); // Hard reload to refresh all context scopes
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setError('');
    setMessage('');
    
    const newOrg = await apiCreateOrganization(newOrgName, parentId || null);
    if (newOrg) {
      setMessage(language === 'ar' ? 'تم إنشاء مساحة العمل بنجاح!' : 'Workspace created successfully!');
      setNewOrgName('');
      setParentId('');
      loadData();
    } else {
      setError(language === 'ar' ? 'فشل إنشاء مساحة العمل. يرجى التحقق من الصلاحيات أو الباقة.' : 'Failed to create workspace. Check permissions or plan limits.');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setError('');
    setMessage('');
    setPlanLimitHit(false);
    
    try {
      const invite = await apiInviteMember(inviteEmail, inviteRole);
      if (invite) {
        setIssuedToken(invite.token || '');
        setMessage(language === 'ar'
          ? (invite.token ? `تم إنشاء الدعوة. سلّم الرمز للمستدعى: ${invite.token}` : 'تم إرسال الدعوة بنجاح!')
          : (invite.token ? `Invitation created. Share this token: ${invite.token}` : 'Invitation sent successfully!'));
        setInviteEmail('');
        loadData();
      } else {
        setError(language === 'ar' ? 'فشل إرسال الدعوة. يرجى التحقق من الصلاحيات أو الباقة.' : 'Failed to send invitation. Check plan limits.');
      }
    } catch (error) {
      if (isPlanLimitError(error)) {
        setPlanLimitHit(true);
      } else {
        setError(language === 'ar' ? 'فشل إرسال الدعوة. يرجى التحقق من الصلاحيات أو الباقة.' : 'Failed to send invitation. Check plan limits.');
      }
    }
  };

  const handleAcceptInvite = async (token: string) => {
    setError('');
    setMessage('');
    const ok = await apiAcceptInvitation(token.trim());
    if (ok) {
      setMessage(language === 'ar' ? 'تم قبول الدعوة بنجاح!' : 'Invitation accepted successfully!');
      loadData();
    } else {
      setError(language === 'ar' ? 'فشل قبول الدعوة.' : 'Failed to accept invitation.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Workspace Status Card */}
      <PathPanel accent="var(--ds-path-identity)">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[var(--ds-primary-soft)] text-[var(--ds-primary)] flex items-center justify-center">
              <Building2 size={24} />
            </div>
            <div>
              <span className="text-caption font-black text-[var(--ds-text-muted)] uppercase tracking-widest block">
                {language === 'ar' ? 'مساحة العمل النشطة' : 'Active Workspace'}
              </span>
              <h3 className="text-h3 text-[var(--ds-text-primary)] m-0">
                {activeOrg ? activeOrg.name : (language === 'ar' ? 'جاري التحميل...' : 'Loading...')}
              </h3>
            </div>
          </div>

          {/* Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--ds-text-secondary)]">
              {language === 'ar' ? 'تنقل بين المساحات:' : 'Switch Workspace:'}
            </span>
            <select
              value={activeOrg?.id || ''}
              onChange={(e) => handleSwitch(e.target.value)}
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-4 py-2 text-xs font-bold text-[var(--ds-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
            >
              {buildHierarchy(organizations).map(org => {
                const prefix = org.hierarchy_level > 0 ? '\u00A0\u00A0'.repeat(org.hierarchy_level) + '↳ ' : '';
                return (
                  <option key={org.id} value={org.id}>
                    {prefix}{org.name}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </PathPanel>

      {message && (
        <div className="p-3.5 border border-success/20 bg-[var(--ds-success-soft)] text-success rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{message}</span>
        </div>
      )}

      {planLimitHit && <PlanLimitNotice language={language} />}
      {error && (
        <div className="p-3.5 border border-danger/20 bg-danger/5 text-danger rounded-2xl text-xs font-bold flex items-center gap-2">
          <Shield size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Create workspace & Invites */}
        <div className="space-y-6">
          
          {/* Create Workspace */}
          <Card className="p-6 border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)]">
            <h4 className="text-h4 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-path-identity" />
              <span>{language === 'ar' ? 'إنشاء مساحة عمل جديدة' : 'Create New Workspace'}</span>
            </h4>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'اسم المؤسسة أو مساحة العمل' : 'Workspace / Organization Name'}
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                />
              </div>
              
              <div>
                <label className="text-caption font-black text-[var(--ds-text-muted)] uppercase tracking-wider block mb-1">
                  {language === 'ar' ? 'المؤسسة الأب (اختياري):' : 'Parent Organization (Optional):'}
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)] text-[var(--ds-text-secondary)]"
                >
                  <option value="">{language === 'ar' ? 'بدون (مساحة عمل رئيسية)' : 'None (Root Workspace)'}</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              <Button type="submit" variant="primary" className="w-full py-2.5 rounded-2xl font-black justify-center shadow-md">
                {language === 'ar' ? 'إنشاء مساحة العمل' : 'Create Workspace'}
              </Button>
            </form>
          </Card>

          {/* Pending Invitations list */}
          {invitations.length > 0 && (
            <Card className="p-6 border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)]">
              <h4 className="text-h4 mb-4 flex items-center gap-2">
                <Mail size={18} className="text-path-identity" />
                <span>{language === 'ar' ? 'دعوات صادرة معلّقة' : 'Outgoing pending invitations'}</span>
              </h4>
              <div className="space-y-3">
                {invitations.map(invite => (
                  <div key={invite.id} className="p-3.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-black">{invite.email}</div>
                      <div className="text-caption text-[var(--ds-text-muted)] font-semibold mt-1">
                        {language === 'ar' ? `الدور المقترح: ${invite.role}` : `Role: ${invite.role}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-6 border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)]">
            <h4 className="text-h4 mb-3">{language === 'ar' ? 'الانضمام برمز دعوة' : 'Join with invitation token'}</h4>
            <form
              className="flex flex-col sm:flex-row gap-3"
              onSubmit={(e) => { e.preventDefault(); if (inviteToken.trim()) void handleAcceptInvite(inviteToken); }}
            >
              <input
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder={language === 'ar' ? 'الصق رمز الدعوة' : 'Paste invitation token'}
                className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
              />
              <Button type="submit" variant="primary" className="px-4 py-2 rounded-xl text-xs font-black">
                {language === 'ar' ? 'قبول الدعوة' : 'Accept invitation'}
              </Button>
            </form>
            {issuedToken && (
              <p className="mt-3 m-0 text-caption font-bold text-[var(--ds-text-secondary)] break-all">
                {language === 'ar' ? 'آخر رمز صادر:' : 'Last issued token:'} {issuedToken}
              </p>
            )}
          </Card>
        </div>

        {/* Team Members List & Invitation Form */}
        <div className="space-y-6">
          <Card className="p-6 border-[var(--ds-border-subtle)] rounded-2xl bg-[var(--ds-surface-primary)]">
            <h4 className="text-h4 mb-4 flex items-center gap-2">
              <Users size={18} className="text-[var(--ds-primary)]" />
              <span>{language === 'ar' ? 'فريق العمل النشط' : 'Active Team Members'}</span>
            </h4>
            <div className="space-y-3 mb-6 max-h-[220px] overflow-y-auto pr-1">
              {members.map(member => (
                <div key={member.id} className="p-3 bg-[var(--ds-surface-secondary)] rounded-2xl flex items-center justify-between gap-4 border border-[var(--ds-border-subtle)]">
                  <div>
                    <div className="text-xs font-black">{member.username}</div>
                    <div className="text-caption text-[var(--ds-text-muted)] font-semibold mt-0.5">{canViewPii ? member.email : '—'}</div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-[var(--ds-information-soft)] text-[var(--ds-information)] text-caption font-extrabold uppercase border border-info/20">
                    {member.role}
                  </div>
                </div>
              ))}
            </div>

            {canInvite && (
            <div className="border-t border-[var(--ds-border-subtle)] pt-4">
              <h5 className="text-xs font-black mb-3 flex items-center gap-1.5 text-[var(--ds-text-secondary)]">
                <UserPlus size={14} />
                <span>{language === 'ar' ? 'دعوة عضو جديد للفريق' : 'Invite New Team Member'}</span>
              </h5>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    placeholder={language === 'ar' ? 'البريد الإلكتروني للعضو' : 'Member Email Address'}
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-3 py-2 text-xs font-bold text-[var(--ds-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-primary-soft)]"
                  >
                    {user?.org_role === 'OWNER' && (
                      <option value="ORGANIZATION_ADMIN">{language === 'ar' ? 'مدير المؤسسة' : 'Organization admin'}</option>
                    )}
                    <option value="SUPERVISOR">{language === 'ar' ? 'مشرف أكاديمي' : 'Supervisor'}</option>
                    <option value="RESEARCHER">{language === 'ar' ? 'باحث' : 'Researcher'}</option>
                    <option value="VIEWER">{language === 'ar' ? 'مراقب' : 'Viewer'}</option>
                  </select>
                </div>
                <Button type="submit" variant="primary" className="w-full py-2.5 rounded-2xl font-black justify-center flex items-center gap-1.5 shadow-md">
                  <Send size={14} />
                  <span>{language === 'ar' ? 'إرسال دعوة الانضمام' : 'Send Join Invitation'}</span>
                </Button>
              </form>
            </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
