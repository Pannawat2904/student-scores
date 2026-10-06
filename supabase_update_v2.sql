-- Add attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    subject TEXT NOT NULL,
    date DATE NOT NULL,
    student_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'present', 'absent', 'late', 'leave'
    PRIMARY KEY (subject, date, student_id)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous read access on attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert access on attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update access on attendance" ON public.attendance FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete access on attendance" ON public.attendance FOR DELETE USING (true);

-- Add assignments configuration to configs table (to store max scores and assignment names)
ALTER TABLE public.configs
ADD COLUMN IF NOT EXISTS assignments_config JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS total_work NUMERIC DEFAULT 30,
ADD COLUMN IF NOT EXISTS total_mid NUMERIC DEFAULT 20,
ADD COLUMN IF NOT EXISTS total_jit NUMERIC DEFAULT 20,
ADD COLUMN IF NOT EXISTS total_final NUMERIC DEFAULT 30;
