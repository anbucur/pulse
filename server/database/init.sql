-- This file is for Docker initialization
-- Run: docker-compose exec postgres psql -U pulse -d pulse -f /docker-entrypoint-initdb.d/init.sql

\i /docker-entrypoint-initdb.d/schema.sql
