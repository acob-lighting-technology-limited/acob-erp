-- Backfill audit_logs from profiles (user creation history)
INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status, created_at)
SELECT 
    p.id as user_id,
    'create' as operation,
    'profile' as table_name,
    p.id::text as record_id,
    jsonb_build_object(
        'new_values', jsonb_build_object(
            'id', p.id,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'department', p.department,
            'role', p.role,
            'company_email', p.company_email
        )
    ) as metadata,
    'success' as status,
    p.created_at
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM audit_logs al 
    WHERE al.record_id = p.id::text 
    AND al.table_name = 'profile'
    AND al.operation = 'create'
);

-- Backfill from assets (asset creation history)
INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status, created_at)
SELECT 
    a.created_by as user_id,
    'create' as operation,
    'asset' as table_name,
    a.id::text as record_id,
    jsonb_build_object(
        'new_values', jsonb_build_object(
            'id', a.id,
            'asset_name', a.asset_name,
            'asset_type', a.asset_type,
            'serial_number', a.serial_number,
            'status', a.status,
            'department', a.department
        )
    ) as metadata,
    'success' as status,
    a.created_at
FROM assets a
WHERE a.created_by IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM audit_logs al 
    WHERE al.record_id = a.id::text 
    AND al.table_name = 'asset'
    AND al.operation = 'create'
);

-- Backfill from tasks (task creation history)
INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status, created_at)
SELECT 
    t.assigned_by as user_id,
    'create' as operation,
    'task' as table_name,
    t.id::text as record_id,
    jsonb_build_object(
        'new_values', jsonb_build_object(
            'id', t.id,
            'title', t.title,
            'description', t.description,
            'assigned_to', t.assigned_to,
            'status', t.status,
            'priority', t.priority,
            'department', t.department
        )
    ) as metadata,
    'success' as status,
    t.created_at
FROM tasks t
WHERE t.assigned_by IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM audit_logs al 
    WHERE al.record_id = t.id::text 
    AND al.table_name = 'task'
    AND al.operation = 'create'
);

-- Backfill from admin_logs (the older admin actions)
INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status, created_at)
SELECT 
    admin_id as user_id,
    LOWER(action) as operation,
    'admin_action' as table_name,
    id::text as record_id,
    jsonb_build_object(
        'new_values', jsonb_build_object(
            'action', action,
            'target_user_id', target_user_id,
            'changes', changes
        )
    ) as metadata,
    'success' as status,
    created_at
FROM admin_logs
WHERE NOT EXISTS (
    SELECT 1 FROM audit_logs al 
    WHERE al.record_id = admin_logs.id::text 
    AND al.table_name = 'admin_action'
);

-- Backfill from department_payments
INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status, created_at)
SELECT 
    dp.created_by as user_id,
    'create' as operation,
    'department_payments' as table_name,
    dp.id::text as record_id,
    jsonb_build_object(
        'new_values', jsonb_build_object(
            'id', dp.id,
            'title', dp.title,
            'amount', dp.amount,
            'currency', dp.currency,
            'status', dp.status,
            'payment_type', dp.payment_type
        )
    ) as metadata,
    'success' as status,
    dp.created_at
FROM department_payments dp
WHERE dp.created_by IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM audit_logs al 
    WHERE al.record_id = dp.id::text 
    AND al.table_name = 'department_payments'
    AND al.operation = 'create'
);

-- Notify schema refresh
NOTIFY pgrst, 'reload schema';;
