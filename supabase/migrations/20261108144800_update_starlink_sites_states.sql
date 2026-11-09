-- Update missing states for existing Starlink sites based on their community locations:
-- Adewole (Bolorunduro Adewole, Ondo)
-- Bondu (Bondu, Edo)
-- Olooji (Olooji, Ogun)
-- Sule (Sule Aba-panu, Edo)

UPDATE public.starlink_sites
SET state = 'Ondo', updated_at = now()
WHERE site_name = 'Adewole' AND (state IS NULL OR state = '');

UPDATE public.starlink_sites
SET state = 'Edo', updated_at = now()
WHERE site_name = 'Bondu' AND (state IS NULL OR state = '');

UPDATE public.starlink_sites
SET state = 'Ogun', updated_at = now()
WHERE site_name = 'Olooji' AND (state IS NULL OR state = '');

UPDATE public.starlink_sites
SET state = 'Edo', updated_at = now()
WHERE site_name = 'Sule' AND (state IS NULL OR state = '');
