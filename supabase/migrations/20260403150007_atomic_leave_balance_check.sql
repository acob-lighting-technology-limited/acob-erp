CREATE OR REPLACE FUNCTION check_and_reserve_leave_balance(
  p_user_id uuid,
  p_leave_type_id uuid,
  p_days integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT balance_days INTO v_balance
  FROM leave_balances
  WHERE user_id = p_user_id AND leave_type_id = p_leave_type_id
  FOR UPDATE;

  IF v_balance IS NULL OR p_days > v_balance THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
