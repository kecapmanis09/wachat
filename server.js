const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/* ============================================================
   MIDDLEWARE: Verifikasi Token User
   ============================================================ */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan, silakan login.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token tidak valid atau sudah kedaluwarsa.' });
    req.user = decoded;
    next();
  });
}

/* ============================================================
   MIDDLEWARE: Verifikasi Token Admin
   ============================================================ */
function verifyAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token admin tidak ditemukan.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token admin tidak valid.' });
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Akses ditolak.' });
    req.admin = decoded;
    next();
  });
}

function generateSaldoAwal() {
  const min = 1000000;
  const max = 2000000;
  const kelipatan = 50000;
  const jumlahPilihan = Math.floor((max - min) / kelipatan) + 1;
  const acak = Math.floor(Math.random() * jumlahPilihan);
  return min + (acak * kelipatan);
}

/* ============================================================
   ROUTE: Daftar akun baru
   ============================================================ */
app.post('/api/register', async (req, res) => {
  const { namaLengkap, nikKtp, email, password } = req.body;

  if (!namaLengkap || !nikKtp || !email || !password)
    return res.status(400).json({ message: 'Semua field wajib diisi.' });
  if (nikKtp.length !== 16 || isNaN(nikKtp))
    return res.status(400).json({ message: 'NIK KTP harus 16 digit angka.' });
  if (password.length < 6)
    return res.status(400).json({ message: 'Password minimal 6 karakter.' });

  const { data: existingUser } = await supabase
    .from('users').select('id').eq('nik_ktp', nikKtp).single();

  if (existingUser)
    return res.status(409).json({ message: 'NIK ini sudah terdaftar, silakan masuk.' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const saldoAwal = generateSaldoAwal();

  const { data: newUser, error } = await supabase
    .from('users')
    .insert([{
      nama_lengkap: namaLengkap,
      nik_ktp: nikKtp,
      email,
      password: hashedPassword,
      saldo: saldoAwal,
      verifikasi_status: 'belum_verifikasi'
    }])
    .select().single();

  if (error) return res.status(500).json({ message: 'Gagal membuat akun.', error: error.message });

  const token = jwt.sign(
    { id: newUser.id, nama: newUser.nama_lengkap },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ message: 'Pendaftaran berhasil', token, user: newUser });
});

/* ============================================================
   ROUTE: Login
   Jika NIK + password cocok dengan ADMIN_NIK & ADMIN_PASSWORD
   di .env → login sebagai admin, redirect ke halaman admin.
   ============================================================ */
app.post('/api/login', async (req, res) => {
  const { nikKtp, password } = req.body;

  if (!nikKtp || !password)
    return res.status(400).json({ message: 'NIK dan password wajib diisi.' });

  // ── Cek apakah ini login admin ──
  const adminNik      = process.env.ADMIN_NIK;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminNik && adminPassword && nikKtp === adminNik && password === adminPassword) {
    const token = jwt.sign(
      { role: 'admin', username: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    // Kirim flag isAdmin agar frontend tahu harus redirect ke mana
    return res.json({ message: 'Login admin berhasil', token, isAdmin: true });
  }

  // ── Login user biasa ──
  const { data: existingUser } = await supabase
    .from('users').select('*').eq('nik_ktp', nikKtp).single();

  if (!existingUser)
    return res.status(404).json({ message: 'NIK belum terdaftar, silakan daftar dulu.' });

  const passwordMatch = await bcrypt.compare(password, existingUser.password);
  if (!passwordMatch) return res.status(401).json({ message: 'Password salah.' });

  const token = jwt.sign(
    { id: existingUser.id, nama: existingUser.nama_lengkap },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ message: 'Login berhasil', token, isAdmin: false, user: existingUser });
});

/* ============================================================
   ROUTE: Data User (butuh token)
   ============================================================ */
app.get('/api/me', verifyToken, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, nama_lengkap, nik_ktp, email, saldo, verifikasi_status, verifikasi_catatan, created_at')
    .eq('id', req.user.id).single();

  if (error) return res.status(404).json({ message: 'User tidak ditemukan.' });
  res.json(data);
});

/* ============================================================
   ROUTE: Edit Nama Pengguna
   ============================================================ */
app.put('/api/profile', verifyToken, async (req, res) => {
  const { nama_lengkap } = req.body;

  if (!nama_lengkap || typeof nama_lengkap !== 'string' || nama_lengkap.trim().length < 3)
    return res.status(400).json({ message: 'Nama minimal 3 karakter.' });

  const namaBersih = nama_lengkap.trim().replace(/\s+/g, ' ');

  const { error } = await supabase
    .from('users')
    .update({ nama_lengkap: namaBersih })
    .eq('id', req.user.id);

  if (error) return res.status(500).json({ message: 'Gagal memperbarui nama.', error: error.message });
  res.json({ message: 'Nama berhasil diperbarui.', nama_lengkap: namaBersih });
});


app.post('/api/verifikasi/ajukan', verifyToken, async (req, res) => {
  const { ktp_foto_base64 } = req.body;

  // Validasi foto KTP wajib
  if (!ktp_foto_base64) {
    return res.status(400).json({ message: 'Foto KTP wajib diupload untuk mengajukan verifikasi.' });
  }

  // Cek status verifikasi sekarang
  const { data: user } = await supabase
    .from('users')
    .select('verifikasi_status')
    .eq('id', req.user.id).single();

  if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
  if (user.verifikasi_status === 'terverifikasi')
    return res.status(400).json({ message: 'Akun Anda sudah terverifikasi.' });
  if (user.verifikasi_status === 'menunggu')
    return res.status(400).json({ message: 'Pengajuan verifikasi Anda sedang diproses.' });

  // Upload foto KTP ke Supabase Storage
  let ktpFotoUrl = null;
  try {
    const base64Data = ktp_foto_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `ktp_${req.user.id}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('ktp')
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('ktp').getPublicUrl(fileName);
      ktpFotoUrl = urlData?.publicUrl || null;
    } else {
      console.error('Upload KTP Storage error:', uploadError.message);
    }
  } catch (e) {
    console.error('Upload KTP error:', e);
  }

  const { error } = await supabase
    .from('users')
    .update({
      verifikasi_status: 'menunggu',
      verifikasi_catatan: null,
      verifikasi_at: null,
      ktp_foto_url: ktpFotoUrl
    })
    .eq('id', req.user.id);

  if (error) return res.status(500).json({ message: 'Gagal mengajukan verifikasi.', error: error.message });
  res.json({ message: 'Pengajuan verifikasi berhasil dikirim. Menunggu persetujuan admin.' });
});

/* ============================================================
   ROUTE: Cairkan Dana (wajib terverifikasi)
   ============================================================ */
app.post('/api/tarik', verifyToken, async (req, res) => {
  const { nominal, keterangan } = req.body;

  if (!nominal || isNaN(nominal) || nominal <= 0)
    return res.status(400).json({ message: 'Nominal tidak valid.' });

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('saldo, verifikasi_status')
    .eq('id', req.user.id).single();

  if (userError || !user) return res.status(404).json({ message: 'User tidak ditemukan.' });

  // Blok pencairan jika belum terverifikasi
  if (user.verifikasi_status !== 'terverifikasi') {
    const statusMsg = {
      belum_verifikasi: 'Anda harus memverifikasi KTP & Nama sebelum dapat mencairkan dana.',
      menunggu: 'Pengajuan verifikasi Anda sedang diproses. Harap tunggu persetujuan admin.',
      ditolak: 'Verifikasi Anda ditolak. Silakan hubungi admin atau ajukan ulang.'
    };
    return res.status(403).json({
      message: statusMsg[user.verifikasi_status] || 'Akun belum terverifikasi.',
      verifikasi_status: user.verifikasi_status
    });
  }

  if (nominal > user.saldo)
    return res.status(400).json({ message: 'Saldo tidak cukup untuk pencairan ini.' });

  const saldoBaru = user.saldo - nominal;

  const { data: updatedUser, error: updateError } = await supabase
    .from('users').update({ saldo: saldoBaru }).eq('id', req.user.id).select().single();

  if (updateError)
    return res.status(500).json({ message: 'Gagal memproses pencairan.', error: updateError.message });

  await supabase.from('transaksi').insert([{
    user_id: req.user.id,
    jenis: 'tarik',
    nominal: nominal,
    saldo_sesudah: saldoBaru,
    keterangan: keterangan || 'Pencairan saldo',
    status: 'pending'
  }]);

  res.json({ message: 'Permintaan pencairan berhasil dikirim. Menunggu persetujuan admin.', saldo: updatedUser.saldo, pending: true });
});

/* ============================================================
   ROUTE: Riwayat Transaksi
   ============================================================ */
app.get('/api/riwayat', verifyToken, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const offset = parseInt(req.query.offset) || 0;

  const { data, error } = await supabase
    .from('transaksi')
    .select('id, jenis, nominal, saldo_sesudah, keterangan, created_at, status')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ message: 'Gagal mengambil riwayat.', error: error.message });
  res.json(data || []);
});

/* ============================================================
   ====== ADMIN ROUTES ======
   ============================================================ */

/* --- Statistik Dashboard --- */
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const [
      { count: totalUser },
      { count: menunggu },
      { count: terverifikasi },
      { count: ditolak },
      { data: totalTrxData },
      { count: pendingPencairan }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('verifikasi_status', 'menunggu'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('verifikasi_status', 'terverifikasi'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('verifikasi_status', 'ditolak'),
      supabase.from('transaksi').select('nominal').eq('jenis', 'tarik').eq('status', 'approved'),
      supabase.from('transaksi').select('*', { count: 'exact', head: true }).eq('jenis', 'tarik').eq('status', 'pending')
    ]);

    const totalPencairan = (totalTrxData || []).reduce((acc, t) => acc + (t.nominal || 0), 0);

    res.json({ totalUser, menunggu, terverifikasi, ditolak, totalPencairan, pendingPencairan: pendingPencairan || 0 });
  } catch (e) {
    res.status(500).json({ message: 'Gagal mengambil statistik.' });
  }
});

/* --- Daftar Semua User --- */
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;
  const search = req.query.search;

  let query = supabase
    .from('users')
    .select('id, nama_lengkap, nik_ktp, email, saldo, verifikasi_status, verifikasi_catatan, verifikasi_at, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'semua') query = query.eq('verifikasi_status', status);
  if (search) {
    query = query.or(`nama_lengkap.ilike.%${search}%,nik_ktp.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ message: 'Gagal mengambil data user.', error: error.message });

  res.json({ data: data || [], count: count || 0 });
});

/* --- Detail User (Admin) --- */
app.get('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  const [{ data: user }, { data: riwayat }] = await Promise.all([
    supabase.from('users')
      .select('id, nama_lengkap, nik_ktp, email, saldo, verifikasi_status, verifikasi_catatan, verifikasi_at, ktp_foto_url, created_at')
      .eq('id', id).single(),
    supabase.from('transaksi')
      .select('id, jenis, nominal, saldo_sesudah, keterangan, created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(10)
  ]);

  if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });
  res.json({ user, riwayat: riwayat || [] });
});

/* --- Approve / Reject Verifikasi --- */
app.put('/api/admin/users/:id/verifikasi', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { aksi, catatan } = req.body; // aksi: 'setujui' | 'tolak'

  if (!['setujui', 'tolak'].includes(aksi))
    return res.status(400).json({ message: 'Aksi tidak valid. Gunakan: setujui atau tolak.' });

  const statusBaru = aksi === 'setujui' ? 'terverifikasi' : 'ditolak';

  // Ambil URL foto KTP sebelum dihapus
  const { data: userLama } = await supabase
    .from('users').select('ktp_foto_url').eq('id', id).single();

  // Hapus foto KTP dari Storage jika ada
  if (userLama?.ktp_foto_url) {
    try {
      const urlPath = new URL(userLama.ktp_foto_url).pathname;
      const fileName = urlPath.split('/').pop();
      await supabase.storage.from('ktp').remove([fileName]);
    } catch (e) {
      console.error('Gagal hapus foto KTP dari Storage:', e);
    }
  }

  const { error } = await supabase
    .from('users')
    .update({
      verifikasi_status: statusBaru,
      verifikasi_catatan: catatan || null,
      verifikasi_at: new Date().toISOString(),
      ktp_foto_url: null  // Hapus referensi foto dari DB
    })
    .eq('id', id);

  if (error) return res.status(500).json({ message: 'Gagal memperbarui status verifikasi.', error: error.message });

  res.json({ message: aksi === 'setujui' ? 'Verifikasi berhasil disetujui.' : 'Verifikasi berhasil ditolak.' });
});

/* --- Reset Verifikasi (buat ulang pengajuan) --- */
app.put('/api/admin/users/:id/reset-verifikasi', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  // Ambil dan hapus foto KTP lama dari Storage jika ada
  const { data: userLama } = await supabase
    .from('users').select('ktp_foto_url').eq('id', id).single();

  if (userLama?.ktp_foto_url) {
    try {
      const urlPath = new URL(userLama.ktp_foto_url).pathname;
      const fileName = urlPath.split('/').pop();
      await supabase.storage.from('ktp').remove([fileName]);
    } catch (e) {
      console.error('Gagal hapus foto KTP dari Storage:', e);
    }
  }

  const { error } = await supabase
    .from('users')
    .update({ verifikasi_status: 'belum_verifikasi', verifikasi_catatan: null, verifikasi_at: null, ktp_foto_url: null })
    .eq('id', id);

  if (error) return res.status(500).json({ message: 'Gagal mereset verifikasi.', error: error.message });
  res.json({ message: 'Status verifikasi berhasil direset.' });
});

/* --- Edit Saldo (Admin) --- */
app.put('/api/admin/users/:id/saldo', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { saldo } = req.body;

  if (saldo === undefined || saldo === null || isNaN(saldo) || Number(saldo) < 0)
    return res.status(400).json({ message: 'Nominal saldo tidak valid.' });

  const { data: user, error: userError } = await supabase
    .from('users').select('saldo').eq('id', id).single();

  if (userError || !user) return res.status(404).json({ message: 'User tidak ditemukan.' });

  const saldoLama = user.saldo || 0;
  const saldoBaru = Math.round(Number(saldo));
  const selisih = saldoBaru - saldoLama;

  const { error } = await supabase
    .from('users').update({ saldo: saldoBaru }).eq('id', id);

  if (error) return res.status(500).json({ message: 'Gagal memperbarui saldo.', error: error.message });

  if (selisih !== 0) {
    await supabase.from('transaksi').insert([{
      user_id: id,
      jenis: selisih > 0 ? 'masuk' : 'tarik',
      nominal: Math.abs(selisih),
      saldo_sesudah: saldoBaru,
      keterangan: 'Penyesuaian saldo oleh admin'
    }]);
  }

  res.json({ message: 'Saldo berhasil diperbarui.', saldo: saldoBaru });
});

/* --- Daftar Pencairan (Admin) --- */
app.get('/api/admin/pencairan', verifyAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status || 'pending';

  let query = supabase
    .from('transaksi')
    .select('id, nominal, keterangan, created_at, status, saldo_sesudah, user_id, users(id, nama_lengkap, nik_ktp)', { count: 'exact' })
    .eq('jenis', 'tarik')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'semua') query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ message: 'Gagal mengambil data pencairan.', error: error.message });

  res.json({ data: data || [], count: count || 0 });
});

/* --- Approve / Reject Pencairan (Admin) --- */
app.put('/api/admin/pencairan/:id/aksi', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { aksi, catatan } = req.body; // aksi: 'setujui' | 'tolak'

  if (!['setujui', 'tolak'].includes(aksi))
    return res.status(400).json({ message: 'Aksi tidak valid. Gunakan: setujui atau tolak.' });

  const { data: trx, error: trxError } = await supabase
    .from('transaksi')
    .select('id, user_id, nominal, status, jenis, keterangan, saldo_sesudah')
    .eq('id', id)
    .single();

  if (trxError || !trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
  if (trx.jenis !== 'tarik') return res.status(400).json({ message: 'Bukan transaksi pencairan.' });
  if (trx.status !== 'pending') return res.status(400).json({ message: 'Transaksi ini sudah diproses sebelumnya.' });

  const statusBaru = aksi === 'setujui' ? 'approved' : 'rejected';

  // Jika ditolak, simpan alasan penolakan di keterangan dengan separator khusus
  const updateData = { status: statusBaru };
  if (aksi === 'tolak' && catatan) {
    updateData.keterangan = (trx.keterangan || 'Pencairan saldo') + '\n[Alasan: ' + catatan + ']';
  }

  const { error: updateError } = await supabase
    .from('transaksi')
    .update(updateData)
    .eq('id', id);

  if (updateError) return res.status(500).json({ message: 'Gagal memproses.', error: updateError.message });

  // Jika ditolak, kembalikan saldo ke user
  if (aksi === 'tolak') {
    const { data: user } = await supabase.from('users').select('saldo').eq('id', trx.user_id).single();
    if (user) {
      const saldoBaru = (user.saldo || 0) + trx.nominal;
      await supabase.from('users').update({ saldo: saldoBaru }).eq('id', trx.user_id);
      await supabase.from('transaksi').insert([{
        user_id: trx.user_id,
        jenis: 'masuk',
        nominal: trx.nominal,
        saldo_sesudah: saldoBaru,
        keterangan: `Pengembalian dana: pencairan ditolak${catatan ? ' — ' + catatan : ''}`,
        status: 'approved'
      }]);
    }
  }

  res.json({
    message: aksi === 'setujui'
      ? 'Pencairan berhasil disetujui.'
      : 'Pencairan ditolak dan dana dikembalikan ke pengguna.'
  });
});

/* --- Hapus Pengguna (Admin) --- */
app.delete('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: user } = await supabase
    .from('users').select('id, nama_lengkap').eq('id', id).single();

  if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' });

  // Hapus riwayat transaksi terkait terlebih dahulu agar tidak menyalahi foreign key
  await supabase.from('transaksi').delete().eq('user_id', id);

  const { error } = await supabase.from('users').delete().eq('id', id);

  if (error) return res.status(500).json({ message: 'Gagal menghapus pengguna.', error: error.message });

  res.json({ message: `Pengguna "${user.nama_lengkap}" berhasil dihapus.` });
});

/* ============================================================
   ROUTE: Notifikasi Admin → Pengguna
   ============================================================ */

/* --- Kirim ke satu pengguna --- */
app.post('/api/admin/notifikasi/kirim', verifyAdmin, async (req, res) => {
  const { user_id, judul, pesan, tipe } = req.body;

  if (!user_id) return res.status(400).json({ message: 'user_id wajib diisi.' });
  if (!judul || !pesan) return res.status(400).json({ message: 'Judul dan pesan wajib diisi.' });

  // Pastikan user ada
  const { data: user } = await supabase.from('users').select('id').eq('id', user_id).single();
  if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });

  const { error } = await supabase.from('notifikasi').insert([{
    user_id,
    judul: judul.trim(),
    pesan: pesan.trim(),
    tipe: tipe || 'info',
    dibaca: false
  }]);

  if (error) return res.status(500).json({ message: 'Gagal menyimpan notifikasi.', error: error.message });
  res.json({ message: 'Notifikasi berhasil dikirim ke pengguna.' });
});

/* --- Broadcast ke semua pengguna --- */
app.post('/api/admin/notifikasi/broadcast', verifyAdmin, async (req, res) => {
  const { judul, pesan, tipe } = req.body;

  if (!judul || !pesan) return res.status(400).json({ message: 'Judul dan pesan wajib diisi.' });

  // Ambil semua user_id — gunakan limit besar agar tidak terpotong default Supabase (1000)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id')
    .limit(10000);

  if (usersError) return res.status(500).json({ message: 'Gagal mengambil daftar pengguna.', error: usersError.message });
  if (!users || users.length === 0) return res.status(404).json({ message: 'Belum ada pengguna terdaftar.' });

  const rows = users.map(u => ({
    user_id: u.id,
    judul: judul.trim(),
    pesan: pesan.trim(),
    tipe: tipe || 'info',
    dibaca: false
  }));

  // Insert per batch 100 row agar tidak melebihi batas ukuran request Supabase
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('notifikasi').insert(batch);
    if (error) return res.status(500).json({ message: 'Gagal broadcast notifikasi.', error: error.message });
  }

  res.json({ message: `Notifikasi berhasil dikirim ke ${users.length} pengguna.` });
});

/* --- Ambil riwayat notifikasi (Admin) --- */
app.get('/api/admin/notifikasi', verifyAdmin, async (req, res) => {
  // Ambil 1 row per judul+pesan unik (representative dari broadcast), order terbaru
  const { data, error } = await supabase
    .from('notifikasi')
    .select('id, user_id, judul, pesan, tipe, dibaca, created_at, users(nama_lengkap)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ message: 'Gagal mengambil notifikasi.', error: error.message });

  // Deduplicate: tampilkan satu wakil per judul+pesan+created_at yang sama (broadcast)
  const seen = new Set();
  const result = [];
  for (const n of (data || [])) {
    const key = `${n.judul}|${n.pesan}|${n.created_at?.slice(0,16)}`;
    if (!seen.has(key)) {
      seen.add(key);
      // Jika bukan spesifik ke satu user (punya duplikat), set user_id null = broadcast
      const isDuplicate = (data || []).filter(x =>
        x.judul === n.judul && x.pesan === n.pesan && x.created_at?.slice(0,16) === n.created_at?.slice(0,16)
      ).length > 1;
      result.push({ ...n, user_id: isDuplicate ? null : n.user_id });
    }
  }

  res.json(result);
});

/* --- Hapus notifikasi --- */
app.delete('/api/admin/notifikasi/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  // Ambil data notifikasi dulu untuk cek apakah broadcast
  const { data: notif } = await supabase.from('notifikasi').select('judul, pesan, created_at').eq('id', id).single();

  if (notif) {
    // Hapus semua notifikasi dengan judul+pesan+waktu yang sama (hapus seluruh batch broadcast)
    await supabase.from('notifikasi')
      .delete()
      .eq('judul', notif.judul)
      .eq('pesan', notif.pesan)
      .gte('created_at', new Date(new Date(notif.created_at).getTime() - 5000).toISOString())
      .lte('created_at', new Date(new Date(notif.created_at).getTime() + 5000).toISOString());
  }

  res.json({ message: 'Notifikasi berhasil dihapus.' });
});

/* --- Ambil notifikasi milik pengguna (User) --- */
app.get('/api/notifikasi', verifyToken, async (req, res) => {
  const { data, error } = await supabase
    .from('notifikasi')
    .select('id, judul, pesan, tipe, dibaca, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return res.status(500).json({ message: 'Gagal mengambil notifikasi.', error: error.message });
  res.json(data || []);
});

/* --- Tandai notifikasi sudah dibaca --- */
app.put('/api/notifikasi/:id/baca', verifyToken, async (req, res) => {
  const { id } = req.params;
  await supabase.from('notifikasi').update({ dibaca: true }).eq('id', id).eq('user_id', req.user.id);
  res.json({ message: 'OK' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
