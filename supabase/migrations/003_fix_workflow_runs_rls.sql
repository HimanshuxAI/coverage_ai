-- Disable RLS on workflow_runs so server client can insert and update
ALTER TABLE IF EXISTS workflow_runs DISABLE ROW LEVEL SECURITY;
