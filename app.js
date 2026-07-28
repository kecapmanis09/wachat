  let userSaldoSaatIni = 0;
  let userVerifStatus = 'belum_verifikasi';
  const RIWAYAT_LIMIT = 10;
  let metodeTerpilih = null; // 'ewallet' atau 'bank'
  let riwayatOffset = 0;
  let riwayatHabis = false;
  let semuaRiwayat = [];

  requireLogin();

  (async () => {
    const user = await getUserData();
    if (user) {
      userSaldoSaatIni = user.saldo;
      userVerifStatus = user.verifikasi_status || 'belum_verifikasi';

      document.getElementById('greeting').textContent = 'Halo, ' + user.nama_lengkap.split(' ')[0];
      document.getElementById('pNama').textContent = user.nama_lengkap;
      document.getElementById('pNik').textContent = user.nik_ktp;
      document.getElementById('pEmail').textContent = user.email;
      document.getElementById('saldoAmount').textContent = 'Rp ' + user.saldo.toLocaleString('id-ID');

      // Sembunyikan tombol edit nama jika sudah terverifikasi
      const editNamaBtn = document.getElementById('editNamaBtn');
      if (editNamaBtn) editNamaBtn.style.display = userVerifStatus === 'terverifikasi' ? 'none' : 'inline-flex';

      // Tampilkan badge Verified di samping nama jika sudah terverifikasi
      const verifiedBadgeName = document.getElementById('verifiedBadgeName');
      if (verifiedBadgeName) verifiedBadgeName.style.display = userVerifStatus === 'terverifikasi' ? 'inline-flex' : 'none';

      const balanceName = document.getElementById('balanceName');
      if (balanceName) balanceName.textContent = user.nama_lengkap;

      const headerInitial = document.getElementById('headerInitial');
      if (headerInitial) headerInitial.textContent = user.nama_lengkap[0].toUpperCase();

      const profileInitials = document.getElementById('profileInitials');
      if (profileInitials) {
        const parts = user.nama_lengkap.trim().split(/\s+/);
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : parts[0].substring(0, 2).toUpperCase();
        profileInitials.textContent = initials;
      }

      // Populate profile stats row
      const statSaldo = document.getElementById('statSaldo');
      if (statSaldo) {
        const s = user.saldo;
        statSaldo.textContent = s >= 1000000
          ? 'Rp ' + (s/1000000).toFixed(1).replace('.0','') + 'jt'
          : 'Rp ' + s.toLocaleString('id-ID');
      }
      const statStatusVerif = document.getElementById('statStatusVerif');
      if (statStatusVerif) {
        const statusLabel = {
          terverifikasi: '✓ Aktif',
          menunggu: '⏳ Proses',
          ditolak: '✕ Tolak',
          belum_verifikasi: '— Belum'
        };
        statStatusVerif.textContent = statusLabel[user.verifikasi_status] || '—';
      }

      // Render UI berdasarkan status verifikasi
      renderVerifUI(user);
    }
    cekNotifikasiAktif();

    // Kembalikan halaman terakhir yang dibuka sebelum refresh
    const halamanTerakhir = sessionStorage.getItem('halamanTerakhir');
    const halamanValid = ['beranda', 'topup', 'profil', 'riwayat', 'aktivitas', 'notifikasi'];
    if (halamanTerakhir && halamanValid.includes(halamanTerakhir) && halamanTerakhir !== 'beranda') {
      showView(halamanTerakhir);
    }
  })();

  /* ---- Render UI Verifikasi ---- */
  function renderVerifUI(user) {
    const status = user.verifikasi_status || 'belum_verifikasi';

    // === Banner beranda ===
    const banner = document.getElementById('verifBanner');
    const balanceCard = document.getElementById('balanceCard');

    if (status === 'belum_verifikasi') {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="verif-banner belum">
          <div class="verif-banner-icon">⚠️</div>
          <div class="verif-banner-body">
            <div class="verif-banner-title">Verifikasi KTP Diperlukan</div>
            <div class="verif-banner-text">Anda harus memverifikasi KTP & Nama untuk dapat mencairkan dana.</div>
            <button class="verif-banner-btn" onclick="showView('profil')">Verifikasi Sekarang →</button>
          </div>
        </div>`;
      if (balanceCard) balanceCard.style.marginTop = '12px';
    } else if (status === 'menunggu') {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="verif-banner menunggu">
          <div class="verif-banner-icon">🔄</div>
          <div class="verif-banner-body">
            <div class="verif-banner-title">Verifikasi Sedang Diproses</div>
            <div class="verif-banner-text">Pengajuan Anda sedang ditinjau admin. Harap tunggu persetujuan.</div>
          </div>
        </div>`;
      if (balanceCard) balanceCard.style.marginTop = '12px';
    } else if (status === 'ditolak') {
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="verif-banner ditolak">
          <div class="verif-banner-icon">❌</div>
          <div class="verif-banner-body">
            <div class="verif-banner-title">Verifikasi Ditolak</div>
            <div class="verif-banner-text">${user.verifikasi_catatan || 'Silakan hubungi admin atau ajukan ulang verifikasi.'}</div>
            <button class="verif-banner-btn" onclick="showView('profil')">Ajukan Ulang →</button>
          </div>
        </div>`;
      if (balanceCard) balanceCard.style.marginTop = '12px';
    } else {
      banner.style.display = 'none';
      if (balanceCard) balanceCard.style.marginTop = '-28px';
    }

    // === Badge profil ===
    const profileBadges = document.getElementById('profileBadges');
    const badgeMap = {
      terverifikasi: `<span class="badge-verified"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Terverifikasi</span><span class="badge-penerima">Penerima Aktif</span>`,
      menunggu: `<span class="badge-verif-pending">⏳ Menunggu Verifikasi</span>`,
      ditolak: `<span class="badge-verif-tolak">✕ Verifikasi Ditolak</span>`,
      belum_verifikasi: `<span class="badge-verif-belum">Belum Diverifikasi</span>`
    };
    profileBadges.innerHTML = badgeMap[status] || badgeMap['belum_verifikasi'];

    // === Badge info row ===
    const verifBadgeEl = document.getElementById('pVerifBadge');
    const badgeInlineMap = {
      terverifikasi: `<span class="badge-verif-ok">✓ Terverifikasi</span>`,
      menunggu: `<span class="badge-verif-pending">⏳ Menunggu</span>`,
      ditolak: `<span class="badge-verif-tolak">✕ Ditolak</span>`,
      belum_verifikasi: `<span class="badge-verif-belum">Belum</span>`
    };
    verifBadgeEl.innerHTML = badgeInlineMap[status] || badgeInlineMap['belum_verifikasi'];

    // === Catatan penolakan ===
    const catatanBox = document.getElementById('catatanPenolakanBox');
    if (status === 'ditolak' && user.verifikasi_catatan) {
      catatanBox.style.display = 'block';
      catatanBox.innerHTML = `
        <div class="verif-banner ditolak" style="margin-bottom:12px;">
          <div class="verif-banner-icon">📋</div>
          <div class="verif-banner-body">
            <div class="verif-banner-title">Alasan Penolakan</div>
            <div class="verif-banner-text">${user.verifikasi_catatan}</div>
          </div>
        </div>`;
    } else {
      catatanBox.style.display = 'none';
    }

    // === Tombol ajukan verifikasi ===
    const ajukanBox = document.getElementById('ajukanVerifBox');
    if (status === 'belum_verifikasi' || status === 'ditolak') {
      ajukanBox.style.display = 'block';
      ajukanBox.innerHTML = `
        <div class="card" style="margin-bottom:12px; padding:20px;">
          <div style="font-size:13px; font-weight:800; color:#0f172a; margin-bottom:8px;">
            ${status === 'ditolak' ? '🔄 Ajukan Ulang Verifikasi' : '🛡️ Verifikasi KTP & Nama'}
          </div>
          <p style="font-size:12px; color:#64748b; line-height:1.6; margin-bottom:16px;">
            Data NIK KTP dan Nama Lengkap Anda akan dikirim ke admin untuk diverifikasi.
            Setelah disetujui, Anda dapat mencairkan dana.
          </p>
          <div style="background:#f8fafc; border-radius:10px; padding:12px; margin-bottom:16px; font-size:12px; color:#475569;">
            <div style="margin-bottom:6px;"><strong>Nama:</strong> ${user.nama_lengkap}</div>
            <div><strong>NIK KTP:</strong> ${user.nik_ktp}</div>
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-size:12px; font-weight:700; color:#0f172a; display:block; margin-bottom:8px;">
              📷 Foto KTP <span style="color:#dc2626;">*</span> <span style="font-weight:400; color:#64748b;">(wajib)</span>
            </label>
            <div id="ktpUploadArea"
              onclick="document.getElementById('ktpFotoInput').click()"
              style="border:2px dashed #cbd5e1; border-radius:10px; padding:20px; text-align:center; background:#f8fafc; cursor:pointer; transition:border-color 0.2s;">
              <div id="ktpUploadPlaceholder">
                <div style="font-size:32px; margin-bottom:6px;">🪪</div>
                <div style="font-size:12px; color:#0f172a; font-weight:700;">Tap untuk upload foto KTP</div>
                <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Format JPG / PNG · Maks 5MB</div>
              </div>
              <img id="ktpPreviewImg" style="display:none; max-width:100%; max-height:180px; border-radius:8px; object-fit:cover;" />
            </div>
            <input type="file" id="ktpFotoInput" accept="image/*" style="display:none;" onchange="previewKTPFoto(this)">
            <p id="ktpErrorMsg" style="display:none; font-size:11px; color:#dc2626; margin-top:6px;">⚠️ Foto KTP wajib diupload sebelum mengajukan verifikasi.</p>
          </div>
          <button id="ajukanBtn" onclick="ajukanVerifikasi()"
            style="width:100%; padding:13px; background:linear-gradient(135deg,#2563eb,#1e40af); color:#fff; border:none; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; box-shadow:0 6px 16px rgba(37,99,235,0.28);">
            <span id="ajukanBtnText">Ajukan Verifikasi</span>
          </button>
        </div>`;
    } else if (status === 'menunggu') {
      ajukanBox.style.display = 'block';
      ajukanBox.innerHTML = `
        <div class="verif-banner menunggu" style="margin-bottom:12px;">
          <div class="verif-banner-icon">🔄</div>
          <div class="verif-banner-body">
            <div class="verif-banner-title">Sedang Diproses</div>
            <div class="verif-banner-text">Pengajuan verifikasi Anda sedang ditinjau oleh admin. Harap bersabar.</div>
          </div>
        </div>`;
    } else {
      ajukanBox.style.display = 'none';
    }

    // === Panel cairkan dana ===
    renderTarikPanel(status, user.verifikasi_catatan);
  }

  function renderTarikPanel(status, catatan) {
    const blocked = document.getElementById('tarikBlockedPanel');
    const formPanel = document.getElementById('tarikFormPanel');
    const content = document.getElementById('tarikBlockedContent');

    if (status === 'terverifikasi') {
      blocked.style.display = 'none';
      formPanel.style.display = 'block';
    } else {
      blocked.style.display = 'block';
      formPanel.style.display = 'none';

      const msgs = {
        belum_verifikasi: {
          icon: '🔒',
          title: 'Verifikasi Diperlukan',
          text: 'Anda harus memverifikasi KTP & Nama terlebih dahulu sebelum dapat mencairkan dana pinjaman.',
          btn: 'Verifikasi Sekarang',
          action: "showView('profil')"
        },
        menunggu: {
          icon: '⏳',
          title: 'Verifikasi Sedang Diproses',
          text: 'Pengajuan verifikasi Anda sedang ditinjau oleh admin. Harap tunggu persetujuan sebelum melakukan pencairan.',
          btn: null,
          action: null
        },
        ditolak: {
          icon: '❌',
          title: 'Verifikasi Ditolak',
          text: catatan ? `Alasan: ${catatan}. Silakan ajukan ulang verifikasi Anda.` : 'Verifikasi Anda ditolak. Silakan ajukan ulang di halaman Profil.',
          btn: 'Ajukan Ulang',
          action: "showView('profil')"
        }
      };

      const m = msgs[status] || msgs['belum_verifikasi'];
      content.innerHTML = `
        <div class="tarik-blocked">
          <div class="tarik-blocked-icon">${m.icon}</div>
          <div class="tarik-blocked-title">${m.title}</div>
          <div class="tarik-blocked-text">${m.text}</div>
          ${m.btn ? `<button class="tarik-blocked-btn" onclick="${m.action}">${m.btn}</button>` : ''}
        </div>`;
    }
  }

  /* ---- Preview & Kompres Foto KTP ---- */
  function previewKTPFoto(input) {
    const file = input.files[0];
    if (!file) return;

    // Validasi ukuran file
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ukuran file maksimal 5MB.', 'error');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const placeholder = document.getElementById('ktpUploadPlaceholder');
      const preview = document.getElementById('ktpPreviewImg');
      const errMsg = document.getElementById('ktpErrorMsg');
      const uploadArea = document.getElementById('ktpUploadArea');
      if (placeholder) placeholder.style.display = 'none';
      if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
      if (errMsg) errMsg.style.display = 'none';
      if (uploadArea) uploadArea.style.borderColor = '#16a34a';
    };
    reader.readAsDataURL(file);
  }

  function compressToBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_W = 800;
          const scale = Math.min(1, MAX_W / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---- Ajukan Verifikasi ---- */
  async function ajukanVerifikasi() {
    const btn = document.getElementById('ajukanBtn');
    const btnText = document.getElementById('ajukanBtnText');
    if (!btn) return;

    // Validasi foto KTP wajib
    const ktpInput = document.getElementById('ktpFotoInput');
    const errMsg = document.getElementById('ktpErrorMsg');
    if (!ktpInput || !ktpInput.files[0]) {
      if (errMsg) errMsg.style.display = 'block';
      const uploadArea = document.getElementById('ktpUploadArea');
      if (uploadArea) uploadArea.style.borderColor = '#dc2626';
      showToast('Foto KTP wajib diupload!', 'error');
      return;
    }

    btn.disabled = true;
    btnText.textContent = '⏳ Mengupload...';

    try {
      // Kompres gambar sebelum kirim
      const base64 = await compressToBase64(ktpInput.files[0]);

      const token = localStorage.getItem('token');
      const res = await fetch('/api/verifikasi/ajukan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ktp_foto_base64: base64 })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || 'Gagal mengajukan verifikasi.', 'error');
        btn.disabled = false;
        btnText.textContent = 'Ajukan Verifikasi';
        return;
      }

      showToast('Pengajuan verifikasi berhasil dikirim!', 'success');
      // Refresh user data
      const user = await getUserData();
      if (user) {
        userVerifStatus = user.verifikasi_status;
        renderVerifUI(user);
      }
    } catch (err) {
      showToast('Tidak bisa terhubung ke server.', 'error');
      btn.disabled = false;
      btnText.textContent = 'Ajukan Verifikasi';
    }
  }

  /* ---- Edit Nama ---- */
  function toggleEditNama() {
    if (userVerifStatus === 'terverifikasi') {
      showToast('Nama tidak dapat diubah setelah akun terverifikasi.', 'error');
      return;
    }
    const form = document.getElementById('editNamaForm');
    const input = document.getElementById('editNamaInput');
    const namaTeks = document.getElementById('pNama').textContent;
    form.style.display = 'block';
    input.value = namaTeks;
    input.focus();
    input.select();
  }

  function batalEditNama() {
    document.getElementById('editNamaForm').style.display = 'none';
  }

  async function simpanNama() {
    const btn = document.getElementById('simpanNamaBtn');
    const btnText = document.getElementById('simpanNamaBtnText');
    const input = document.getElementById('editNamaInput');
    const namaBaru = input.value.trim();

    if (!namaBaru) { showToast('Nama tidak boleh kosong.', 'error'); return; }
    if (namaBaru.length < 3) { showToast('Nama minimal 3 karakter.', 'error'); return; }

    btn.disabled = true;
    btnText.textContent = 'Menyimpan...';

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_lengkap: namaBaru })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || 'Gagal menyimpan nama.', 'error');
        btn.disabled = false;
        btnText.textContent = 'Simpan';
        return;
      }

      // Update tampilan langsung
      document.getElementById('pNama').textContent = namaBaru;
      document.getElementById('greeting').textContent = 'Halo, ' + namaBaru.split(' ')[0];
      const balanceName = document.getElementById('balanceName');
      if (balanceName) balanceName.textContent = namaBaru;
      const headerInitial = document.getElementById('headerInitial');
      if (headerInitial) headerInitial.textContent = namaBaru[0].toUpperCase();
      const profileInitials = document.getElementById('profileInitials');
      if (profileInitials) {
        const parts = namaBaru.trim().split(/\s+/);
        profileInitials.textContent = parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : parts[0][0].toUpperCase();
      }

      batalEditNama();
      showToast('Nama berhasil diperbarui!', 'success');
    } catch (err) {
      showToast('Tidak bisa terhubung ke server.', 'error');
      btn.disabled = false;
      btnText.textContent = 'Simpan';
    }
  }

  function showView(name) {
    sessionStorage.setItem('halamanTerakhir', name);
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById('view-' + name).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-view="${name}"]`);
    if (navItem) navItem.classList.add('active');

    if (name === 'topup') {
      document.getElementById('tarikSaldoDisplay').textContent =
        'Rp ' + userSaldoSaatIni.toLocaleString('id-ID');
      document.getElementById('nominalInput').value = '';
      document.getElementById('tarikError').textContent = '';
      document.getElementById('sisaSaldoRow').style.display = 'none';
      document.getElementById('nominalWrap').classList.remove('input-error');
      updateTarikStep(1);
    }
  }

  // ==== Helpers Riwayat ====
  function formatTanggal(isoString) {
    const d = new Date(isoString);
    const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return tgl + ' · ' + jam;
  }

  function buatItemTrx(trx) {
    const isOut = trx.jenis === 'tarik';
    const status = trx.status || 'approved';
    const isPengembalian = !isOut && trx.keterangan && trx.keterangan.startsWith('Pengembalian dana:');
    let statusBadge = '';
    if (isOut && status === 'pending') {
      statusBadge = `<span class="trx-status-badge pending">⏳ Sedang Diproses</span>`;
    } else if (isOut && status === 'rejected') {
      statusBadge = `<span class="trx-status-badge rejected">✕ Ditolak</span>`;
    }
    const namaLabel = isOut ? 'Cairkan Dana' : (isPengembalian ? 'Pengembalian Saldo' : 'Tambah Saldo');
    const iconLabel = isOut ? '💸' : (isPengembalian ? '🔄' : '💰');
    return `
      <div class="trx-item trx-item-clickable trx-item-js" style="cursor:pointer;" data-trx-json=""
        data-trx-jenis="${trx.jenis}" data-trx-nominal="${trx.nominal}" data-trx-status="${trx.status||'approved'}"
        data-trx-saldo="${trx.saldo_sesudah||0}" data-trx-ket="${encodeURIComponent(trx.keterangan||'')}" data-trx-at="${trx.created_at}" data-trx-id="${trx.id||''}">
        <div class="trx-icon ${trx.jenis === 'tarik' && status === 'pending' ? 'pending' : trx.jenis}">${iconLabel}</div>
        <div class="trx-info">
          <div class="trx-nama">${namaLabel}</div>
          <div class="trx-tanggal">${formatTanggal(trx.created_at)}</div>
          ${statusBadge}
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="trx-amount ${trx.jenis === 'tarik' && status === 'pending' ? 'pending' : trx.jenis}">
            ${isOut ? '−' : '+'}Rp ${trx.nominal.toLocaleString('id-ID')}
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
        </div>
      </div>`;
  }

  function skeletonHTML(n) {
    return Array(n).fill(`
      <div class="skeleton-item">
        <div class="skeleton-icon"></div>
        <div class="skeleton-text">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
        <div class="skeleton-amount"></div>
      </div>`).join('');
  }

  async function fetchRiwayat(offset) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/riwayat?limit=${RIWAYAT_LIMIT}&offset=${offset}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Gagal fetch');
    return await res.json();
  }

  function bukaRiwayat() {
    semuaRiwayat = [];
    riwayatOffset = 0;
    riwayatHabis = false;
    showView('riwayat');
    loadRiwayat();
  }

  // ===== AKTIVITAS (dari navbar) =====
  let aktivitasOffset = 0;
  let aktivitasHabis = false;
  let semuaAktivitas = [];

  function bukaAktivitas() {
    semuaAktivitas = [];
    aktivitasOffset = 0;
    aktivitasHabis = false;
    showView('aktivitas');
    loadAktivitas();
  }

  async function loadAktivitas() {
    const listEl = document.getElementById('aktivitasList');
    const loadMoreBtn = document.getElementById('loadMoreAktivitasBtn');

    if (aktivitasOffset === 0) {
      listEl.innerHTML = `<div class="card trx-list-card"><div class="trx-list">${skeletonHTML(5)}</div></div>`;
    }
    if (loadMoreBtn) loadMoreBtn.disabled = true;

    try {
      const data = await fetchRiwayat(aktivitasOffset);
      if (data.length < RIWAYAT_LIMIT) aktivitasHabis = true;
      semuaAktivitas = [...semuaAktivitas, ...data];
      aktivitasOffset += data.length;

      if (semuaAktivitas.length === 0) {
        listEl.innerHTML = `
          <div class="card empty-state">
            <div class="empty-icon">📊</div>
            <p>Belum ada aktivitas</p>
            <span>Semua transaksi Anda akan muncul di sini</span>
          </div>`;
      } else {
        listEl.innerHTML = `<div class="card trx-list-card"><div class="trx-list">${semuaAktivitas.map(buatItemTrx).join('')}</div></div>`;
        pasangEventTrx(listEl, semuaAktivitas);
      }

      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.style.display = aktivitasHabis ? 'none' : 'block';
      }
    } catch (e) {
      listEl.innerHTML = `<p class="error" style="text-align:center;padding:12px">Gagal memuat aktivitas</p>`;
    }
  }

  // ===== NOTIFIKASI =====
  async function bukaNotifikasi() {
    showView('notifikasi');
    // Sembunyikan dot setelah dibuka
    const dot = document.getElementById('notifDot');
    if (dot) dot.style.display = 'none';
    await loadNotifikasi();
  }

  async function loadNotifikasi() {
    const listEl = document.getElementById('notifList');
    const token = localStorage.getItem('token');
    try {
      // Ambil notifikasi Admin/Sistem + riwayat transaksi secara paralel
      const [notifAdminRes, trxData] = await Promise.all([
        fetch('/api/notifikasi', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetchRiwayat(0)
      ]);
      const notifAdmin = notifAdminRes.ok ? await notifAdminRes.json() : [];

      // --- Notifikasi dari Admin / Sistem ---
      const ikonMap = { info:'📢', success:'✅', warning:'⚠️', promo:'🎁' };
      const bgAdminMap = { info:'notif-item-masuk', success:'notif-item-success', warning:'notif-item-pending', promo:'notif-item-masuk' };

      const itemsAdmin = (notifAdmin || []).map(n => {
        const d = new Date(n.created_at);
        const tgl = d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
        const jam = d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
        const belumDibaca = !n.dibaca;
        return {
          waktu: d,
          notifId: n.id,
          html: `
            <div class="notif-item notif-item-admin ${bgAdminMap[n.tipe] || 'notif-item-masuk'}" data-notif-id="${n.id}" style="${belumDibaca ? 'border-left:3px solid #2563eb;' : ''}">
              <div class="notif-item-icon">${ikonMap[n.tipe] || '📢'}</div>
              <div class="notif-item-body">
                <div class="notif-item-judul" style="${belumDibaca ? 'color:#1e40af;' : ''}">${n.judul}${belumDibaca ? ' <span style="background:#2563eb;color:#fff;font-size:9px;border-radius:4px;padding:1px 5px;vertical-align:middle;">BARU</span>' : ''}</div>
                <div class="notif-item-pesan" style="white-space:normal;overflow:visible;">${n.pesan}</div>
                <div class="notif-item-waktu">${tgl} · ${jam}</div>
              </div>
            </div>`
        };
      });

      // --- Notifikasi otomatis dari transaksi TARIK saja ---
      const tarikConfig = {
        pending:  { icon: '⏳', judul: 'Pencairan Sedang Diproses', bg: 'notif-item-pending',  warna: '#d97706', pesan: (trx) => `Pencairan Rp ${trx.nominal.toLocaleString('id-ID')} sedang diproses oleh admin.` },
        approved: { icon: '✅', judul: 'Pencairan Berhasil',         bg: 'notif-item-success', warna: '#16a34a', pesan: (trx) => `Pencairan Rp ${trx.nominal.toLocaleString('id-ID')} telah disetujui dan dikirim.` },
        rejected: { icon: '❌', judul: 'Pencairan Ditolak',          bg: 'notif-item-rejected', warna: '#dc2626', pesan: (trx) => {
          const bagian = (trx.keterangan || '').split('\n[Alasan: ');
          const alasan = bagian[1] ? bagian[1].replace(/\]$/, '') : '';
          return alasan
            ? `Pencairan Rp ${trx.nominal.toLocaleString('id-ID')} ditolak. Alasan: ${alasan}`
            : `Pencairan Rp ${trx.nominal.toLocaleString('id-ID')} ditolak.`;
        }}
      };

      const itemsTarik = (trxData || [])
        .filter(trx => trx.jenis === 'tarik')
        .map(trx => {
          const cfg = tarikConfig[trx.status];
          if (!cfg) return null;
          const d = new Date(trx.created_at);
          const tgl = d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
          const jam = d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
          return {
            waktu: d,
            trxData: trx,
            html: `
              <div class="notif-item notif-item-trx ${cfg.bg}" style="cursor:pointer;">
                <div class="notif-item-icon">${cfg.icon}</div>
                <div class="notif-item-body">
                  <div class="notif-item-judul" style="color:${cfg.warna};">${cfg.judul}</div>
                  <div class="notif-item-pesan" style="white-space:normal;overflow:visible;">${cfg.pesan(trx)}</div>
                  <div class="notif-item-waktu">${tgl} · ${jam}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
              </div>`
          };
        })
        .filter(Boolean);

      // Gabung & urutkan berdasarkan waktu terbaru
      const semua = [...itemsAdmin, ...itemsTarik].sort((a, b) => b.waktu - a.waktu);

      if (semua.length === 0) {
        listEl.innerHTML = `
          <div class="card empty-state">
            <div class="empty-icon">🔔</div>
            <p>Belum ada notifikasi</p>
            <span>Pesan dari Sistem, Admin, dan status pencairan akan muncul di sini</span>
          </div>`;
        return;
      }

      listEl.innerHTML = `<div class="card" style="padding:8px 6px;">${semua.map(x => x.html).join('')}</div>`;

      // Event listener: notif tarik → buka detail modal
      const trxItems = listEl.querySelectorAll('.notif-item-trx');
      const trxMap = semua.filter(x => x.trxData);
      let trxIdx = 0;
      trxItems.forEach(el => {
        const trx = trxMap[trxIdx]?.trxData;
        if (trx) el.addEventListener('click', () => bukaDetailTrx(trx));
        trxIdx++;
      });

      // Event listener: notif admin → tandai baca
      listEl.querySelectorAll('.notif-item-admin').forEach(el => {
        el.addEventListener('click', () => tandaiBacaNotif(el.dataset.notifId, el));
      });

    } catch (e) {
      listEl.innerHTML = `<p class="error" style="text-align:center;padding:12px">Gagal memuat notifikasi</p>`;
    }
  }

  async function tandaiBacaNotif(id, elParent) {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifikasi/${id}/baca`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Hapus badge "BARU" dan border biru
      elParent.style.borderLeft = '';
      const judulEl = elParent.querySelector('.notif-item-judul');
      if (judulEl) {
        const badge = judulEl.querySelector('span');
        if (badge) badge.remove();
        judulEl.style.color = '';
      }
    } catch(e) {}
  }

  async function loadRiwayat() {
    const listEl = document.getElementById('riwayatList');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (riwayatOffset === 0) {
      listEl.innerHTML = `<div class="card trx-list-card"><div class="trx-list">${skeletonHTML(5)}</div></div>`;
    }
    if (loadMoreBtn) loadMoreBtn.disabled = true;

    try {
      const data = await fetchRiwayat(riwayatOffset);
      if (data.length < RIWAYAT_LIMIT) riwayatHabis = true;
      semuaRiwayat = [...semuaRiwayat, ...data];
      riwayatOffset += data.length;

      if (semuaRiwayat.length === 0) {
        listEl.innerHTML = `
          <div class="card empty-state">
            <div class="empty-icon">🧾</div>
            <p>Belum ada riwayat transaksi</p>
            <span>Transaksi Anda akan muncul di sini</span>
          </div>`;
      } else {
        listEl.innerHTML = `<div class="card trx-list-card"><div class="trx-list">${semuaRiwayat.map(buatItemTrx).join('')}</div></div>`;
        pasangEventTrx(listEl, semuaRiwayat);
      }

      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.style.display = riwayatHabis ? 'none' : 'block';
      }
    } catch (e) {
      listEl.innerHTML = `<p class="error" style="text-align:center;padding:12px">Gagal memuat riwayat</p>`;
    }
  }

  function onNominalManualInput() {
    document.querySelectorAll('.quick-grid .chip').forEach(c => c.classList.remove('chip-selected'));
    updateSisaSaldo();
  }

  function updateTarikStep(activeStep) {
    const steps = document.querySelectorAll('.tarik-steps .tarik-step');
    steps.forEach((el, i) => {
      el.classList.toggle('is-upcoming', (i + 1) > activeStep);
    });
  }

  function setNominal(val, btnEl) {
    document.getElementById('nominalInput').value = val;
    document.getElementById('tarikError').textContent = '';
    document.getElementById('nominalWrap').classList.remove('input-error');
    document.querySelectorAll('.quick-grid .chip').forEach(c => c.classList.remove('chip-selected'));
    if (btnEl) btnEl.classList.add('chip-selected');
    updateSisaSaldo();
  }

  function setNominalSemua(btnEl) {
    setNominal(userSaldoSaatIni, btnEl);
  }

  function updateSisaSaldo() {
    const nominal = parseInt(document.getElementById('nominalInput').value) || 0;
    const sisaRow = document.getElementById('sisaSaldoRow');
    const sisaVal = document.getElementById('sisaSaldoVal');

    if (nominal > 0) {
      sisaRow.style.display = 'flex';
      const sisa = userSaldoSaatIni - nominal;
      sisaVal.textContent = 'Rp ' + Math.max(0, sisa).toLocaleString('id-ID');
      sisaVal.className = 'sisa-value' + (sisa < 0 ? ' sisa-warning' : '');
    } else {
      sisaRow.style.display = 'none';
    }
  }

  function bukaMetodePencairan() {
    const nominalInput = document.getElementById('nominalInput');
    const tarikError = document.getElementById('tarikError');
    const nominal = parseInt(nominalInput.value);
    const wrap = document.getElementById('nominalWrap');

    tarikError.textContent = '';
    wrap.classList.remove('input-error');

    if (!nominal || nominal <= 0) {
      tarikError.textContent = '⚠ Masukkan nominal yang valid.';
      wrap.classList.add('input-error');
      return;
    }
    if (nominal < 10000) {
      tarikError.textContent = '⚠ Minimal pencairan adalah Rp 10.000.';
      wrap.classList.add('input-error');
      return;
    }
    if (nominal > userSaldoSaatIni) {
      tarikError.textContent = '⚠ Nominal melebihi saldo tersedia.';
      wrap.classList.add('input-error');
      return;
    }

    // Reset modal metode
    metodeTerpilih = null;
    document.getElementById('formEwallet').style.display = 'none';
    document.getElementById('formBank').style.display = 'none';
    document.getElementById('metodeError').textContent = '';
    document.getElementById('metodeEwallet').classList.remove('metode-card-active');
    document.getElementById('metodeBank').classList.remove('metode-card-active');
    document.getElementById('selectEwallet').value = '';
    document.getElementById('inputNomorEwallet').value = '';
    document.getElementById('selectBank').value = '';
    document.getElementById('inputNomorRekening').value = '';
    document.getElementById('inputAtasNama').value = '';
    document.getElementById('modalMetode').style.display = 'flex';
    updateTarikStep(2);
  }

  function pilihMetode(metode) {
    metodeTerpilih = metode;
    document.getElementById('metodeEwallet').classList.toggle('metode-card-active', metode === 'ewallet');
    document.getElementById('metodeBank').classList.toggle('metode-card-active', metode === 'bank');
    document.getElementById('formEwallet').style.display = metode === 'ewallet' ? 'block' : 'none';
    document.getElementById('formBank').style.display = metode === 'bank' ? 'block' : 'none';
    document.getElementById('metodeError').textContent = '';
  }

  function tutupMetode() {
    document.getElementById('modalMetode').style.display = 'none';
  }

  function lanjutkanKonfirmasi() {
    const errEl = document.getElementById('metodeError');
    errEl.textContent = '';

    if (!metodeTerpilih) {
      errEl.textContent = '⚠ Pilih metode pencairan terlebih dahulu.';
      return;
    }

    let labelMetode = '', labelTujuan = '';

    if (metodeTerpilih === 'ewallet') {
      const ewallet = document.getElementById('selectEwallet').value;
      const nomor = document.getElementById('inputNomorEwallet').value.trim();
      if (!ewallet) { errEl.textContent = '⚠ Pilih jenis e-wallet.'; return; }
      if (!nomor || nomor.length < 8) { errEl.textContent = '⚠ Masukkan nomor e-wallet yang valid.'; return; }
      labelMetode = '📱 ' + ewallet;
      labelTujuan = nomor;
    } else {
      const bank = document.getElementById('selectBank').value;
      const norek = document.getElementById('inputNomorRekening').value.trim();
      const atasNama = document.getElementById('inputAtasNama').value.trim();
      if (!bank) { errEl.textContent = '⚠ Pilih bank tujuan.'; return; }
      if (!norek || norek.length < 6) { errEl.textContent = '⚠ Masukkan nomor rekening yang valid.'; return; }
      if (!atasNama) { errEl.textContent = '⚠ Masukkan nama pemilik rekening.'; return; }
      labelMetode = '🏦 Bank ' + bank;
      labelTujuan = norek + ' (' + atasNama + ')';
    }

    // Isi modal konfirmasi
    const nominal = parseInt(document.getElementById('nominalInput').value);
    const sisa = userSaldoSaatIni - nominal;
    document.getElementById('modalNominal').textContent = 'Rp ' + nominal.toLocaleString('id-ID');
    document.getElementById('modalSisa').textContent = 'Rp ' + sisa.toLocaleString('id-ID');
    document.getElementById('modalMetodeLabel').textContent = labelMetode;
    document.getElementById('modalTujuan').textContent = labelTujuan;

    updateTarikStep(3);
    tutupMetode();
    // Reset checkbox & tombol setiap kali modal dibuka
    const cb = document.getElementById('checkboxSudahBayar');
    const btn = document.getElementById('konfirmasiSudahBayarBtn');
    if (cb) cb.checked = false;
    if (btn) {
      btn.disabled = true;
      btn.style.background = '#94a3b8';
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.6';
    }

    // Tampilkan modal materai & pajak sebelum konfirmasi
    document.getElementById('modalQris').style.display = 'flex';
  }

  function bukaKonfirmasi() {
    bukaMetodePencairan();
  }

  function tutupKonfirmasi() {
    document.getElementById('modalOverlay').style.display = 'none';
  }

  function tutupQris() {
    document.getElementById('modalQris').style.display = 'none';
  }

  function tutupMenunggu() {
    document.getElementById('modalMenunggu').style.display = 'none';
    showView('beranda');
  }

  function toggleKonfirmasiBtn() {
    const cb = document.getElementById('checkboxSudahBayar');
    const btn = document.getElementById('konfirmasiSudahBayarBtn');
    if (!cb || !btn) return;
    if (cb.checked) {
      btn.disabled = false;
      btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
      btn.style.cursor = 'pointer';
      btn.style.opacity = '1';
    } else {
      btn.disabled = true;
      btn.style.background = '#94a3b8';
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.6';
    }
  }

  function konfirmasiSudahBayar() {
    // Cek checkbox harus dicentang (proteksi lapis kedua)
    const cb = document.getElementById('checkboxSudahBayar');
    if (!cb || !cb.checked) {
      showToast('⚠️ Centang konfirmasi pembayaran terlebih dahulu.', 'error');
      return;
    }
    // Dialog konfirmasi ganda agar tidak salah klik
    const yakin = confirm(
      'Apakah Anda sudah BENAR-BENAR membayar Rp 30.000 (Materai 2 lembar + Pajak) via QRIS?\n\n' +
      'Klik OK jika sudah bayar, atau Batal jika belum.'
    );
    if (!yakin) return;
    // Sembunyikan modal QRIS, tampilkan modal konfirmasi pencairan
    tutupQris();
    document.getElementById('modalOverlay').style.display = 'flex';
  }

  async function prosesTarik() {
    const nominal = parseInt(document.getElementById('nominalInput').value);
    const confirmBtn = document.getElementById('confirmTarikBtn');
    confirmBtn.textContent = 'Memproses...';
    confirmBtn.disabled = true;

    // Kumpulkan info metode pencairan
    let keteranganMetode = 'Pencairan saldo';
    if (metodeTerpilih === 'ewallet') {
      const ewallet = document.getElementById('selectEwallet').value;
      const nomor = document.getElementById('inputNomorEwallet').value.trim();
      keteranganMetode = `E-Wallet ${ewallet} - ${nomor}`;
    } else if (metodeTerpilih === 'bank') {
      const bank = document.getElementById('selectBank').value;
      const norek = document.getElementById('inputNomorRekening').value.trim();
      const atasNama = document.getElementById('inputAtasNama').value.trim();
      keteranganMetode = `Bank ${bank} - ${norek} (${atasNama})`;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tarik', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nominal, keterangan: keteranganMetode })
      });
      const data = await res.json();

      if (!res.ok) {
        tutupKonfirmasi();
        // Jika ditolak karena verifikasi
        if (res.status === 403 && data.verifikasi_status) {
          showToast(data.message, 'error');
          renderTarikPanel(data.verifikasi_status, null);
        } else {
          showToast(data.message || 'Gagal memproses pencairan.', 'error');
        }
        confirmBtn.textContent = 'Ya, Tarik';
        confirmBtn.disabled = false;
        return;
      }

      userSaldoSaatIni = data.saldo;
      const saldoFmt = 'Rp ' + data.saldo.toLocaleString('id-ID');
      document.getElementById('saldoAmount').textContent = saldoFmt;
      document.getElementById('tarikSaldoDisplay').textContent = saldoFmt;
      document.getElementById('nominalInput').value = '';
      document.getElementById('sisaSaldoRow').style.display = 'none';

      tutupKonfirmasi();
      // Tampilkan modal menunggu persetujuan
      document.getElementById('modalMenunggu').style.display = 'flex';
    } catch (err) {
      tutupKonfirmasi();
      showToast('Tidak bisa terhubung ke server.', 'error');
    }

    confirmBtn.textContent = 'Ya, Tarik';
    confirmBtn.disabled = false;
  }

  // Pasang event listener ke semua .trx-item-js di dalam container
  function pasangEventTrx(container, dataArr) {
    const els = container.querySelectorAll('.trx-item-js');
    els.forEach((el, i) => {
      const trx = dataArr[i];
      if (trx) el.addEventListener('click', () => bukaDetailTrx(trx));
    });
  }

  function bukaDetailTrx(trxOrEncoded) {
    // Terima objek langsung (dari event listener) atau string encoded (dari onclick lama)
    const trx = (typeof trxOrEncoded === 'object') ? trxOrEncoded : JSON.parse(decodeURIComponent(trxOrEncoded));
    const isOut = trx.jenis === 'tarik';
    const status = trx.status || 'approved';
    const isPengembalian = !isOut && trx.keterangan && trx.keterangan.startsWith('Pengembalian dana:');

    const statusMap = {
      approved: { label: '✅ Berhasil', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
      pending:  { label: '⏳ Sedang Diproses', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      rejected: { label: '❌ Ditolak', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
    };
    const st = statusMap[status] || statusMap['approved'];

    const d = new Date(trx.created_at);
    const tglLengkap = d.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const jam = d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

    // Parse keterangan — pisah antara tujuan transfer dan alasan penolakan
    let infoMetode = '';
    let alasanPenolakan = '';
    if (trx.keterangan) {
      const bagian = trx.keterangan.split('\n[Alasan: ');
      const metodePart = bagian[0];
      alasanPenolakan = bagian[1] ? bagian[1].replace(/\]$/, '') : '';
      if (metodePart && metodePart !== 'Pencairan saldo') {
        infoMetode = `
        <div class="detail-row">
          <span class="detail-lbl">Tujuan Transfer</span>
          <span class="detail-val" style="text-align:right;max-width:55%;">${metodePart}</span>
        </div>`;
      }
    }

    document.getElementById('modalDetailTrx').innerHTML = `
      <div class="modal-box" style="max-height:88vh;overflow-y:auto;">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:44px;margin-bottom:8px;">${isOut ? '💸' : (isPengembalian ? '🔄' : '💰')}</div>
          <div style="font-size:13px;color:#64748b;margin-bottom:4px;">${isOut ? 'Cairkan Dana' : (isPengembalian ? 'Pengembalian Saldo' : 'Tambah Saldo')}</div>
          <div style="font-size:28px;font-weight:800;color:${isOut ? '#dc2626' : '#16a34a'};">
            ${isOut ? '−' : '+'}Rp ${trx.nominal.toLocaleString('id-ID')}
          </div>
        </div>

        <!-- Status Badge -->
        <div style="background:${st.bg};border:1.5px solid ${st.border};border-radius:10px;padding:10px 14px;text-align:center;margin-bottom:18px;">
          <span style="font-size:13px;font-weight:700;color:${st.color};">${st.label}</span>
        </div>

        <!-- Detail Rows -->
        <div style="background:#f8fafc;border-radius:14px;padding:4px 0;margin-bottom:18px;">
          <div class="detail-row">
            <span class="detail-lbl">Jenis</span>
            <span class="detail-val">${isOut ? 'Pencairan' : (isPengembalian ? 'Pengembalian' : 'Penambahan')} Saldo</span>
          </div>
          <div class="detail-row">
            <span class="detail-lbl">Tanggal</span>
            <span class="detail-val" style="text-align:right;max-width:55%;">${tglLengkap}</span>
          </div>
          <div class="detail-row">
            <span class="detail-lbl">Waktu</span>
            <span class="detail-val">${jam} WIB</span>
          </div>
          ${trx.id ? `<div class="detail-row">
            <span class="detail-lbl">ID Transaksi</span>
            <span class="detail-val" style="font-family:monospace;font-size:11px;color:#64748b;">#${trx.id}</span>
          </div>` : ''}
          ${infoMetode}
        </div>

        ${status === 'pending' ? `
        <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px 14px;margin-bottom:18px;">
          <div style="font-size:12px;color:#92400e;line-height:1.6;">
            🕐 Pencairan Anda sedang diproses oleh admin.<br>Estimasi proses: <strong>1×24 jam</strong>.
          </div>
        </div>` : ''}

        ${status === 'rejected' && alasanPenolakan ? `
        <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:12px 14px;margin-bottom:18px;">
          <div style="font-size:12px;color:#991b1b;line-height:1.6;">
            ❌ Alasan Penolakan: <strong>${alasanPenolakan}</strong>
          </div>
        </div>` : ''}

        <button onclick="document.getElementById('modalDetailTrxWrap').style.display='none'"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#1e40af,#2563eb);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
          Tutup
        </button>
      </div>`;

    document.getElementById('modalDetailTrxWrap').style.display = 'flex';
  }

  async function cekNotifikasiAktif() {
    try {
      const token = localStorage.getItem('token');
      // Cek notif admin belum dibaca + pencairan pending/rejected
      const [notifRes, trxData] = await Promise.all([
        fetch('/api/notifikasi', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetchRiwayat(0)
      ]);
      const adaNotifBaru = notifRes.ok && (await notifRes.json()).some(n => !n.dibaca);
      const adaTarikAktif = (trxData || []).some(t => t.jenis === 'tarik' && (t.status === 'pending' || t.status === 'rejected'));
      if (adaNotifBaru || adaTarikAktif) {
        const dot = document.getElementById('notifDot');
        if (dot) dot.style.display = 'block';
      }
    } catch (e) { /* ignore */ }
  }

  function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + (type === 'error' ? 'toast-error' : 'toast-success');
    setTimeout(() => { toast.className = 'toast'; }, 3500);
  }

  function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'index.html';
  }
