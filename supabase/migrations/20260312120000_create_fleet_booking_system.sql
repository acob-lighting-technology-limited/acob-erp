-- Fleet booking system with attachment support

create extension if not exists btree_gist;

create table if not exists public.fleet_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  resource_type text not null default 'general',
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_resources_name_non_empty check (char_length(trim(name)) > 0)
);

create unique index if not exists fleet_resources_name_unique_idx on public.fleet_resources (lower(name));

create table if not exists public.fleet_bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.fleet_resources(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fleet_bookings_time_valid check (end_at > start_at),
  constraint fleet_bookings_reason_non_empty check (char_length(trim(reason)) >= 10)
);

create index if not exists fleet_bookings_resource_idx on public.fleet_bookings (resource_id);
create index if not exists fleet_bookings_requester_idx on public.fleet_bookings (requester_id);
create index if not exists fleet_bookings_status_idx on public.fleet_bookings (status);
create index if not exists fleet_bookings_start_idx on public.fleet_bookings (start_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fleet_bookings_no_overlap_active'
      AND conrelid = 'public.fleet_bookings'::regclass
  ) THEN
    ALTER TABLE public.fleet_bookings
      ADD CONSTRAINT fleet_bookings_no_overlap_active
      EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (status IN ('pending', 'approved'));
  END IF;
END $$;

create table if not exists public.fleet_booking_attachments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.fleet_bookings(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists fleet_booking_attachments_booking_idx on public.fleet_booking_attachments (booking_id);

DROP TRIGGER IF EXISTS fleet_resources_set_updated_at ON public.fleet_resources;
create trigger fleet_resources_set_updated_at
before update on public.fleet_resources
for each row execute function public.update_updated_at_column();

DROP TRIGGER IF EXISTS fleet_bookings_set_updated_at ON public.fleet_bookings;
create trigger fleet_bookings_set_updated_at
before update on public.fleet_bookings
for each row execute function public.update_updated_at_column();

alter table public.fleet_resources enable row level security;
alter table public.fleet_bookings enable row level security;
alter table public.fleet_booking_attachments enable row level security;

-- Resources policies
DROP POLICY IF EXISTS "Fleet resources read" ON public.fleet_resources;
CREATE POLICY "Fleet resources read"
ON public.fleet_resources
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR public.has_role('admin')
  OR public.has_role('super_admin')
);

DROP POLICY IF EXISTS "Fleet resources manage" ON public.fleet_resources;
CREATE POLICY "Fleet resources manage"
ON public.fleet_resources
FOR ALL
TO authenticated
USING (
  public.has_role('admin')
  OR public.has_role('super_admin')
)
WITH CHECK (
  public.has_role('admin')
  OR public.has_role('super_admin')
);

-- Booking policies
DROP POLICY IF EXISTS "Fleet bookings read" ON public.fleet_bookings;
CREATE POLICY "Fleet bookings read"
ON public.fleet_bookings
FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid()
  OR public.has_role('admin')
  OR public.has_role('super_admin')
);

DROP POLICY IF EXISTS "Fleet bookings create" ON public.fleet_bookings;
CREATE POLICY "Fleet bookings create"
ON public.fleet_bookings
FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND status = 'pending'
);

DROP POLICY IF EXISTS "Fleet bookings update" ON public.fleet_bookings;
CREATE POLICY "Fleet bookings update"
ON public.fleet_bookings
FOR UPDATE
TO authenticated
USING (
  requester_id = auth.uid()
  OR public.has_role('admin')
  OR public.has_role('super_admin')
)
WITH CHECK (
  requester_id = auth.uid()
  OR public.has_role('admin')
  OR public.has_role('super_admin')
);

-- Attachment policies
DROP POLICY IF EXISTS "Fleet attachments read" ON public.fleet_booking_attachments;
CREATE POLICY "Fleet attachments read"
ON public.fleet_booking_attachments
FOR SELECT
TO authenticated
USING (
  exists (
    select 1
    from public.fleet_bookings b
    where b.id = booking_id
      and (
        b.requester_id = auth.uid()
        or public.has_role('admin')
        or public.has_role('super_admin')
      )
  )
);

DROP POLICY IF EXISTS "Fleet attachments create" ON public.fleet_booking_attachments;
CREATE POLICY "Fleet attachments create"
ON public.fleet_booking_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND exists (
    select 1
    from public.fleet_bookings b
    where b.id = booking_id
      and b.requester_id = auth.uid()
  )
);

-- Seed default resources
insert into public.fleet_resources (name, resource_type, description, is_active)
values
  ('Conference Room', 'conference_room', 'General conference room booking slot', true),
  ('Delivery Car', 'vehicle', 'Company delivery vehicle booking', true)
on conflict ((lower(name))) do update
set
  resource_type = excluded.resource_type,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

-- Storage bucket + policies for booking attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fleet_booking_documents',
  'fleet_booking_documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Fleet objects read'
  ) THEN
    CREATE POLICY "Fleet objects read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'fleet_booking_documents'
      AND (
        owner = auth.uid()
        OR public.has_role('admin')
        OR public.has_role('super_admin')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Fleet objects insert'
  ) THEN
    CREATE POLICY "Fleet objects insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'fleet_booking_documents'
      AND owner = auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Fleet objects update'
  ) THEN
    CREATE POLICY "Fleet objects update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'fleet_booking_documents'
      AND owner = auth.uid()
    )
    WITH CHECK (
      bucket_id = 'fleet_booking_documents'
      AND owner = auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Fleet objects delete'
  ) THEN
    CREATE POLICY "Fleet objects delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'fleet_booking_documents'
      AND owner = auth.uid()
    );
  END IF;
END $$;

