-- Add new columns for course details and detailed settings
ALTER TABLE public.configs
ADD COLUMN IF NOT EXISTS course_code TEXT,
ADD COLUMN IF NOT EXISTS course_name TEXT,
ADD COLUMN IF NOT EXISTS study_group TEXT,
ADD COLUMN IF NOT EXISTS jit_config JSONB DEFAULT '{"show_to_students": false, "aspects": []}'::jsonb;

ALTER TABLE public.scores
ADD COLUMN IF NOT EXISTS jit_scores JSONB DEFAULT '{}'::jsonb;
