-- CampusCare: Campus Complaint and Grievance Management System
-- Run the complete script in your Supabase project's SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(100) not null check (char_length(trim(full_name)) >= 2),
  email varchar(254) not null unique,
  student_id varchar(40) unique,
  password_hash text not null,
  role varchar(20) not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reference_no text not null unique default ('CC-' || to_char(now() at time zone 'utc','YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  student_id uuid not null references public.profiles(id) on delete restrict,
  title varchar(150) not null check (char_length(trim(title)) >= 5),
  category varchar(60) not null check (category in ('Facilities & Maintenance','Hostel & Accommodation','Food & Cafeteria','Academic','Harassment & Safety','Transport','IT & Internet','Other')),
  location varchar(160),
  description varchar(5000) not null check (char_length(trim(description)) >= 20),
  priority varchar(10) not null default 'Normal' check (priority in ('Normal','High','Urgent')),
  status varchar(20) not null default 'Submitted' check (status in ('Submitted','Under Review','In Progress','Resolved','Rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaint_updates (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  status varchar(20) check (status is null or status in ('Submitted','Under Review','In Progress','Resolved','Rejected')),
  message varchar(2000) not null check (char_length(trim(message)) >= 3),
  created_at timestamptz not null default now()
);

create index if not exists idx_complaints_student_created on public.complaints(student_id, created_at desc);
create index if not exists idx_complaints_status_created on public.complaints(status, created_at desc);
create index if not exists idx_complaint_updates_complaint_created on public.complaint_updates(complaint_id, created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at before update on public.complaints
for each row execute function public.set_updated_at();

-- The Express backend uses the server-only Supabase service-role key and enforces
-- authorization in middleware/routes. RLS is enabled as defense in depth. Do not
-- expose the service-role key in the browser or give it to students.
alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_updates enable row level security;

-- No anon/authenticated policies are intentionally created because this MVP uses
-- custom password login through Express, not Supabase Auth. Browser clients should
-- never query these tables directly. Service-role access bypasses RLS and is kept
-- only in the protected backend; every private API route checks the current user.
