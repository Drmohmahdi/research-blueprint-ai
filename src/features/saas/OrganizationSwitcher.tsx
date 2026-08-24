import React, { useState, useEffect } from 'react';
import { 
  apiListOrganizations, 
  apiGetActiveOrganization, 
  apiCreateOrganization, 
  apiListMembers, 
  apiInviteMember, 
  apiListInvitations, 
  apiAcceptInvitation,
  setApiActiveOrgId
} from '../../utils/api';
import { Building2, UserPlus, Send, CheckCircle, Mail, Plus, Shield, Users } from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';

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
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  
  // Modals / forms
  const [newOrgName, setNewOrgName] = useState('');
  const [parentId, setParentId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  
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
    
    const invite = await apiInviteMember(inviteEmail, inviteRole);
    if (invite) {
      setMessage(language === 'ar' ? 'تم إرسال الدعوة بنجاح!' : 'Invitation sent successfully!');
      setInviteEmail('');
      loadData();
    } else {
      setError(language === 'ar' ? 'فشل إرسال الدعوة. يرجى التحقق من الصلاحيات أو الباقة.' : 'Failed to send invitation. Check plan limits.');
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setError('');
    setMessage('');
    const ok = await apiAcceptInvitation(inviteId);
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
      <Card className="p-6 bg-[var(--ds-surface-primary)] border-[var(--ds-border-subtle)] rounded-3xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-ai/10 text-ai flex items-center justify-center shadow-md">
              <Building2 size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-widest block">
                {language === 'ar' ? 'مساحة العمل النشطة' : 'Active Workspace'}
              </span>
              <h3 className="text-lg font-black text-[var(--ds-text-primary)] m-0">
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
              className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-xl px-4 py-2 text-xs font-bold text-[var(--ds-text-secondary)] focus:outline-none"
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
      </Card>

      {message && (
        <div className="p-3.5 border border-success/20 bg-action/5 text-success rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{message}</span>
        </div>
      )}

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
          <Card className="p-6 border-[var(--ds-border-subtle)] rounded-3xl bg-[var(--ds-surface-primary)]">
            <h4 className="text-sm font-black mb-4 flex items-center gap-2">
              <Plus size={18} className="text-ai" />
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
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-ai"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-[var(--ds-text-muted)] uppercase tracking-wider block mb-1">
                  {language === 'ar' ? 'المؤسسة الأب (اختياري):' : 'Parent Organization (Optional):'}
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-ai text-[var(--ds-text-secondary)]"
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
            <Card className="p-6 border-[var(--ds-border-subtle)] rounded-3xl bg-[var(--ds-surface-primary)]">
              <h4 className="text-sm font-black mb-4 flex items-center gap-2">
                <Mail size={18} className="text-ai" />
                <span>{language === 'ar' ? 'الدعوات المعلقة' : 'Pending Invitations'}</span>
              </h4>
              <div className="space-y-3">
                {invitations.map(invite => (
                  <div key={invite.id} className="p-3.5 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-black">{invite.organization_name}</div>
                      <div className="text-[10px] text-[var(--ds-text-muted)] font-semibold mt-1">
                        {language === 'ar' ? `الدور المقترح: ${invite.role}` : `Role: ${invite.role}`}
                      </div>
                    </div>
                    <Button 
                      variant="primary" 
                      onClick={() => handleAcceptInvite(invite.id)}
                      className="px-3.5 py-1.5 rounded-xl text-[10px] font-black"
                    >
                      {language === 'ar' ? 'قبول' : 'Accept'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Team Members List & Invitation Form */}
        <div className="space-y-6">
          <Card className="p-6 border-[var(--ds-border-subtle)] rounded-3xl bg-[var(--ds-surface-primary)]">
            <h4 className="text-sm font-black mb-4 flex items-center gap-2">
              <Users size={18} className="text-ai" />
              <span>{language === 'ar' ? 'فريق العمل النشط' : 'Active Team Members'}</span>
            </h4>
            <div className="space-y-3 mb-6 max-h-[220px] overflow-y-auto pr-1">
              {members.map(member => (
                <div key={member.id} className="p-3 bg-[var(--ds-surface-secondary)] rounded-2xl flex items-center justify-between gap-4 border border-[var(--ds-border-subtle)]">
                  <div>
                    <div className="text-xs font-black">{member.username}</div>
                    <div className="text-[10px] text-[var(--ds-text-muted)] font-semibold mt-0.5">{member.email}</div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-ai/10 text-ai text-[10px] font-extrabold uppercase border border-ai/20">
                    {member.role}
                  </div>
                </div>
              ))}
            </div>

            {/* Invite team member form */}
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
                    className="flex-1 bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="bg-[var(--ds-surface-secondary)] border border-[var(--ds-border-subtle)] rounded-2xl px-3 py-2 text-xs font-bold text-[var(--ds-text-secondary)] focus:outline-none"
                  >
                    <option value="ADMIN">{language === 'ar' ? 'مشرف (Admin)' : 'Admin'}</option>
                    <option value="MEMBER">{language === 'ar' ? 'باحث (Member)' : 'Member'}</option>
                    <option value="VIEWER">{language === 'ar' ? 'مراقب (Viewer)' : 'Viewer'}</option>
                  </select>
                </div>
                <Button type="submit" variant="primary" className="w-full py-2.5 rounded-2xl font-black justify-center flex items-center gap-1.5 shadow-md">
                  <Send size={14} />
                  <span>{language === 'ar' ? 'إرسال دعوة الانضمام' : 'Send Join Invitation'}</span>
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
