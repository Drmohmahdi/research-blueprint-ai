"""Initial schema setup

Revision ID: 3b3feb1c258e
Revises:
Create Date: 2026-07-18 08:50:24.707956

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3b3feb1c258e"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("userId", sa.String(), nullable=False),
        sa.Column("expiresAt", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("userId", sa.String(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("details", sa.String(), nullable=True),
        sa.Column("timestamp", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)

    op.create_table(
        "research_projects",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("userId", sa.String(), nullable=True),
        sa.Column("titleAr", sa.String(), nullable=False),
        sa.Column("titleEn", sa.String(), nullable=False),
        sa.Column("departmentAr", sa.String(), nullable=True),
        sa.Column("departmentEn", sa.String(), nullable=True),
        sa.Column("institutionAr", sa.String(), nullable=True),
        sa.Column("institutionEn", sa.String(), nullable=True),
        sa.Column("descriptionAr", sa.String(), nullable=True),
        sa.Column("descriptionEn", sa.String(), nullable=True),
        sa.Column("problemStatementAr", sa.String(), nullable=True),
        sa.Column("problemStatementEn", sa.String(), nullable=True),
        sa.Column("studyDesign", sa.String(), nullable=True),
        sa.Column("sampleSettings", sa.JSON(), nullable=False),
        sa.Column("preRegistrationHash", sa.String(), nullable=True),
        sa.Column("preRegistrationLockedAt", sa.String(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_research_projects_id"), "research_projects", ["id"], unique=False)

    op.create_table(
        "research_variables",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("projectId", sa.String(), nullable=False),
        sa.Column("nameAr", sa.String(), nullable=False),
        sa.Column("nameEn", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("scale", sa.String(), nullable=False),
        sa.Column("maxValue", sa.Float(), nullable=True),
        sa.Column("minValue", sa.Float(), nullable=True),
        sa.Column("descriptionAr", sa.String(), nullable=True),
        sa.Column("descriptionEn", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["projectId"], ["research_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_research_variables_id"), "research_variables", ["id"], unique=False)

    op.create_table(
        "research_questions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("projectId", sa.String(), nullable=False),
        sa.Column("textAr", sa.String(), nullable=False),
        sa.Column("textEn", sa.String(), nullable=False),
        sa.Column("associatedVariables", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["projectId"], ["research_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_research_questions_id"), "research_questions", ["id"], unique=False)

    op.create_table(
        "hypotheses",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("projectId", sa.String(), nullable=False),
        sa.Column("questionId", sa.String(), nullable=True),
        sa.Column("textAr", sa.String(), nullable=False),
        sa.Column("textEn", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("independentVarId", sa.String(), nullable=True),
        sa.Column("dependentVarId", sa.String(), nullable=True),
        sa.Column("mediatorVarId", sa.String(), nullable=True),
        sa.Column("moderatorVarId", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["projectId"], ["research_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_hypotheses_id"), "hypotheses", ["id"], unique=False)

    op.create_table(
        "simulation_jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("userId", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("sampleSize", sa.Integer(), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["userId"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_simulation_jobs_id"), "simulation_jobs", ["id"], unique=False)

    op.create_table(
        "project_comments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("projectId", sa.String(), nullable=False),
        sa.Column("authorId", sa.String(), nullable=True),
        sa.Column("authorUsername", sa.String(), nullable=True),
        sa.Column("fieldKey", sa.String(), nullable=True),
        sa.Column("step", sa.String(), nullable=True),
        sa.Column("contentAr", sa.String(), nullable=False),
        sa.Column("contentEn", sa.String(), nullable=True),
        sa.Column("resolved", sa.Boolean(), nullable=True),
        sa.Column("priority", sa.String(), nullable=True),
        sa.Column("createdAt", sa.String(), nullable=False),
        sa.Column("resolvedAt", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["authorId"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["projectId"], ["research_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_comments_id"), "project_comments", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_comments_id"), table_name="project_comments")
    op.drop_table("project_comments")
    op.drop_index(op.f("ix_simulation_jobs_id"), table_name="simulation_jobs")
    op.drop_table("simulation_jobs")
    op.drop_index(op.f("ix_hypotheses_id"), table_name="hypotheses")
    op.drop_table("hypotheses")
    op.drop_index(op.f("ix_research_questions_id"), table_name="research_questions")
    op.drop_table("research_questions")
    op.drop_index(op.f("ix_research_variables_id"), table_name="research_variables")
    op.drop_table("research_variables")
    op.drop_index(op.f("ix_research_projects_id"), table_name="research_projects")
    op.drop_table("research_projects")
    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_table("user_sessions")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
