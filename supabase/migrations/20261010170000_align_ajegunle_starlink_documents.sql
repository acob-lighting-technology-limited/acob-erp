-- Ajegunle's hand-uploaded Starlink receipts were dated the 2nd, but Starlink
-- bills the kit on the 3rd (its invoices' billing periods start on the 3rd).
-- The payment's month list now follows Starlink's dates, so move these four
-- onto the 3rd or they match no month and drop out of view.

UPDATE public.payment_documents pd
SET applicable_date = pd.applicable_date + 1,
    updated_at = now()
FROM public.department_payments p
JOIN public.starlink_sites s ON s.id = p.site_id
WHERE pd.payment_id = p.id
  AND s.serial_number = 'ACC-DF-10220671-51752-35'
  AND extract(day FROM pd.applicable_date) = 2;
