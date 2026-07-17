"""introduce sda+ia schema and events overhaul

Revision ID: 9a5f9ae2bf74
Revises: c613d13854de
Create Date: 2025-09-25 19:40:00

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "9a5f9ae2bf74"
down_revision = "c613d13854df"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    
    # Create enum types if they don't exist
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE agent_name_enum AS ENUM ('STA', 'SCA', 'SDA', 'IA'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    ))
    
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE message_role_enum AS ENUM ('user', 'agent', 'system'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    ))
    
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE consent_scope_enum AS ENUM ('research', 'platform_improvement', 'third_party'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    ))
    
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE case_status_enum AS ENUM ('new', 'open', 'in_progress', 'resolved', 'closed'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    ))
    
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE case_severity_enum AS ENUM ('low', 'medium', 'high', 'critical'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    ))
    
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE agent_role_enum AS ENUM ('STA', 'SCA', 'SDA', 'IA'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    ))
    
    # Create events table
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS events (
            id UUID PRIMARY KEY,
            agent agent_name_enum NOT NULL,
            event_type VARCHAR(100) NOT NULL,
            user_id INTEGER REFERENCES users(id),
            conversation_id INTEGER REFERENCES conversations(id),
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """))
    
    # Create messages table
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY,
            conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id),
            agent agent_name_enum,
            role message_role_enum NOT NULL,
            content TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """))
    
    # Create consents table
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS consents (
            id UUID PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            scope consent_scope_enum NOT NULL,
            granted BOOLEAN NOT NULL DEFAULT FALSE,
            granted_at TIMESTAMP WITH TIME ZONE,
            revoked_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """))
    
    # Create cases table
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS cases (
            id UUID PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status case_status_enum NOT NULL DEFAULT 'new',
            severity case_severity_enum NOT NULL DEFAULT 'medium',
            assigned_to INTEGER REFERENCES users(id),
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            closed_at TIMESTAMP WITH TIME ZONE
        );
    """))
    
    # Create resources table
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS resources (
            id UUID PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            type VARCHAR(100) NOT NULL,
            url VARCHAR(500),
            content TEXT,
            tags JSONB,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """))
    
    # Create agent_users table
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS agent_users (
            id UUID PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            role agent_role_enum NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """))
    
    # Create indexes
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_events_agent ON events(agent);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_events_user_id ON events(user_id);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_events_conversation_id ON events(conversation_id);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_events_created_at ON events(created_at);"))
    
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_messages_conversation_id ON messages(conversation_id);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_messages_user_id ON messages(user_id);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_messages_agent ON messages(agent);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_messages_created_at ON messages(created_at);"))
    
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_consents_user_id ON consents(user_id);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_consents_scope ON consents(scope);"))
    
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_cases_user_id ON cases(user_id);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_cases_status ON cases(status);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_cases_assigned_to ON cases(assigned_to);"))
    
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_resources_type ON resources(type);"))
    
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_agent_users_role ON agent_users(role);"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_agent_users_email ON agent_users(email);"))


def downgrade() -> None:
    bind = op.get_bind()
    
    # Drop indexes
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_agent_users_email;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_agent_users_role;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_resources_type;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_cases_assigned_to;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_cases_status;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_cases_user_id;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_consents_scope;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_consents_user_id;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_messages_created_at;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_messages_agent;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_messages_user_id;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_messages_conversation_id;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_events_created_at;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_events_conversation_id;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_events_user_id;"))
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_events_agent;"))
    
    # Drop tables
    bind.execute(sa.text("DROP TABLE IF EXISTS agent_users;"))
    bind.execute(sa.text("DROP TABLE IF EXISTS resources;"))
    bind.execute(sa.text("DROP TABLE IF EXISTS cases;"))
    bind.execute(sa.text("DROP TABLE IF EXISTS consents;"))
    bind.execute(sa.text("DROP TABLE IF EXISTS messages;"))
    bind.execute(sa.text("DROP TABLE IF EXISTS events;"))
    
    # Drop enum types
    bind.execute(sa.text("DROP TYPE IF EXISTS agent_role_enum;"))
    bind.execute(sa.text("DROP TYPE IF EXISTS case_severity_enum;"))
    bind.execute(sa.text("DROP TYPE IF EXISTS case_status_enum;"))
    bind.execute(sa.text("DROP TYPE IF EXISTS consent_scope_enum;"))
    bind.execute(sa.text("DROP TYPE IF EXISTS message_role_enum;"))
    bind.execute(sa.text("DROP TYPE IF EXISTS agent_name_enum;"))
