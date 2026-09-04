import React from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { ROUTES } from '../router/routes';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ permission, children }) => {
  const { user, language } = useProject();
  const ar = language === 'ar';
  const allowed = Boolean(user?.permissions?.includes(permission));

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: '1rem',
        color: 'var(--ds-text-secondary)',
        fontFamily: 'var(--ds-font-primary)',
      }}
    >
      <h2
        style={{
          color: 'var(--ds-text-primary)',
          fontSize: '1.25rem',
          fontWeight: 600,
          margin: 0,
        }}
      >
        {ar ? 'صلاحية غير كافية' : 'Insufficient permission'}
      </h2>
      <p style={{ margin: 0, fontSize: '0.9rem', textAlign: 'center' }}>
        {ar
          ? 'هذه الصفحة تتطلب صلاحية لا يملكها دورك الحالي في مساحة العمل.'
          : 'This page requires a workspace permission your current role does not have.'}
      </p>
      <Link
        to={ROUTES.PORTAL}
        className="rounded-lg bg-action px-4 py-2.5 text-sm font-bold text-on-action"
      >
        {ar ? 'العودة إلى البوابة' : 'Return to portal'}
      </Link>
    </div>
  );
};
