# ChatKu

Aplikasi chat sederhana bergaya WhatsApp: private chat 1-on-1, login berbasis username, dibangun dengan React + Vite, database & realtime pakai Supabase, deploy ke Railway.

## Fitur
- Navbar dengan nama app, username aktif, dan tombol keluar
- Sidebar: cari username untuk mulai chat + daftar percakapan (sorted by pesan terbaru)
- Chat window bergaya bubble WA, realtime (pesan baru muncul otomatis tanpa refresh)
- Login sederhana: cukup ketik username (belum pakai password — lihat catatan keamanan di bawah)

## 1. Setup Supabase

1. Buat project baru di https://supabase.com
2. Buka **SQL Editor**, jalankan seluruh isi file `supabase/schema.sql` di repo ini. Ini akan membuat tabel `users`, `conversations`, `messages`, mengaktifkan RLS, dan mengaktifkan Realtime untuk tabel `messages`.
3. Buka **Project Settings → API**, catat:
   - `Project URL` → jadi `VITE_SUPABASE_URL`
   - `anon public key` → jadi `VITE_SUPABASE_ANON_KEY`

## 2. Jalan di lokal

```bash
npm install
cp .env.example .env
# isi .env dengan URL & anon key Supabase kamu
npm run dev
```

Buka `http://localhost:5173`.

## 3. Deploy ke Railway

1. Push project ini ke repository GitHub kamu.
2. Di Railway, buat **New Project → Deploy from GitHub repo**, pilih repo ini.
3. Railway otomatis mendeteksi `railway.json`:
   - Build: `npm install && npm run build` (Vite build ke folder `dist`)
   - Start: `npm run start` (server Express men-serve `dist`)
4. Di tab **Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   > Penting: karena ini variabel `VITE_*`, nilainya di-*bake* ke dalam hasil build saat `npm run build` dijalankan. Pastikan variable sudah diisi di Railway **sebelum** deploy pertama (atau trigger redeploy setelah menambahkannya).
5. Railway akan otomatis meng-assign domain publik. Buka domain tersebut — aplikasi siap dipakai.

## Struktur project

```
src/
  components/
    Login.jsx        # form login berbasis username
    Navbar.jsx        # header atas
    Sidebar.jsx        # cari user + daftar percakapan
    ChatWindow.jsx      # bubble chat + realtime
  App.jsx
  supabaseClient.js
  index.css
server.js              # express server untuk serve build (dipakai di Railway)
supabase/schema.sql     # schema tabel + RLS + realtime
```

## Catatan keamanan (penting dibaca)

Login saat ini hanya berbasis username (tanpa password), dan policy RLS dibuat permisif supaya app langsung berjalan untuk demo. Ini **cukup untuk prototipe/skala kecil**, tapi siapa pun yang tahu `anon key` bisa membaca/menulis data lewat API Supabase secara langsung.

Untuk produksi, langkah lanjutan yang disarankan:
1. Ganti login username dengan **Supabase Auth** (email/password atau magic link).
2. Ubah policy RLS di `schema.sql` agar memvalidasi `auth.uid()`, misalnya user hanya bisa membaca `messages` pada `conversations` yang dia jadi `user1_id`/`user2_id`-nya.

## Pengembangan lanjutan (ide)
- Read receipts / status "online"
- Kirim gambar (Supabase Storage)
- Typing indicator
- Hapus/edit pesan
- Notifikasi push
