import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { ROUTES } from '../router/routes';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard — يحمي الصفحات الإدارية والمطوّرية
 * يسمح بالوصول فقط للمستخدمين بدور admin أو superadmin
 * يُعيد توجيه المستخدمين العاديين للرئيسية
 */
export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { user, isSecureMode, language } = useProject();
  const ar = language === 'ar';

  const isAdmin = Boolean(
    user?.is_global_admin ||
    (user?.role && ['admin', 'superadmin', 'SystemAdmin', 'Developer'].includes(user.role))
  );

  // Logged-in non-admins are always blocked, including local secure-mode off.
  if (user && !isAdmin) {
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
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ds-danger)"
          strokeWidth="1.5"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h2
          style={{
            color: 'var(--ds-text-primary)',
            fontSize: '1.25rem',
            fontWeight: 600,
            margin: 0,
          }}
        >
          {ar ? 'وصول مقيّد' : 'Access restricted'}
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem', textAlign: 'center' }}>
          {ar ? 'هذه الصفحة متاحة لمشغّلي المنصة فقط.' : 'This page is available to platform operators only.'}
        </p>
        <Link
          to={ROUTES.PORTAL}
          className="rounded-lg bg-action px-4 py-2.5 text-sm font-bold text-on-action"
        >
          {ar ? 'العودة إلى البوابة' : 'Return to portal'}
        </Link>
      </div>
    );
  }

  if (!isSecureMode && !user) {
    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
};

