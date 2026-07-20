"""add_shared_academic_foundation

Revision ID: 8322d39fc0aa
Revises: 8096fddda85f
Create Date: 2026-07-20 10:26:25.555873

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8322d39fc0aa'
down_revision: Union[str, Sequence[str], None] = '8096fddda85f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


"""add_shared_academic_foundation

Revision ID: 8322d39fc0aa
Revises: 8096fddda85f
Create Date: 2026-07-20 10:26:25.555873

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
import datetime
import json

# revision identifiers, used by Alembic.
revision: str = '8322d39fc0aa'
down_revision: Union[str, Sequence[str], None] = '8096fddda85f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    # 1. Add parent_id and hierarchy_level columns to organizations table
    org_columns = [col['name'] for col in sa.inspect(connection).get_columns('organizations')]
    if 'parent_id' not in org_columns:
        op.add_column('organizations', sa.Column('parent_id', sa.String(), nullable=True))
    if 'hierarchy_level' not in org_columns:
        op.add_column('organizations', sa.Column('hierarchy_level', sa.Integer(), nullable=True, server_default='0'))



    # 2. Create the UnifiedAcademicProfile table
    op.create_table(
        'core_unified_academic_profiles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=True),
        sa.Column('preferred_name_ar', sa.String(), nullable=True),
        sa.Column('preferred_name_en', sa.String(), nullable=True),
        sa.Column('name_variants_json', sa.JSON(), nullable=True),
        sa.Column('academic_title', sa.String(), nullable=True),
        sa.Column('current_rank', sa.String(), nullable=True),
        sa.Column('target_rank', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('university', sa.String(), nullable=True),
        sa.Column('college', sa.String(), nullable=True),
        sa.Column('department', sa.String(), nullable=True),
        sa.Column('general_specialization', sa.String(), nullable=True),
        sa.Column('specific_specialization', sa.String(), nullable=True),
        sa.Column('discipline', sa.String(), nullable=True),
        sa.Column('research_interests_json', sa.JSON(), nullable=True),

        sa.Column('keywords_ar_json', sa.JSON(), nullable=True),
        sa.Column('keywords_en_json', sa.JSON(), nullable=True),
        sa.Column('institutional_email', sa.String(), nullable=True),
        sa.Column('public_email', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('short_bio_ar', sa.String(), nullable=True),
        sa.Column('short_bio_en', sa.String(), nullable=True),
        sa.Column('full_bio_ar', sa.String(), nullable=True),
        sa.Column('full_bio_en', sa.String(), nullable=True),
        sa.Column('profile_photo_file_id', sa.String(), nullable=True),
        sa.Column('visibility_status', sa.String(), nullable=False, server_default='PUBLIC'),
        sa.Column('completeness_score', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['profile_photo_file_id'], ['uploaded_files.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    with op.batch_alter_table('core_unified_academic_profiles', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_unified_academic_profiles_id'), ['id'], unique=False)

    # 3. Create the AcademicIdentifier table
    op.create_table(
        'core_academic_identifiers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('profile_id', sa.String(), nullable=False),
        sa.Column('identifier_type', sa.String(), nullable=False),
        sa.Column('identifier_value', sa.String(), nullable=False),
        sa.Column('profile_url', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='UNVERIFIED'),
        sa.Column('verification_method', sa.String(), nullable=True),
        sa.Column('verified_at', sa.String(), nullable=True),
        sa.Column('last_checked_at', sa.String(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['profile_id'], ['core_unified_academic_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('core_academic_identifiers', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_academic_identifiers_id'), ['id'], unique=False)

    # 4. Create the AcademicAffiliation table
    op.create_table(
        'core_academic_affiliations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('profile_id', sa.String(), nullable=False),
        sa.Column('organization_name', sa.String(), nullable=False),
        sa.Column('university_id', sa.String(), nullable=True),
        sa.Column('college', sa.String(), nullable=True),
        sa.Column('department', sa.String(), nullable=True),
        sa.Column('position_title', sa.String(), nullable=True),
        sa.Column('academic_rank', sa.String(), nullable=True),
        sa.Column('start_date', sa.String(), nullable=True),
        sa.Column('end_date', sa.String(), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('evidence_file_id', sa.String(), nullable=True),
        sa.Column('verification_status', sa.String(), nullable=False, server_default='UNVERIFIED'),
        sa.ForeignKeyConstraint(['evidence_file_id'], ['uploaded_files.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['profile_id'], ['core_unified_academic_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['university_id'], ['organizations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('core_academic_affiliations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_academic_affiliations_id'), ['id'], unique=False)

    # 5. Create ScholarlyAsset table
    op.create_table(
        'core_scholarly_assets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=True),
        sa.Column('owner_user_id', sa.String(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('title_ar', sa.String(), nullable=True),
        sa.Column('title_en', sa.String(), nullable=True),
        sa.Column('abstract_ar', sa.TEXT(), nullable=True),
        sa.Column('abstract_en', sa.TEXT(), nullable=True),
        sa.Column('asset_type', sa.String(), nullable=False),
        sa.Column('lifecycle_status', sa.String(), nullable=False, server_default='DRAFT'),
        sa.Column('primary_discipline', sa.String(), nullable=True),
        sa.Column('secondary_disciplines_json', sa.JSON(), nullable=True),
        sa.Column('keywords_json', sa.JSON(), nullable=True),
        sa.Column('doi', sa.String(), nullable=True),
        sa.Column('issn', sa.String(), nullable=True),
        sa.Column('isbn', sa.String(), nullable=True),
        sa.Column('journal_name', sa.String(), nullable=True),
        sa.Column('publisher', sa.String(), nullable=True),
        sa.Column('publication_date', sa.String(), nullable=True),
        sa.Column('acceptance_date', sa.String(), nullable=True),
        sa.Column('conference_name', sa.String(), nullable=True),
        sa.Column('language', sa.String(), nullable=False, server_default='ar'),
        sa.Column('visibility', sa.String(), nullable=False, server_default='PUBLIC'),
        sa.Column('source_module', sa.String(), nullable=True),
        sa.Column('source_record_id', sa.String(), nullable=True),
        sa.Column('parent_asset_id', sa.String(), nullable=True),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.Column('deleted_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_asset_id'], ['core_scholarly_assets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('core_scholarly_assets', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_scholarly_assets_id'), ['id'], unique=False)

    # 6. Create ScholarlyAssetContributor table
    op.create_table(
        'core_scholarly_asset_contributors',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('asset_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('external_name', sa.String(), nullable=True),
        sa.Column('orcid', sa.String(), nullable=True),
        sa.Column('author_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_corresponding_author', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('contribution_roles_json', sa.JSON(), nullable=True),
        sa.Column('affiliation_text', sa.String(), nullable=True),
        sa.Column('contribution_percentage', sa.Float(), nullable=True),
        sa.Column('verified_status', sa.String(), nullable=False, server_default='UNVERIFIED'),
        sa.ForeignKeyConstraint(['asset_id'], ['core_scholarly_assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('core_scholarly_asset_contributors', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_scholarly_asset_contributors_id'), ['id'], unique=False)

    # 7. Create ScholarlyAssetFile table
    op.create_table(
        'core_scholarly_asset_files',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('asset_id', sa.String(), nullable=False),
        sa.Column('file_id', sa.String(), nullable=False),
        sa.Column('file_role', sa.String(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('uploaded_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['asset_id'], ['core_scholarly_assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['file_id'], ['uploaded_files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('core_scholarly_asset_files', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_scholarly_asset_files_id'), ['id'], unique=False)

    # 8. Create PromotionAssetSelection table
    op.create_table(
        'core_promotion_asset_selections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('promotion_application_id', sa.String(), nullable=False),
        sa.Column('scholarly_asset_id', sa.String(), nullable=False),
        sa.Column('eligibility_status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('rule_set_id', sa.String(), nullable=True),
        sa.Column('calculated_points', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('evidence_status', sa.String(), nullable=False, server_default='PENDING'),
        sa.Column('notes', sa.TEXT(), nullable=True),
        sa.ForeignKeyConstraint(['scholarly_asset_id'], ['core_scholarly_assets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('core_promotion_asset_selections', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_promotion_asset_selections_id'), ['id'], unique=False)

    # 9. Create DataProvenance table
    op.create_table(
        'core_data_provenances',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('organization_id', sa.String(), nullable=True),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column('source_type', sa.String(), nullable=False),
        sa.Column('source_module', sa.String(), nullable=True),
        sa.Column('source_url', sa.TEXT(), nullable=True),
        sa.Column('imported_file_id', sa.String(), nullable=True),
        sa.Column('imported_by', sa.String(), nullable=True),
        sa.Column('imported_at', sa.String(), nullable=False),
        sa.Column('confidence_level', sa.String(), nullable=False, server_default='HIGH'),
        sa.Column('verification_status', sa.String(), nullable=False, server_default='UNVERIFIED'),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['imported_file_id'], ['uploaded_files.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['imported_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('core_data_provenances', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_core_data_provenances_id'), ['id'], unique=False)

    # 10. Add scholarly_asset_id column to research_projects table
    proj_columns = [col['name'] for col in sa.inspect(connection).get_columns('research_projects')]
    if 'scholarly_asset_id' not in proj_columns:
        op.add_column('research_projects', sa.Column('scholarly_asset_id', sa.String(), nullable=True))



    # 11. Run DATA BACKFILL & MIGRATION
    now = datetime.datetime.utcnow().isoformat()
    connection = op.get_bind()

    # Get all users to create default UnifiedAcademicProfile
    users = connection.execute(sa.text("SELECT id, username, email, created_at FROM users")).fetchall()
    
    # Store old profiles for migration
    old_profiles = {}
    if sa.inspect(connection).has_table('core_academic_identity_profiles'):
        old_profiles_raw = connection.execute(sa.text(
            'SELECT id, "userId", "preferredNameAr", "preferredNameEn", "nameVariants", discipline, "researchInterests", keywords, "shortBio", "fullBio", "createdAt" FROM core_academic_identity_profiles'
        )).fetchall()
        for op_row in old_profiles_raw:
            old_profiles[op_row[1]] = op_row

    for user in users:
        u_id = user[0]
        u_email = user[2]
        u_created = user[3] or now
        
        # Check if already exists in unified profile
        exist = connection.execute(sa.text(f"SELECT id FROM core_unified_academic_profiles WHERE user_id = '{u_id}'")).fetchone()
        if exist:
            continue

        p_id = str(uuid.uuid4())
        pref_ar = ""
        pref_en = ""
        variants = []
        disc = ""
        interests = []
        keywords = []
        short_bio = ""
        full_bio = ""
        
        if u_id in old_profiles:
            op_row = old_profiles[u_id]
            pref_ar = op_row[2] or ""
            pref_en = op_row[3] or ""
            if op_row[4]:
                variants = [v.strip() for v in op_row[4].split(";") if v.strip()]
            disc = op_row[5] or ""
            if op_row[6]:
                interests = [v.strip() for v in op_row[6].split(",") if v.strip()]
            if op_row[7]:
                keywords = [v.strip() for v in op_row[7].split(",") if v.strip()]
            short_bio = op_row[8] or ""
            full_bio = op_row[9] or ""

        # Calculate initial score
        comp_score = 0
        if pref_ar or pref_en:
            comp_score += 20
        if u_email:
            comp_score += 10
        if disc:
            comp_score += 10
        if short_bio:
            comp_score += 15
        if full_bio:
            comp_score += 15

        connection.execute(sa.text(
            "INSERT INTO core_unified_academic_profiles (id, user_id, preferred_name_ar, preferred_name_en, name_variants_json, discipline, research_interests_json, keywords_ar_json, keywords_en_json, institutional_email, short_bio_ar, short_bio_en, full_bio_ar, full_bio_en, visibility_status, completeness_score, created_at) "
            "VALUES (:id, :user_id, :pref_ar, :pref_en, :variants, :disc, :interests, :keywords, :keywords, :email, :short, :short, :full, :full, 'PUBLIC', :score, :created)"
        ), {
            "id": p_id,
            "user_id": u_id,
            "pref_ar": pref_ar,
            "pref_en": pref_en,
            "variants": json.dumps(variants),
            "disc": disc,
            "interests": json.dumps(interests),
            "keywords": json.dumps(keywords),
            "email": u_email,
            "short": short_bio,
            "full": full_bio,
            "score": comp_score,
            "created": u_created
        })

        # Copy old channels/identifiers if present
        if u_id in old_profiles:
            old_p_id = old_profiles[u_id][0]
            try:
                channels = connection.execute(sa.text(f"SELECT channelName, profileUrl, externalId, status, completenessScore FROM core_academic_channels WHERE profileId = '{old_p_id}'")).fetchall()
                for ch in channels:
                    connection.execute(sa.text(
                        "INSERT INTO core_academic_identifiers (id, profile_id, identifier_type, identifier_value, profile_url, status, verification_method, last_checked_at, metadata_json) "
                        "VALUES (:id, :profile_id, :type, :value, :url, :status, 'MOCK', :last, :meta)"
                    ), {
                        "id": str(uuid.uuid4()),
                        "profile_id": p_id,
                        "type": ch[0],
                        "value": ch[2] or "",
                        "url": ch[1] or "",
                        "status": "VERIFIED" if ch[3] == "active" else "UNVERIFIED",
                        "last": now,
                        "meta": json.dumps({"completeness": ch[4]})
                    })
            except Exception:
                pass

    # Seeding ScholarlyAsset for every existing ResearchProject
    projects = connection.execute(sa.text(
        'SELECT id, "userId", "organizationId", "titleAr", "titleEn", "descriptionAr", "descriptionEn" FROM research_projects'
    )).fetchall()
    for proj in projects:
        proj_id = proj[0]
        u_id = proj[1]
        org_id = proj[2]
        t_ar = proj[3]
        t_en = proj[4]
        desc_ar = proj[5]
        desc_en = proj[6]
        
        # Check if ScholarlyAsset already exists for this project
        exist_asset = connection.execute(sa.text(f"SELECT id FROM core_scholarly_assets WHERE source_record_id = '{proj_id}' AND source_module = 'RESEARCH'")).fetchone()
        if exist_asset:
            # Set foreign key
            connection.execute(sa.text(f"UPDATE research_projects SET scholarly_asset_id = '{exist_asset[0]}' WHERE id = '{proj_id}'"))
            continue

        asset_id = str(uuid.uuid4())
        connection.execute(sa.text(
            "INSERT INTO core_scholarly_assets (id, organization_id, owner_user_id, created_by, title_ar, title_en, abstract_ar, abstract_en, asset_type, lifecycle_status, source_module, source_record_id, version_number, language, visibility, created_at) "
            "VALUES (:id, :org, :owner, :owner, :title_ar, :title_en, :abs_ar, :abs_en, 'RESEARCH_PROJECT', 'IN_RESEARCH', 'RESEARCH', :source_id, 1, 'ar', 'PUBLIC', :created)"
        ), {
            "id": asset_id,
            "org": org_id,
            "owner": u_id,
            "title_ar": t_ar,
            "title_en": t_en,
            "abs_ar": desc_ar,
            "abs_en": desc_en,
            "source_id": proj_id,
            "created": now
        })
        
        # Update research_projects table link
        connection.execute(sa.text(f"UPDATE research_projects SET scholarly_asset_id = '{asset_id}' WHERE id = '{proj_id}'"))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove link in research_projects
    with op.batch_alter_table('research_projects', schema=None) as batch_op:
        batch_op.drop_column('scholarly_asset_id')

    # Drop tables
    op.drop_table('core_data_provenances')
    op.drop_table('core_promotion_asset_selections')
    op.drop_table('core_scholarly_asset_files')
    op.drop_table('core_scholarly_asset_contributors')
    op.drop_table('core_scholarly_assets')
    op.drop_table('core_academic_affiliations')
    op.drop_table('core_academic_identifiers')
    op.drop_table('core_unified_academic_profiles')

    # Remove columns from organizations
    with op.batch_alter_table('organizations', schema=None) as batch_op:
        batch_op.drop_column('hierarchy_level')
        batch_op.drop_column('parent_id')

