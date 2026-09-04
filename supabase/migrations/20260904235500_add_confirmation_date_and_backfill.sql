-- Migration: Add confirmation_date to profiles and backfill employment/confirmation dates from verified HR sheet
-- Timestamp: 20260904235500

-- 1. Add confirmation_date column to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS confirmation_date DATE;

COMMENT ON COLUMN public.profiles.confirmation_date IS 'Date the employee was officially confirmed following probation. NULL if on probation, not yet due, or non-applicable.';
COMMENT ON COLUMN public.profiles.employment_date IS 'Official commencement date of the employment contract.';

-- 2. Backfill dates for verified staff roster from HR export 2026-08-27
-- ACOB/2022/012: Lawrence Adukwu (Excel: Emp "22ND NOV 2022", Conf "1ST SEP 2023")
UPDATE public.profiles
SET
  employment_date = '2022-11-22'::date,
  confirmation_date = '2023-09-01'::date
WHERE employee_number = 'ACOB/2022/012';

-- ACOB/2025/044: Azeez Afeez (Excel: Emp "28TH AUG 2025", Conf "1ST AUG 2026")
UPDATE public.profiles
SET
  employment_date = '2025-08-28'::date,
  confirmation_date = '2026-08-01'::date
WHERE employee_number = 'ACOB/2025/044';

-- ACOB/2026/061: Kleopatra Aiyede (Excel: Emp "23RD MARCH 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-03-23'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2026/061';

-- ACOB/2022/011: Gbenga Ajayi (Excel: Emp "1ST JULY 2022", Conf "1ST MARCH 2023")
UPDATE public.profiles
SET
  employment_date = '2022-07-01'::date,
  confirmation_date = '2023-03-01'::date
WHERE employee_number = 'ACOB/2022/011';

-- ACOB/2023/014: Valentina Ajiboye (Excel: Emp "1ST DEC 2023", Conf "1ST OCT 2024")
UPDATE public.profiles
SET
  employment_date = '2023-12-01'::date,
  confirmation_date = '2024-10-01'::date
WHERE employee_number = 'ACOB/2023/014';

-- ACOB/2016/002: Ugochukwu Aniezue (Excel: Emp "30TH OCT 2019", Conf "1ST MAY 2020")
UPDATE public.profiles
SET
  employment_date = '2019-10-30'::date,
  confirmation_date = '2020-05-01'::date
WHERE employee_number = 'ACOB/2016/002';

-- ACOB/2026/059: Onyekachukwu Atishie (Excel: Emp "16TH FEB 2026", Conf "1ST OCT 2026")
UPDATE public.profiles
SET
  employment_date = '2026-02-16'::date,
  confirmation_date = '2026-10-01'::date
WHERE employee_number = 'ACOB/2026/059';

-- ACOB/2024/025: Edward Atoshi (Excel: Emp "1ST SEP 2025", Conf "1ST APRIL 2026")
UPDATE public.profiles
SET
  employment_date = '2025-09-01'::date,
  confirmation_date = '2026-04-01'::date
WHERE employee_number = 'ACOB/2024/025';

-- ACOB/2026/058: Peter Ayoola (Excel: Emp "15TH JANUARY 2026", Conf "1ST SEPT 2026")
UPDATE public.profiles
SET
  employment_date = '2026-01-15'::date,
  confirmation_date = '2026-09-01'::date
WHERE employee_number = 'ACOB/2026/058';

-- ACOB/2024/027: Alhamdu Bawa (Excel: Emp "28TH OCT 2024", Conf "1ST MAY 2025")
UPDATE public.profiles
SET
  employment_date = '2024-10-28'::date,
  confirmation_date = '2025-05-01'::date
WHERE employee_number = 'ACOB/2024/027';

-- ACOB/2025/049: Oluwatomi Bayode (Excel: Emp "NEXT GEN", Conf "NEXT GEN")
UPDATE public.profiles
SET
  employment_date = NULL,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2025/049';

-- ACOB/2025/031: Emmanuel Chinedu (Excel: Emp "1ST NOV 2024", Conf "1ST JUNE 2025")
UPDATE public.profiles
SET
  employment_date = '2024-11-01'::date,
  confirmation_date = '2025-06-01'::date
WHERE employee_number = 'ACOB/2025/031';

-- ACOB/2021/010: Lazarus Chiwendu (Excel: Emp "13TH AUG 2021", Conf "1ST MARCH 2022")
UPDATE public.profiles
SET
  employment_date = '2021-08-13'::date,
  confirmation_date = '2022-03-01'::date
WHERE employee_number = 'ACOB/2021/010';

-- ACOB/2026/063: Blessing Chukwu (Excel: Emp "6TH JULY 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-07-06'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2026/063';

-- ACOB/2023/021: John Dangana (Excel: Emp "23RD OCT 2023", Conf "1ST OCT 2024")
UPDATE public.profiles
SET
  employment_date = '2023-10-23'::date,
  confirmation_date = '2024-10-01'::date
WHERE employee_number = 'ACOB/2023/021';

-- ACOB/2026/066: Istifanus Daniel (Excel: Emp "6TH JULY 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-07-06'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2026/066';

-- ACOB/2025/036: Abdulsamad Danmusa (Excel: Emp "1ST JAN 2026", Conf "1ST SEP 2026")
UPDATE public.profiles
SET
  employment_date = '2026-01-01'::date,
  confirmation_date = '2026-09-01'::date
WHERE employee_number = 'ACOB/2025/036';

-- ACOB/2025/039: Jerome Egemasi (Excel: Emp "1ST APRIL 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-04-01'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2025/039';

-- ACOB/2025/053: Jessica Egeonu (Excel: Emp "26TH NOV 2025", Conf "1ST AUG 2026")
UPDATE public.profiles
SET
  employment_date = '2025-11-26'::date,
  confirmation_date = '2026-08-01'::date
WHERE employee_number = 'ACOB/2025/053';

-- ACOB/2023/013: Rafiat Egunjobi (Excel: Emp "1ST FEB 2023", Conf "1ST AUG 2023")
UPDATE public.profiles
SET
  employment_date = '2023-02-01'::date,
  confirmation_date = '2023-08-01'::date
WHERE employee_number = 'ACOB/2023/013';

-- ACOB/2025/050: Anointed Emoghene (Excel: Emp "NEXT GEN", Conf "NEXT GEN")
UPDATE public.profiles
SET
  employment_date = NULL,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2025/050';

-- ACOB/2026/060: Umar Garba (Excel: Emp "16TH MARCH 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-03-16'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2026/060';

-- ACOB/2020/007: Emmanuel Ibanga (Excel: Emp "1ST DEC 2020", Conf "1ST JUNE 2021")
UPDATE public.profiles
SET
  employment_date = '2020-12-01'::date,
  confirmation_date = '2021-06-01'::date
WHERE employee_number = 'ACOB/2020/007';

-- ACOB/2023/016: Joshua Ibe (Excel: Emp "13TH MARCH 2023", Conf "1ST OCT 2023")
UPDATE public.profiles
SET
  employment_date = '2023-03-13'::date,
  confirmation_date = '2023-10-01'::date
WHERE employee_number = 'ACOB/2023/016';

-- ACOB/2025/047: Surajo Idris (Excel: Emp "NEXT GEN", Conf "NEXT GEN")
UPDATE public.profiles
SET
  employment_date = NULL,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2025/047';

-- ACOB/2024/028: Samuel Ikuponiyi (Excel: Emp "11TH NOV 2024", Conf "1ST JUNE 2025")
UPDATE public.profiles
SET
  employment_date = '2024-11-11'::date,
  confirmation_date = '2025-06-01'::date
WHERE employee_number = 'ACOB/2024/028';

-- ACOB/2025/038: Chibuikem Ilonze (Excel: Emp "1ST APRIL 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-04-01'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2025/038';

-- ACOB/2020/006: Elijah Isah (Excel: Emp "29TH JUNE 2020/ 12 JULY 2023", Conf "1ST JAN 2021")
UPDATE public.profiles
SET
  employment_date = '2020-06-29'::date,
  confirmation_date = '2021-01-01'::date
WHERE employee_number = 'ACOB/2020/006';

-- ACOB/2025/045: Martins Ishaku (Excel: Emp "28TH AUG 2025", Conf "1ST AUG 2026")
UPDATE public.profiles
SET
  employment_date = '2025-08-28'::date,
  confirmation_date = '2026-08-01'::date
WHERE employee_number = 'ACOB/2025/045';

-- ACOB/2023/018: Shirley Jackreece (Excel: Emp "1ST AUG 2023", Conf "1ST OCT 2024")
UPDATE public.profiles
SET
  employment_date = '2023-08-01'::date,
  confirmation_date = '2024-10-01'::date
WHERE employee_number = 'ACOB/2023/018';

-- ACOB/2023/017: Vanessa Lawrence-Ukaegbu (Excel: Emp "2ND MAY 2023", Conf "1ST DEC 2023")
UPDATE public.profiles
SET
  employment_date = '2023-05-02'::date,
  confirmation_date = '2023-12-01'::date
WHERE employee_number = 'ACOB/2023/017';

-- ACOB/2025/035: Tochukwu Nnadozie (Excel: Emp "5TH MAY 2025", Conf "1ST AUG 2026")
UPDATE public.profiles
SET
  employment_date = '2025-05-05'::date,
  confirmation_date = '2026-08-01'::date
WHERE employee_number = 'ACOB/2025/035';

-- ACOB/2023/015: Agbaje Nurudeen (Excel: Emp "1ST NOV 2024", Conf "1ST NOV 2024")
UPDATE public.profiles
SET
  employment_date = '2024-11-01'::date,
  confirmation_date = '2024-11-01'::date
WHERE employee_number = 'ACOB/2023/015';

-- ACOB/2016/003: Caleb Obiechina (Excel: Emp "2ND MAY 2023", Conf "1ST OCT 2024")
UPDATE public.profiles
SET
  employment_date = '2023-05-02'::date,
  confirmation_date = '2024-10-01'::date
WHERE employee_number = 'ACOB/2016/003';

-- ACOB/2025/041: Peace Ofuafo (Excel: Emp "28TH JULY 2025", Conf "1ST AUG 2026")
UPDATE public.profiles
SET
  employment_date = '2025-07-28'::date,
  confirmation_date = '2026-08-01'::date
WHERE employee_number = 'ACOB/2025/041';

-- ACOB/2024/030: Paul Ojonugua (Excel: Emp "18TH NOV 2024", Conf "1ST JULY 2025")
UPDATE public.profiles
SET
  employment_date = '2024-11-18'::date,
  confirmation_date = '2025-07-01'::date
WHERE employee_number = 'ACOB/2024/030';

-- ACOB/2024/029: Mercy Okoro (Excel: Emp "6TH NOV 2024", Conf "1ST JUNE 2025")
UPDATE public.profiles
SET
  employment_date = '2024-11-06'::date,
  confirmation_date = '2025-06-01'::date
WHERE employee_number = 'ACOB/2024/029';

-- ACOB/2026/065: Trust Omonefe (Excel: Emp "6TH JULY 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-07-06'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2026/065';

-- ACOB/2025/033: Favour Onuoha-Eke (Excel: Emp "1ST JAN 2026", Conf "1ST SEP 2026")
UPDATE public.profiles
SET
  employment_date = '2026-01-01'::date,
  confirmation_date = '2026-09-01'::date
WHERE employee_number = 'ACOB/2025/033';

-- ACOB/2023/023: Oghenerune Orhorhomuke (Excel: Emp "15TH JAN 2023", Conf "1ST OCT 2024")
UPDATE public.profiles
SET
  employment_date = '2023-01-15'::date,
  confirmation_date = '2024-10-01'::date
WHERE employee_number = 'ACOB/2023/023';

-- ACOB/2025/046: Daniel Osa-Egonwa (Excel: Emp "NEXT GEN", Conf "NEXT GEN")
UPDATE public.profiles
SET
  employment_date = NULL,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2025/046';

-- ACOB/2026/064: Aseya Simon (Excel: Emp "6TH JULY 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-07-06'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2026/064';

-- ACOB/2025/048: Peace Terna (Excel: Emp "NEXT GEN", Conf "NEXT GEN")
UPDATE public.profiles
SET
  employment_date = NULL,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2025/048';

-- ACOB/2026/062: Lincoln Uyigue (Excel: Emp "5TH MAY 2026", Conf "NOT YET DUE")
UPDATE public.profiles
SET
  employment_date = '2026-05-05'::date,
  confirmation_date = NULL
WHERE employee_number = 'ACOB/2026/062';

-- ACOB/2020/008: Philip Yakubu (Excel: Emp "29TH JUNE 2020", Conf "1ST JAN 2021")
UPDATE public.profiles
SET
  employment_date = '2020-06-29'::date,
  confirmation_date = '2021-01-01'::date
WHERE employee_number = 'ACOB/2020/008';
