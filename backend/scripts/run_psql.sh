#!/bin/bash
psql -d $DATABASE_URL -c "DROP TABLE IF EXISTS alembic_version;"