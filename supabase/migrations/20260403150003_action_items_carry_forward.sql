ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS carried_from_item_id uuid REFERENCES public.action_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.action_items.carried_from_item_id IS 'References the original action item this was carried forward from';
