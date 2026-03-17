-- Backfill audit_logs from asset_assignments history
-- This restores assignment history that was lost when the audit_logs table was recreated

-- Insert assignment events from asset_assignments
INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status, created_at)
SELECT 
    aa.assigned_by,
    CASE 
        WHEN aa.assigned_from IS NULL THEN 'create'
        ELSE 'update'
    END as operation,
    'asset_assignment' as table_name,
    aa.id::text as record_id,
    jsonb_build_object(
        'old_values', CASE 
            WHEN aa.assigned_from IS NOT NULL THEN jsonb_build_object(
                'assigned_to', aa.assigned_from,
                'asset_id', aa.asset_id
            )
            ELSE NULL
        END,
        'new_values', jsonb_build_object(
            'id', aa.id,
            'asset_id', aa.asset_id,
            'assigned_to', aa.assigned_to,
            'assigned_from', aa.assigned_from,
            'assigned_by', aa.assigned_by,
            'department', aa.department,
            'office_location', aa.office_location,
            'assignment_type', aa.assignment_type,
            'assignment_notes', aa.assignment_notes,
            'is_current', aa.is_current
        )
    ) as metadata,
    'success' as status,
    COALESCE(aa.assigned_at, aa.created_at) as created_at
FROM asset_assignments aa
WHERE NOT EXISTS (
    SELECT 1 FROM audit_logs al 
    WHERE al.record_id = aa.id::text 
    AND al.table_name IN ('asset_assignment', 'asset_assignments')
);

-- Also backfill handover events (when assets were returned/transferred)
INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status, created_at)
SELECT 
    aa.assigned_by,
    'update' as operation,
    'asset_assignment' as table_name,
    aa.id::text || '_handover' as record_id,
    jsonb_build_object(
        'old_values', jsonb_build_object(
            'is_current', true,
            'handed_over_at', NULL
        ),
        'new_values', jsonb_build_object(
            'id', aa.id,
            'asset_id', aa.asset_id,
            'assigned_to', aa.assigned_to,
            'is_current', false,
            'handed_over_at', aa.handed_over_at,
            'handover_notes', aa.handover_notes
        )
    ) as metadata,
    'success' as status,
    aa.handed_over_at as created_at
FROM asset_assignments aa
WHERE aa.handed_over_at IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM audit_logs al 
    WHERE al.record_id = aa.id::text || '_handover'
);

-- Notify schema refresh
NOTIFY pgrst, 'reload schema';;
