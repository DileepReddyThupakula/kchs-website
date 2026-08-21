-- Correct the original escaped-regex typo while preserving the intended
-- strict +91XXXXXXXXXX Indian mobile-number constraint.
begin;

alter table public.admission_enquiries
  drop constraint admission_enquiries_phone_number_check;

alter table public.admission_enquiries
  add constraint admission_enquiries_phone_number_check
  check (phone_number ~ '^\+91[6-9][0-9]{9}$');

commit;
