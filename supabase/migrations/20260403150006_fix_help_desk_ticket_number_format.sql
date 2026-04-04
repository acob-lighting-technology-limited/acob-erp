CREATE INDEX IF NOT EXISTS idx_help_desk_tickets_ticket_number ON public.help_desk_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_help_desk_tickets_requester ON public.help_desk_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_help_desk_tickets_assigned ON public.help_desk_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
