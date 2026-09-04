"""Organization RBAC catalog for Baseerah (بصيرة).

Two identity planes stay distinct on purpose:

1. ``User.role`` — legacy platform identity (Researcher, SystemAdmin, …).
   Platform operators (GLOBAL_ADMIN_ROLES) receive *platform* permissions only.
   They never inherit organization OWNER powers or academic data access.
2. ``OrganizationMembership.role`` — the real tenant RBAC used by
   ``require_permission`` / ``require_role``.

Project-level relationships (PI, DATA_ANALYST, …) and dataset capabilities
remain in ``research_design`` / ``data_authz``; this module is org-scoped.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..models import OrganizationMembership, User
from .tenant_context import GLOBAL_ADMIN_ROLES, TenantContext, get_tenant_context

ORG_ROLES = (
    "OWNER",
    "ORGANIZATION_ADMIN",
    "SUPERVISOR",
    "RESEARCHER",
    "VIEWER",
)

# Roles that may be assigned through invitation. OWNER is never inviteable —
# ownership transfer is a dedicated (not yet implemented) operation.
INVITABLE_ROLES = (
    "ORGANIZATION_ADMIN",
    "SUPERVISOR",
    "RESEARCHER",
    "VIEWER",
)

ROLE_ALIASES = {
    "OWNER": "OWNER",
    "ORGANIZATION_ADMIN": "ORGANIZATION_ADMIN",
    "ORGANIZATIONADMIN": "ORGANIZATION_ADMIN",
    "ADMIN": "ORGANIZATION_ADMIN",
    "SUPERVISOR": "SUPERVISOR",
    "RESEARCHER": "RESEARCHER",
    "MEMBER": "RESEARCHER",
    "STUDENT": "RESEARCHER",
    "STATISTICIAN": "RESEARCHER",
    "VIEWER": "VIEWER",
}

ROLE_RANK = {
    "VIEWER": 0,
    "RESEARCHER": 1,
    "SUPERVISOR": 2,
    "ORGANIZATION_ADMIN": 3,
    "OWNER": 4,
}

# Granular org permissions. Platform permissions are added separately and
# never imply academic or billing authority.
PERM_ORG_VIEW = "org.view"
PERM_ORG_CREATE = "org.create"
PERM_MEMBERS_VIEW = "members.view"
PERM_MEMBERS_VIEW_PII = "members.view_pii"
PERM_MEMBERS_INVITE = "members.invite"
PERM_MEMBERS_MANAGE = "members.manage"
PERM_INVITATIONS_VIEW = "invitations.view"
PERM_BILLING_VIEW = "billing.view"
PERM_BILLING_MANAGE = "billing.manage"
PERM_AUDIT_VIEW = "audit.view"
PERM_PROJECTS_VIEW = "projects.view"
PERM_PROJECTS_CREATE = "projects.create"
PERM_PLATFORM_SETTINGS = "platform.settings"
PERM_PLATFORM_USERS = "platform.users.manage"

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "VIEWER": frozenset({
        PERM_ORG_VIEW,
        PERM_MEMBERS_VIEW,
        PERM_PROJECTS_VIEW,
    }),
    "RESEARCHER": frozenset({
        PERM_ORG_VIEW,
        PERM_ORG_CREATE,
        PERM_MEMBERS_VIEW,
        PERM_PROJECTS_VIEW,
        PERM_PROJECTS_CREATE,
    }),
    "SUPERVISOR": frozenset({
        PERM_ORG_VIEW,
        PERM_ORG_CREATE,
        PERM_MEMBERS_VIEW,
        PERM_PROJECTS_VIEW,
        PERM_PROJECTS_CREATE,
    }),
    "ORGANIZATION_ADMIN": frozenset({
        PERM_ORG_VIEW,
        PERM_ORG_CREATE,
        PERM_MEMBERS_VIEW,
        PERM_MEMBERS_VIEW_PII,
        PERM_MEMBERS_INVITE,
        PERM_MEMBERS_MANAGE,
        PERM_INVITATIONS_VIEW,
        PERM_BILLING_VIEW,
        PERM_AUDIT_VIEW,
        PERM_PROJECTS_VIEW,
        PERM_PROJECTS_CREATE,
    }),
    "OWNER": frozenset({
        PERM_ORG_VIEW,
        PERM_ORG_CREATE,
        PERM_MEMBERS_VIEW,
        PERM_MEMBERS_VIEW_PII,
        PERM_MEMBERS_INVITE,
        PERM_MEMBERS_MANAGE,
        PERM_INVITATIONS_VIEW,
        PERM_BILLING_VIEW,
        PERM_BILLING_MANAGE,
        PERM_AUDIT_VIEW,
        PERM_PROJECTS_VIEW,
        PERM_PROJECTS_CREATE,
    }),
}

PLATFORM_PERMISSIONS = frozenset({
    PERM_PLATFORM_SETTINGS,
    PERM_PLATFORM_USERS,
})

ACCOUNT_STATUS_ACTIVE = "ACTIVE"
ACCOUNT_STATUS_DISABLED = "DISABLED"


def is_platform_admin(user: User | None) -> bool:
    if user is None:
        return False
    return (getattr(user, "role", None) or "").upper() in GLOBAL_ADMIN_ROLES


def account_status_of(user: User | None) -> str:
    raw = (getattr(user, "account_status", None) or ACCOUNT_STATUS_ACTIVE).upper()
    return raw if raw in {ACCOUNT_STATUS_ACTIVE, ACCOUNT_STATUS_DISABLED} else ACCOUNT_STATUS_ACTIVE


def normalize_org_role(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().upper().replace("-", "_").replace(" ", "_")
    return ROLE_ALIASES.get(key)


def permissions_for(org_role: str | None, *, platform_admin: bool = False) -> list[str]:
    perms = set(ROLE_PERMISSIONS.get(org_role or "", ()))
    if platform_admin:
        perms |= PLATFORM_PERMISSIONS
    return sorted(perms)


def has_permission(context: TenantContext, permission: str) -> bool:
    role = normalize_org_role(getattr(context, "role", None))
    perms = set(permissions_for(role, platform_admin=is_platform_admin(getattr(context, "user", None))))
    return permission in perms


def require_permission(permission: str):
    def dependency(context: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if not has_permission(context, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )
        return context
    return dependency


def can_assign_role(actor_role: str | None, target_role: str | None) -> bool:
    """Least-privilege invitation / role-change rule: never assign OWNER,
    never assign a role at or above the actor's own rank."""
    actor = normalize_org_role(actor_role)
    target = normalize_org_role(target_role)
    if actor is None or target is None:
        return False
    if target not in INVITABLE_ROLES:
        return False
    return ROLE_RANK.get(target, 99) < ROLE_RANK.get(actor, 0)


def lookup_active_membership(
    db: Session,
    user_id: str,
    organization_id: Optional[str] = None,
) -> OrganizationMembership | None:
    query = db.query(OrganizationMembership).filter(
        OrganizationMembership.user_id == user_id,
        OrganizationMembership.status == "ACTIVE",
    )
    if organization_id:
        query = query.filter(OrganizationMembership.organization_id == organization_id)
    return query.first()


def build_access_profile(
    db: Session,
    user: User,
    organization_id: Optional[str] = None,
) -> dict:
    membership = lookup_active_membership(db, user.id, organization_id)
    org_role = normalize_org_role(membership.role) if membership else None
    platform_admin = is_platform_admin(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "account_status": account_status_of(user),
        "is_global_admin": platform_admin,
        "org_id": membership.organization_id if membership else None,
        "org_role": org_role,
        "permissions": permissions_for(org_role, platform_admin=platform_admin),
        "email_verified": bool(getattr(user, "email_verified_at", None)),
    }


def redact_member_email(email: str | None, *, reveal_pii: bool) -> str | None:
    if reveal_pii:
        return email
    return None
