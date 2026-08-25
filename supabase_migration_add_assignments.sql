-- Run once in Supabase SQL Editor before deploying this version.
ALTER TABLE public.scores
ADD COLUMN IF NOT EXISTS assignments JSONB NOT NULL DEFAULT '[]'::jsonb;
