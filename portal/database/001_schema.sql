-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clients table (extends Supabase auth.users)
create table public.clients (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text not null,
  company text not null,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz default now()
);

-- Retainer accounts
create table public.retainer_accounts (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null unique,
  balance numeric(10,2) not null default 0,
  updated_at timestamptz default now()
);

-- Requests
create table public.requests (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  type text not null check (type in ('website_content', 'blog', 'social_media')),
  mode text not null check (mode in ('self_serve', 'firm_creates')),
  title text not null,
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'quoted', 'in_progress', 'awaiting_approval', 'completed', 'rejected')),
  quoted_price numeric(10,2),
  preferred_deadline date,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Social media details (linked to requests of type social_media)
create table public.social_media_details (
  id uuid default uuid_generate_v4() primary key,
  request_id uuid references public.requests(id) on delete cascade not null unique,
  platforms text[] not null default '{}',
  scheduled_date date
);

-- Request attachments
create table public.request_attachments (
  id uuid default uuid_generate_v4() primary key,
  request_id uuid references public.requests(id) on delete cascade not null,
  file_url text not null,
  file_name text not null,
  uploaded_by text not null check (uploaded_by in ('client', 'admin')),
  uploaded_at timestamptz default now()
);

-- Retainer transactions
create table public.retainer_transactions (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  amount numeric(10,2) not null,
  type text not null check (type in ('credit', 'debit')),
  description text not null,
  related_request_id uuid references public.requests(id) on delete set null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.clients enable row level security;
alter table public.retainer_accounts enable row level security;
alter table public.requests enable row level security;
alter table public.social_media_details enable row level security;
alter table public.request_attachments enable row level security;
alter table public.retainer_transactions enable row level security;

-- RLS Policies: clients can only see their own data
create policy "clients_select_own" on public.clients for select using (auth.uid() = id);
create policy "retainer_select_own" on public.retainer_accounts for select using (auth.uid() = client_id);
create policy "requests_select_own" on public.requests for select using (auth.uid() = client_id);
create policy "transactions_select_own" on public.retainer_transactions for select using (auth.uid() = client_id);

-- RLS Policies: clients can insert their own requests
create policy "requests_insert_own" on public.requests for insert with check (auth.uid() = client_id);
create policy "social_media_insert" on public.social_media_details for insert with check (
  exists (select 1 from public.requests where id = request_id and client_id = auth.uid())
);
create policy "attachments_insert_own" on public.request_attachments for insert with check (
  exists (select 1 from public.requests where id = request_id and client_id = auth.uid())
);

-- RLS Policies: clients can insert themselves on signup
create policy "clients_insert_own" on public.clients for insert with check (auth.uid() = id);
create policy "retainer_insert_own" on public.retainer_accounts for insert with check (auth.uid() = client_id);

-- RLS Policies: admin bypass (service role bypasses RLS automatically)
