-- Per-login data usage from the office MikroTik hotspot (IT > Network Activity > Data usage).
-- The router reports running session totals every 5 minutes; the ingest route turns them
-- into bytes used and adds them to a daily row per login and device. The office line's own
-- counters go in a second table so the two can be compared with the Starlink portal.
-- NOT APPLIED: review, then apply to the live project only with explicit approval.
--
-- Direction is the router's: bytes_in is the person's upload, bytes_out their download.
-- Written only by the service role (ingest route); read only through the admin API route.

CREATE TABLE IF NOT EXISTS public.network_usage_daily (
  day date NOT NULL,
  router text NOT NULL,
  username text NOT NULL,
  mac_address text NOT NULL DEFAULT '',
  address text,
  bytes_in bigint NOT NULL DEFAULT 0 CHECK (bytes_in >= 0),
  bytes_out bigint NOT NULL DEFAULT 0 CHECK (bytes_out >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, router, username, mac_address)
);

CREATE INDEX IF NOT EXISTS network_usage_daily_username_idx
  ON public.network_usage_daily (username, day DESC);

CREATE TABLE IF NOT EXISTS public.network_usage_wan_daily (
  day date NOT NULL,
  router text NOT NULL,
  interface text NOT NULL,
  rx_bytes bigint NOT NULL DEFAULT 0 CHECK (rx_bytes >= 0),
  tx_bytes bigint NOT NULL DEFAULT 0 CHECK (tx_bytes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, router, interface)
);

-- Last running total per session and for the WAN counter, so the next report can be
-- turned into a difference. Rows not seen for 3 days are removed by apply_network_usage.
CREATE TABLE IF NOT EXISTS public.network_usage_state (
  key text PRIMARY KEY,
  bytes_in bigint NOT NULL DEFAULT 0,
  bytes_out bigint NOT NULL DEFAULT 0,
  uptime_seconds bigint,
  seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.network_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_usage_wan_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_usage_state ENABLE ROW LEVEL SECURITY;

-- Browser roles get nothing; the admin API route reads with the service role.
REVOKE ALL ON public.network_usage_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.network_usage_wan_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.network_usage_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_usage_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_usage_wan_daily TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_usage_state TO service_role;

CREATE POLICY "service role only" ON public.network_usage_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role only" ON public.network_usage_wan_daily
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role only" ON public.network_usage_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Adds one report's usage and saves the new running totals in a single transaction, so a
-- failed call never leaves usage counted without its state (which would count it twice).
--   p_daily : [{router, username, mac_address, address, bytes_in, bytes_out}]  (amounts to ADD)
--   p_state : [{key, bytes_in, bytes_out, uptime_seconds}]                     (new running totals)
--   p_wan   : {router, interface, rx_bytes, tx_bytes} or null                  (amounts to ADD)
CREATE OR REPLACE FUNCTION public.apply_network_usage(
  p_day date,
  p_seen_at timestamptz,
  p_daily jsonb,
  p_state jsonb,
  p_wan jsonb
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.network_usage_daily AS d (day, router, username, mac_address, address, bytes_in, bytes_out)
  SELECT p_day, r.router, r.username, COALESCE(r.mac_address, ''), r.address,
         GREATEST(r.bytes_in, 0), GREATEST(r.bytes_out, 0)
  FROM jsonb_to_recordset(COALESCE(p_daily, '[]'::jsonb)) AS r(
    router text, username text, mac_address text, address text, bytes_in bigint, bytes_out bigint
  )
  ON CONFLICT (day, router, username, mac_address) DO UPDATE
    SET bytes_in = d.bytes_in + EXCLUDED.bytes_in,
        bytes_out = d.bytes_out + EXCLUDED.bytes_out,
        address = COALESCE(EXCLUDED.address, d.address),
        updated_at = now();

  IF p_wan IS NOT NULL AND jsonb_typeof(p_wan) = 'object' THEN
    INSERT INTO public.network_usage_wan_daily AS w (day, router, interface, rx_bytes, tx_bytes)
    VALUES (
      p_day,
      p_wan ->> 'router',
      p_wan ->> 'interface',
      GREATEST((p_wan ->> 'rx_bytes')::bigint, 0),
      GREATEST((p_wan ->> 'tx_bytes')::bigint, 0)
    )
    ON CONFLICT (day, router, interface) DO UPDATE
      SET rx_bytes = w.rx_bytes + EXCLUDED.rx_bytes,
          tx_bytes = w.tx_bytes + EXCLUDED.tx_bytes,
          updated_at = now();
  END IF;

  INSERT INTO public.network_usage_state AS s (key, bytes_in, bytes_out, uptime_seconds, seen_at)
  SELECT r.key, r.bytes_in, r.bytes_out, r.uptime_seconds, p_seen_at
  FROM jsonb_to_recordset(COALESCE(p_state, '[]'::jsonb)) AS r(
    key text, bytes_in bigint, bytes_out bigint, uptime_seconds bigint
  )
  ON CONFLICT (key) DO UPDATE
    SET bytes_in = EXCLUDED.bytes_in,
        bytes_out = EXCLUDED.bytes_out,
        uptime_seconds = EXCLUDED.uptime_seconds,
        seen_at = EXCLUDED.seen_at;

  DELETE FROM public.network_usage_state WHERE seen_at < p_seen_at - interval '3 days';
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and anon inherits it.
REVOKE EXECUTE ON FUNCTION public.apply_network_usage(date, timestamptz, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_network_usage(date, timestamptz, jsonb, jsonb, jsonb)
  TO service_role;
