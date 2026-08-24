import React from 'react';
import { Navigate } from 'react-router-dom';
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
  const { user, isSecureMode } = useProject();

  // في وضع التطوير (isSecureMode=false) نسمح بالوصول للمطوّرين
  if (!isSecureMode) {
    return <>{children}</>;
  }

  // في الإنتاج: تحقق من دور المستخدم
  if (!user) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const isAdmin = ['admin', 'superadmin', 'SystemAdmin', 'Developer'].includes(user.role);

  if (!isAdmin) {
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
          وصول مقيّد
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem', textAlign: 'center' }}>
          هذه الصفحة متاحة للمسؤولين والمطوّرين فقط.
          <br />
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            Access Restricted — Admin role required.
          </span>
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
