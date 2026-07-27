-- ============================================================
-- Schema untuk ChatKu (chat app sederhana bergaya WhatsApp)
-- Jalankan seluruh file ini di Supabase SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Tabel users ----------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamptz not null default now()
);

-- ---------- Tabel conversations ----------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references users(id) on delete cascade,
  user2_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_user1 on conversations(user1_id);
create index if not exists idx_conversations_user2 on conversations(user2_id);

-- ---------- Tabel messages ----------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);

-- ---------- Row Level Security ----------
-- CATATAN KEAMANAN:
-- App ini memakai "login" berbasis username saja (tanpa Supabase Auth),
-- jadi RLS tidak bisa memverifikasi identitas user secara aman di sisi server.
-- Policy di bawah ini permisif (mengizinkan akses via anon key) supaya app
-- berfungsi untuk demo/skala kecil. Untuk produksi, migrasikan ke Supabase Auth
-- (email/password atau magic link) lalu ganti policy ini agar memeriksa auth.uid().

alter table users enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "public read users" on users
  for select using (true);

create policy "public insert users" on users
  for insert with check (true);

create policy "public read conversations" on conversations
  for select using (true);

create policy "public insert conversations" on conversations
  for insert with check (true);

create policy "public read messages" on messages
  for select using (true);

create policy "public insert messages" on messages
  for insert with check (true);

-- ---------- Realtime ----------
-- Aktifkan realtime untuk tabel messages supaya pesan baru muncul otomatis
alter publication supabase_realtime add table messages;
