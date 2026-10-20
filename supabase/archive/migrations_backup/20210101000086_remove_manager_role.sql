-- Remove 'manager' role as requested by user (we use 'lead' instead)
DELETE FROM roles WHERE name = 'manager';
