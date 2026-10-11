-- 003: pin search_path on the ownership trigger function (Supabase advisor 0011). Behaviour unchanged.
alter function guard_ownership() set search_path = public;
