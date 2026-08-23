"""add peer review workflow and external portal tables

Revision ID: e8a2b3c4d5f6
Revises: d7f1b2c3e4a5
Create Date: 2026-08-22 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a2b3c4d5f6'
down_revision: Union[str, Sequence[str], None] = 'd7f1b2c3e4a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = set(inspector.get_table_names())

    # 1. Create review_rubrics
    if 'review_rubrics' not in existing_tables:
        op.create_table(
            'review_rubrics',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name_ar', sa.String(), nullable=False),
            sa.Column('name_en', sa.String(), nullable=False),
            sa.Column('rubric_type', sa.String(), server_default='GENERAL_MANUSCRIPT', nullable=False),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.Column('is_default', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('status', sa.String(), server_default='ACTIVE', nullable=False),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_review_rubrics_id', 'review_rubrics', ['id'])
        op.create_index('ix_review_rubrics_organization_id', 'review_rubrics', ['organization_id'])

    # 2. Create review_criteria
    if 'review_criteria' not in existing_tables:
        op.create_table(
            'review_criteria',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('rubric_id', sa.String(), sa.ForeignKey('review_rubrics.id', ondelete='CASCADE'), nullable=False),
            sa.Column('code', sa.String(), nullable=False),
            sa.Column('title_ar', sa.String(), nullable=False),
            sa.Column('title_en', sa.String(), nullable=False),
            sa.Column('desc_ar', sa.String(), nullable=True),
            sa.Column('desc_en', sa.String(), nullable=True),
            sa.Column('response_type', sa.String(), server_default='SCORE', nullable=False),
            sa.Column('weight', sa.Float(), server_default='1.0', nullable=False),
            sa.Column('is_mandatory', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('sort_order', sa.Integer(), server_default='1', nullable=False),
            sa.Column('options_json', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_review_criteria_id', 'review_criteria', ['id'])
        op.create_index('ix_review_criteria_rubric_id', 'review_criteria', ['rubric_id'])

    # 3. Create peer_review_cases
    if 'peer_review_cases' not in existing_tables:
        op.create_table(
            'peer_review_cases',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('organization_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('owner_user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('project_id', sa.String(), sa.ForeignKey('research_projects.id', ondelete='SET NULL'), nullable=True),
            sa.Column('scholarly_asset_id', sa.String(), sa.ForeignKey('core_scholarly_assets.id', ondelete='SET NULL'), nullable=True),
            sa.Column('title_ar', sa.String(), nullable=False),
            sa.Column('title_en', sa.String(), nullable=False),
            sa.Column('abstract_ar', sa.String(), nullable=True),
            sa.Column('abstract_en', sa.String(), nullable=True),
            sa.Column('discipline', sa.String(), nullable=True),
            sa.Column('case_type', sa.String(), server_default='MANUSCRIPT', nullable=False),
            sa.Column('blind_type', sa.String(), server_default='DOUBLE_BLIND', nullable=False),
            sa.Column('status', sa.String(), server_default='DRAFT', nullable=False),
            sa.Column('current_round_number', sa.Integer(), server_default='1', nullable=False),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
        )
        op.create_index('ix_peer_review_cases_id', 'peer_review_cases', ['id'])
        op.create_index('ix_peer_review_cases_organization_id', 'peer_review_cases', ['organization_id'])
        op.create_index('ix_peer_review_cases_owner_user_id', 'peer_review_cases', ['owner_user_id'])
        op.create_index('ix_peer_review_cases_project_id', 'peer_review_cases', ['project_id'])
        op.create_index('ix_peer_review_cases_scholarly_asset_id', 'peer_review_cases', ['scholarly_asset_id'])

    # 4. Create peer_review_rounds
    if 'peer_review_rounds' not in existing_tables:
        op.create_table(
            'peer_review_rounds',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('case_id', sa.String(), sa.ForeignKey('peer_review_cases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('round_number', sa.Integer(), nullable=False),
            sa.Column('manuscript_version', sa.Integer(), server_default='1', nullable=False),
            sa.Column('status', sa.String(), server_default='ACTIVE', nullable=False),
            sa.Column('manuscript_snapshot_json', sa.JSON(), nullable=True),
            sa.Column('rubric_id', sa.String(), sa.ForeignKey('review_rubrics.id', ondelete='SET NULL'), nullable=True),
            sa.Column('rubric_snapshot_json', sa.JSON(), nullable=True),
            sa.Column('decision', sa.String(), server_default='PENDING', nullable=False),
            sa.Column('decision_notes', sa.String(), nullable=True),
            sa.Column('decision_by_user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('decision_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_peer_review_rounds_id', 'peer_review_rounds', ['id'])
        op.create_index('ix_peer_review_rounds_case_id', 'peer_review_rounds', ['case_id'])

    # 5. Create reviewer_assignments
    if 'reviewer_assignments' not in existing_tables:
        op.create_table(
            'reviewer_assignments',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('case_id', sa.String(), sa.ForeignKey('peer_review_cases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('round_id', sa.String(), sa.ForeignKey('peer_review_rounds.id', ondelete='CASCADE'), nullable=False),
            sa.Column('reviewer_type', sa.String(), server_default='INTERNAL_REVIEWER', nullable=False),
            sa.Column('reviewer_user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('external_email', sa.String(), nullable=True),
            sa.Column('external_name', sa.String(), nullable=True),
            sa.Column('status', sa.String(), server_default='INVITED', nullable=False),
            sa.Column('conflict_status', sa.String(), server_default='NO_CONFLICT', nullable=False),
            sa.Column('conflict_notes', sa.String(), nullable=True),
            sa.Column('decline_reason', sa.String(), nullable=True),
            sa.Column('due_at', sa.String(), nullable=True),
            sa.Column('invited_at', sa.String(), nullable=False),
            sa.Column('accepted_at', sa.String(), nullable=True),
            sa.Column('submitted_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_reviewer_assignments_id', 'reviewer_assignments', ['id'])
        op.create_index('ix_reviewer_assignments_case_id', 'reviewer_assignments', ['case_id'])
        op.create_index('ix_reviewer_assignments_round_id', 'reviewer_assignments', ['round_id'])
        op.create_index('ix_reviewer_assignments_reviewer_user_id', 'reviewer_assignments', ['reviewer_user_id'])
        op.create_index('ix_reviewer_assignments_external_email', 'reviewer_assignments', ['external_email'])

    # 6. Create external_reviewer_tokens
    if 'external_reviewer_tokens' not in existing_tables:
        op.create_table(
            'external_reviewer_tokens',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('assignment_id', sa.String(), sa.ForeignKey('reviewer_assignments.id', ondelete='CASCADE'), nullable=False),
            sa.Column('token_hash', sa.String(), nullable=False),
            sa.Column('expires_at', sa.String(), nullable=False),
            sa.Column('used_at', sa.String(), nullable=True),
            sa.Column('revoked_at', sa.String(), nullable=True),
            sa.Column('revoked_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_external_reviewer_tokens_id', 'external_reviewer_tokens', ['id'])
        op.create_index('ix_external_reviewer_tokens_assignment_id', 'external_reviewer_tokens', ['assignment_id'])
        op.create_index('ix_external_reviewer_tokens_token_hash', 'external_reviewer_tokens', ['token_hash'])

    # 7. Create review_submissions
    if 'review_submissions' not in existing_tables:
        op.create_table(
            'review_submissions',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('assignment_id', sa.String(), sa.ForeignKey('reviewer_assignments.id', ondelete='CASCADE'), unique=True, nullable=False),
            sa.Column('round_id', sa.String(), sa.ForeignKey('peer_review_rounds.id', ondelete='CASCADE'), nullable=False),
            sa.Column('case_id', sa.String(), sa.ForeignKey('peer_review_cases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('status', sa.String(), server_default='DRAFT', nullable=False),
            sa.Column('recommendation', sa.String(), server_default='MINOR_REVISION', nullable=False),
            sa.Column('summary_evaluation_ar', sa.String(), nullable=True),
            sa.Column('summary_evaluation_en', sa.String(), nullable=True),
            sa.Column('total_weighted_score', sa.Float(), server_default='0.0', nullable=False),
            sa.Column('is_confidential_to_editor', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('submitted_at', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
            sa.Column('updated_at', sa.String(), nullable=False),
        )
        op.create_index('ix_review_submissions_id', 'review_submissions', ['id'])
        op.create_index('ix_review_submissions_assignment_id', 'review_submissions', ['assignment_id'])
        op.create_index('ix_review_submissions_round_id', 'review_submissions', ['round_id'])
        op.create_index('ix_review_submissions_case_id', 'review_submissions', ['case_id'])

    # 8. Create review_criterion_responses
    if 'review_criterion_responses' not in existing_tables:
        op.create_table(
            'review_criterion_responses',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('submission_id', sa.String(), sa.ForeignKey('review_submissions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('criterion_id', sa.String(), sa.ForeignKey('review_criteria.id', ondelete='CASCADE'), nullable=False),
            sa.Column('score_value', sa.Float(), nullable=True),
            sa.Column('text_value', sa.String(), nullable=True),
            sa.Column('choice_value', sa.String(), nullable=True),
            sa.Column('comments', sa.String(), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_review_criterion_responses_id', 'review_criterion_responses', ['id'])
        op.create_index('ix_review_criterion_responses_submission_id', 'review_criterion_responses', ['submission_id'])
        op.create_index('ix_review_criterion_responses_criterion_id', 'review_criterion_responses', ['criterion_id'])

    # 9. Create review_comments
    if 'review_comments' not in existing_tables:
        op.create_table(
            'review_comments',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('submission_id', sa.String(), sa.ForeignKey('review_submissions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('case_id', sa.String(), sa.ForeignKey('peer_review_cases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('round_id', sa.String(), sa.ForeignKey('peer_review_rounds.id', ondelete='CASCADE'), nullable=False),
            sa.Column('section_key', sa.String(), nullable=True),
            sa.Column('comment_type', sa.String(), server_default='AUTHOR_VISIBLE', nullable=False),
            sa.Column('comment_text', sa.String(), nullable=False),
            sa.Column('author_response_text', sa.String(), nullable=True),
            sa.Column('is_resolved', sa.Boolean(), server_default='0', nullable=False),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_review_comments_id', 'review_comments', ['id'])
        op.create_index('ix_review_comments_submission_id', 'review_comments', ['submission_id'])
        op.create_index('ix_review_comments_case_id', 'review_comments', ['case_id'])
        op.create_index('ix_review_comments_round_id', 'review_comments', ['round_id'])

    # 10. Create manuscript_revisions
    if 'manuscript_revisions' not in existing_tables:
        op.create_table(
            'manuscript_revisions',
            sa.Column('id', sa.String(), primary_key=True),
            sa.Column('case_id', sa.String(), sa.ForeignKey('peer_review_cases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('round_id', sa.String(), sa.ForeignKey('peer_review_rounds.id', ondelete='SET NULL'), nullable=True),
            sa.Column('version_number', sa.Integer(), server_default='1', nullable=False),
            sa.Column('title_ar', sa.String(), nullable=False),
            sa.Column('title_en', sa.String(), nullable=False),
            sa.Column('abstract_ar', sa.String(), nullable=True),
            sa.Column('abstract_en', sa.String(), nullable=True),
            sa.Column('response_to_reviewers', sa.String(), nullable=True),
            sa.Column('file_id', sa.String(), sa.ForeignKey('uploaded_files.id', ondelete='SET NULL'), nullable=True),
            sa.Column('uploaded_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.String(), nullable=False),
        )
        op.create_index('ix_manuscript_revisions_id', 'manuscript_revisions', ['id'])
        op.create_index('ix_manuscript_revisions_case_id', 'manuscript_revisions', ['case_id'])
        op.create_index('ix_manuscript_revisions_round_id', 'manuscript_revisions', ['round_id'])


def downgrade() -> None:
    op.drop_table('manuscript_revisions')
    op.drop_table('review_comments')
    op.drop_table('review_criterion_responses')
    op.drop_table('review_submissions')
    op.drop_table('external_reviewer_tokens')
    op.drop_table('reviewer_assignments')
    op.drop_table('peer_review_rounds')
    op.drop_table('peer_review_cases')
    op.drop_table('review_criteria')
    op.drop_table('review_rubrics')
