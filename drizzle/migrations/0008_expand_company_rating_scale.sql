ALTER TABLE public.companies ALTER COLUMN rating SET DEFAULT 2;
ALTER TABLE public.companies DROP CONSTRAINT companies_rating_check;
UPDATE public.companies SET rating = 2 WHERE rating = 1;
ALTER TABLE public.companies ADD CONSTRAINT companies_rating_check CHECK (rating IN (0,1,2,3,4));