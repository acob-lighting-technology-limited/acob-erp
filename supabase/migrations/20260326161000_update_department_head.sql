-- Migration to set department_head_id for Business, Growth and Innovation
-- Replace the UUID with the correct user ID for Vanessa Lawrence-Ukaegbu

UPDATE public.departments
SET department_head_id = '55320e85-8bec-49c8-9115-f92f591aa5f6'
WHERE name = 'Business, Growth and Innovation';
