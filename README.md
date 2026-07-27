# ChatKu

Aplikasi chat sederhana bergaya WhatsApp: private chat 1-on-1, login berbasis username, dibangun dengan React + Vite, database & realtime pakai Supabase, deploy ke Railway.

## Fitur
- Navbar dengan judul tab aktif
- Bottom nav (Chat, Update, Komunitas, Panggilan, Setelan)
- Sidebar: cari username untuk mulai chat + daftar percakapan (sorted by pesan terbaru)
- Chat window bergaya bubble WA, realtime (pesan baru muncul otomatis tanpa refresh)
- Login sederhana: cukup ketik username (belum pakai password — lihat catatan keamanan di bawah)

## Struktur project

Repo ini sengaja dibuat seringkas mungkin (6 file) supaya gampang di-upload/dikelola di GitHub:

```
index.html     # HTML + semua CSS (inline di dalam <style>)
main.jsx       # semua kode React (Login, Navbar, Sidebar, ChatWindow, BottomNav, App) + client Supabase
vite.config.js # konfigurasi build Vite
package.json   # dependencies & scripts
server.js      # express server untuk serve hasil build (dipakai di Railway)
README.md      # dokumentasi ini (termasuk schema SQL di bawah)
```

## 1. Setup Supabase

1. Buat project baru di https://supabase.com
2. Buka **SQL Editor**, jalankan seluruh query di bagian [Schema SQL](#schema-sql) di bawah ini. Ini akan membuat tabel `users`, `conversations`, `messages`, mengaktifkan RLS, dan mengaktifkan Realtime untuk tabel `messages`.
3. Buka **Project Settings → API**, catat:
   - `Project URL` → jadi `VITE_SUPABASE_URL`
   - `anon public key` → jadi `VITE_SUPABASE_ANON_KEY`

## 2. Jalan di lokal

```bash
npm install
```

Buat file `.env` di root project, isi dengan:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=isi-anon-key-kamu
```

Lalu:

```bash
npm run dev
```

Buka `http://localhost:5173`.

## 3. Deploy ke Railway

1. Push project ini ke repository GitHub kamu.
2. Di Railway, buat **New Project → Deploy from GitHub repo**, pilih repo ini.
3. Railway (via Nixpacks) otomatis mendeteksi Node project dari `package.json`:
   - Build: `npm install && npm run build` (Vite build ke folder `dist`)
   - Start: `npm run start` (server Express men-serve `dist`)
4. Di tab **Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   > Penting: karena ini variabel `VITE_*`, nilainya di-*bake* ke dalam hasil build saat `npm run build` dijalankan. Pastikan variable sudah diisi di Railway **sebelum** deploy pertama (atau trigger redeploy setelah menambahkannya).
5. Railway akan otomatis meng-assign domain publik. Buka domain tersebut — aplikasi siap dipakai.

## Catatan keamanan (penting dibaca)

Login saat ini hanya berbasis username (tanpa password), dan policy RLS dibuat permisif supaya app langsung berjalan untuk demo. Ini **cukup untuk prototipe/skala kecil**, tapi siapa pun yang tahu `anon key` bisa membaca/menulis data lewat API Supabase secara langsung.

Untuk produksi, langkah lanjutan yang disarankan:
1. Ganti login username dengan **Supabase Auth** (email/password atau magic link).
2. Ubah policy RLS di schema agar memvalidasi `auth.uid()`, misalnya user hanya bisa membaca `messages` pada `conversations` yang dia jadi `user1_id`/`user2_id`-nya.

## Pengembangan lanjutan (ide)
- Read receipts / status "online"
- Kirim gambar (Supabase Storage)
- Typing indicator
- Hapus/edit pesan
- Notifikasi push

## Schema SQL

Jalankan seluruh query di bawah ini sekali di **Supabase → SQL Editor**:

```sql
-- ============================================================
-- Schema untuk ChatKu (chat app sederhana bergaya WhatsApp)
-- Jalankan seluruh query ini di Supabase SQL Editor
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
```
