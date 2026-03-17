-- Add document archiving support for Option A receipt management
-- This migration adds columns to track archived documents and their replacements

-- Add archiving columns to payment_documents
ALTER TABLE payment_documents 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES payment_documents(id),
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add index for efficient filtering of active documents
CREATE INDEX IF NOT EXISTS idx_payment_documents_archived ON payment_documents(is_archived);

-- Add update policy for archiving documents
-- Users can update documents they uploaded (for archiving)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payment_documents' 
        AND policyname = 'Users can update their documents'
    ) THEN
        CREATE POLICY "Users can update their documents"
            ON payment_documents FOR UPDATE
            USING (uploaded_by = auth.uid());
    END IF;
END $$;

-- Admins can update any document
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payment_documents' 
        AND policyname = 'Admins can update any document'
    ) THEN
        CREATE POLICY "Admins can update any document"
            ON payment_documents FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.is_admin = true
                )
            );
    END IF;
END $$;;
