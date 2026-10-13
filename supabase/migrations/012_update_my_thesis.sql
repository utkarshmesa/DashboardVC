-- 012: spreadsheet import (stress test from Vikram's POV, 2026-10-13). His spreadsheet carries a thesis per VC, so the
-- import can update it. Like update_my_fields, this is the human write path: the ownership guard still forbids it from
-- touching the four system columns.
create or replace function update_my_thesis(p_id uuid, p_thesis text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'human', true);
  update vcs set thesis = p_thesis where id = p_id;
end $$;
revoke execute on function update_my_thesis from public, anon, authenticated;
grant execute on function update_my_thesis to service_role;
