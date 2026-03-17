-- Update the trigger function to remove site_name and site_state

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    company_email,
    first_name,
    last_name,
    other_names,
    department,
    company_role,
    phone_number,
    additional_phone,
    residential_address,
    current_work_location,
    device_allocated,
    device_type,
    device_model,
    is_admin,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    FALSE,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
