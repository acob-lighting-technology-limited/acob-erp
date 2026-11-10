-- correspondence_department_codes was the first home of department codes. The
-- app now reads departments.department_code everywhere (correspondence page,
-- correspondence numbering, requisition numbering), and the only reader of this
-- table, /api/correspondence/department-codes, has been removed. Nothing else
-- references it: no foreign keys, views or functions (checked 2026-11-10).
DROP TABLE IF EXISTS public.correspondence_department_codes;
