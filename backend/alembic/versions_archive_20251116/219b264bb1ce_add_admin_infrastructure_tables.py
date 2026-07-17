"""add_admin_infrastructure_tables

Revision ID: 219b264bb1ce
Revises: add_admin_infra_001
Create Date: 2025-10-15 20:17:48.874200
"""

from __future__ import annotations

from typing import Any

from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '219b264bb1ce'
down_revision: str | None = 'add_admin_infra_001'
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | str | None = None


def upgrade() -> None:
    """Apply schema (and optional data) upgrades."""
    schema_upgrade()
    if _should_run_data_migrations():
        data_upgrade()


def schema_upgrade() -> None:
    """Schema migrations for Phase 1: Admin Infrastructure."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    
    # 1. insights_reports table - Store IA weekly/monthly reports
    if 'insights_reports' not in existing_tables:
        op.create_table(
            'insights_reports',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('report_type', sa.String(50), nullable=False),  # 'weekly', 'monthly', 'ad_hoc'
            sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
            sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
            sa.Column('summary', sa.Text(), nullable=True),  # Human-readable summary
            sa.Column('trending_topics', sa.JSON(), nullable=True),  # Top topics with counts
            sa.Column('sentiment_data', sa.JSON(), nullable=True),  # Sentiment metrics
            sa.Column('high_risk_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('assessment_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('generated_by', sa.String(100), nullable=False, server_default='ia_agent'),
            sa.PrimaryKeyConstraint('id')
        )
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('insights_reports')} if 'insights_reports' in existing_tables else set()
        if 'ix_insights_reports_report_type' not in existing_indexes:
            op.create_index('ix_insights_reports_report_type', 'insights_reports', ['report_type'])
        if 'ix_insights_reports_generated_at' not in existing_indexes:
            op.create_index('ix_insights_reports_generated_at', 'insights_reports', ['generated_at'])
    
    # 2. campaigns table - Campaign management
    if 'campaigns' not in existing_tables:
        op.create_table(
            'campaigns',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('name', sa.String(200), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('trigger_rules', sa.JSON(), nullable=True),  # Condition definitions
            sa.Column('message_template', sa.Text(), nullable=False),
            sa.Column('target_audience', sa.JSON(), nullable=True),  # Segmentation rules
            sa.Column('status', sa.String(20), nullable=False, server_default='draft'),  # 'draft', 'active', 'paused', 'completed'
            sa.Column('priority', sa.String(20), nullable=False, server_default='medium'),  # 'low', 'medium', 'high'
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('last_executed_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('campaigns')} if 'campaigns' in existing_tables else set()
        if 'ix_campaigns_status' not in existing_indexes:
            op.create_index('ix_campaigns_status', 'campaigns', ['status'])
        if 'ix_campaigns_created_at' not in existing_indexes:
            op.create_index('ix_campaigns_created_at', 'campaigns', ['created_at'])
    
    # 3. campaign_triggers table - Campaign trigger conditions
    if 'campaign_triggers' not in existing_tables:
        op.create_table(
            'campaign_triggers',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('campaign_id', sa.UUID(), sa.ForeignKey('campaigns.id', ondelete='CASCADE'), nullable=False),
            sa.Column('condition_type', sa.String(100), nullable=False),  # 'ia_insight', 'manual', 'scheduled'
            sa.Column('condition_value', sa.JSON(), nullable=True),  # Specific conditions
            sa.Column('evaluation_frequency', sa.String(20), nullable=False, server_default='daily'),  # 'daily', 'weekly'
            sa.Column('last_evaluated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_match_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('match_count', sa.Integer(), nullable=False, server_default='0'),
            sa.PrimaryKeyConstraint('id')
        )
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('campaign_triggers')} if 'campaign_triggers' in existing_tables else set()
        if 'ix_campaign_triggers_campaign_id' not in existing_indexes:
            op.create_index('ix_campaign_triggers_campaign_id', 'campaign_triggers', ['campaign_id'])
    
    # 4. campaign_metrics table - Campaign performance tracking
    if 'campaign_metrics' not in existing_tables:
        op.create_table(
            'campaign_metrics',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('campaign_id', sa.UUID(), sa.ForeignKey('campaigns.id', ondelete='CASCADE'), nullable=False),
            sa.Column('execution_date', sa.Date(), nullable=False),
            sa.Column('messages_sent', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('users_targeted', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('users_engaged', sa.Integer(), nullable=False, server_default='0'),  # Replied to message
            sa.Column('success_rate', sa.Float(), nullable=True),
            sa.Column('avg_sentiment_before', sa.Float(), nullable=True),
            sa.Column('avg_sentiment_after', sa.Float(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('campaign_metrics')} if 'campaign_metrics' in existing_tables else set()
        if 'ix_campaign_metrics_campaign_id' not in existing_indexes:
            op.create_index('ix_campaign_metrics_campaign_id', 'campaign_metrics', ['campaign_id'])
        if 'ix_campaign_metrics_execution_date' not in existing_indexes:
            op.create_index('ix_campaign_metrics_execution_date', 'campaign_metrics', ['execution_date'])
    
    # 5. system_settings table - System configuration
    if 'system_settings' not in existing_tables:
        op.create_table(
            'system_settings',
            sa.Column('key', sa.String(200), nullable=False),
            sa.Column('value', sa.JSON(), nullable=False),
            sa.Column('category', sa.String(50), nullable=False),  # 'sta', 'sda', 'sca', 'ia', 'general'
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.PrimaryKeyConstraint('key')
        )
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('system_settings')} if 'system_settings' in existing_tables else set()
        if 'ix_system_settings_category' not in existing_indexes:
            op.create_index('ix_system_settings_category', 'system_settings', ['category'])
    
    # 6. agent_health_logs table - Agent monitoring
    if 'agent_health_logs' not in existing_tables:
        op.create_table(
            'agent_health_logs',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('agent_name', sa.String(50), nullable=False),  # 'sta', 'sda', 'sca', 'ia'
            sa.Column('status', sa.String(20), nullable=False),  # 'healthy', 'degraded', 'down'
            sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('error_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('performance_metrics', sa.JSON(), nullable=True),  # Response times, etc.
            sa.Column('error_details', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.PrimaryKeyConstraint('id')
        )
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('agent_health_logs')} if 'agent_health_logs' in existing_tables else set()
        if 'ix_agent_health_logs_agent_name' not in existing_indexes:
            op.create_index('ix_agent_health_logs_agent_name', 'agent_health_logs', ['agent_name'])
        if 'ix_agent_health_logs_created_at' not in existing_indexes:
            op.create_index('ix_agent_health_logs_created_at', 'agent_health_logs', ['created_at'])
    
    # 7. case_assignments table - Case assignment audit trail
    if 'case_assignments' not in existing_tables:
        op.create_table(
            'case_assignments',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('case_id', sa.UUID(), sa.ForeignKey('cases.id', ondelete='CASCADE'), nullable=False),
            sa.Column('assigned_to', sa.String(255), nullable=False),
            sa.Column('assigned_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
            sa.Column('reassignment_reason', sa.Text(), nullable=True),
            sa.Column('previous_assignee', sa.String(255), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('case_assignments')} if 'case_assignments' in existing_tables else set()
        if 'ix_case_assignments_case_id' not in existing_indexes:
            op.create_index('ix_case_assignments_case_id', 'case_assignments', ['case_id'])
        if 'ix_case_assignments_assigned_at' not in existing_indexes:
            op.create_index('ix_case_assignments_assigned_at', 'case_assignments', ['assigned_at'])
    
    # Add indexes to existing tables for performance (check if tables and indexes exist)
    existing_tables = inspector.get_table_names()  # Refresh after creating tables
    
    if 'cases' in existing_tables:
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('cases')}
        if 'ix_cases_status' not in existing_indexes:
            op.create_index('ix_cases_status', 'cases', ['status'])
        if 'ix_cases_severity' not in existing_indexes:
            op.create_index('ix_cases_severity', 'cases', ['severity'])
        if 'ix_cases_created_at' not in existing_indexes:
            op.create_index('ix_cases_created_at', 'cases', ['created_at'])
    
    if 'triage_assessments' in existing_tables:
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('triage_assessments')}
        if 'ix_triage_assessments_severity_level' not in existing_indexes:
            op.create_index('ix_triage_assessments_severity_level', 'triage_assessments', ['severity_level'])


def downgrade() -> None:
    """Apply schema (and optional data) downgrades."""
    if _should_run_data_migrations():
        data_downgrade()
    schema_downgrade()


def schema_downgrade() -> None:
    """Rollback Phase 1 schema migrations."""
    
    # Drop indexes from existing tables
    op.drop_index('ix_triage_assessments_severity_level', 'triage_assessments')
    op.drop_index('ix_cases_created_at', 'cases')
    op.drop_index('ix_cases_severity', 'cases')
    op.drop_index('ix_cases_status', 'cases')
    
    # Drop tables in reverse order (child tables first due to foreign keys)
    op.drop_index('ix_case_assignments_assigned_at', 'case_assignments')
    op.drop_index('ix_case_assignments_case_id', 'case_assignments')
    op.drop_table('case_assignments')
    
    op.drop_index('ix_agent_health_logs_created_at', 'agent_health_logs')
    op.drop_index('ix_agent_health_logs_agent_name', 'agent_health_logs')
    op.drop_table('agent_health_logs')
    
    op.drop_index('ix_system_settings_category', 'system_settings')
    op.drop_table('system_settings')
    
    op.drop_index('ix_campaign_metrics_execution_date', 'campaign_metrics')
    op.drop_index('ix_campaign_metrics_campaign_id', 'campaign_metrics')
    op.drop_table('campaign_metrics')
    
    op.drop_index('ix_campaign_triggers_campaign_id', 'campaign_triggers')
    op.drop_table('campaign_triggers')
    
    op.drop_index('ix_campaigns_created_at', 'campaigns')
    op.drop_index('ix_campaigns_status', 'campaigns')
    op.drop_table('campaigns')
    
    op.drop_index('ix_insights_reports_generated_at', 'insights_reports')
    op.drop_index('ix_insights_reports_report_type', 'insights_reports')
    op.drop_table('insights_reports')


def data_upgrade() -> None:
    """Idempotent data migrations executed with --x data=true."""
    pass


def data_downgrade() -> None:
    """Rollback for data migrations executed with --x data=true."""
    pass


def _should_run_data_migrations() -> bool:
    """Return True when the revision is invoked with ``--x data=true``."""
    x_args: dict[str, Any] = context.get_x_argument(as_dictionary=True)
    flag = x_args.get("data")
    if isinstance(flag, str):
        return flag.lower() in {"1", "true", "yes", "on"}
    return bool(flag)
