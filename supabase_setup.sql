-- Table: configs
CREATE TABLE IF NOT EXISTS public.configs (
    subject TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: scores
CREATE TABLE IF NOT EXISTS public.scores (
    id TEXT NOT NULL,
    subject TEXT NOT NULL,
    name TEXT NOT NULL,
    work NUMERIC DEFAULT 0,
    mid NUMERIC DEFAULT 0,
    jit NUMERIC DEFAULT 0,
    final NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
    grade TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (id, subject)
);

-- Run this as well when the scores table already exists.
ALTER TABLE public.scores
ADD COLUMN IF NOT EXISTS assignments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Setup RLS (Row Level Security) - Allowing anonymous access for this simple project
ALTER TABLE public.configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on configs" ON public.configs FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on configs" ON public.configs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on configs" ON public.configs FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on configs" ON public.configs FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read access on scores" ON public.scores FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on scores" ON public.scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on scores" ON public.scores FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on scores" ON public.scores FOR DELETE USING (true);
