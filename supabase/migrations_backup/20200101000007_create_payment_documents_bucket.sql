-- Create storage bucket for payment documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment_documents',
  'payment_documents',
  false, -- Not public, requires authentication
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for payment_documents bucket
-- Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload payment documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment_documents'
);

-- Allow authenticated users to view their own department's payment documents
CREATE POLICY "Users can view payment documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment_documents'
);

-- Allow authenticated users to delete their own uploaded documents
CREATE POLICY "Users can delete their own payment documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment_documents' AND
  auth.uid() = owner
);

-- Allow authenticated users to update their own uploaded documents
CREATE POLICY "Users can update their own payment documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment_documents' AND
  auth.uid() = owner
);
