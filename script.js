const API_URL = '';

// ==== Form Login ====
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const nikKtp = document.getElementById('loginNik').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');
    errorMsg.textContent = '';
    loginBtn.classList.add('btn-loading');
    loginBtn.querySelector('.btn-text').textContent = 'Memproses...';

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nikKtp, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.message || 'Login gagal.';
        loginBtn.classList.remove('btn-loading');
        loginBtn.querySelector('.btn-text').textContent = 'Masuk';
        return;
      }

      if (data.isAdmin) {
        // Login admin → simpan adminToken, redirect ke dashboard admin
        localStorage.setItem('adminToken', data.token);
        window.location.href = 'admin.html';
      } else {
        // Login user biasa
        localStorage.setItem('token', data.token);
        window.location.href = 'app.html';
      }
    } catch (err) {
      errorMsg.textContent = 'Tidak bisa terhubung ke server.';
      loginBtn.classList.remove('btn-loading');
      loginBtn.querySelector('.btn-text').textContent = 'Masuk';
    }
  });
}

// ==== Form Daftar ====
const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const namaLengkap = document.getElementById('namaLengkap').value.trim();
    const nikKtp = document.getElementById('registerNik').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errorMsg = document.getElementById('errorMsg');
    const registerBtn = document.getElementById('registerBtn');
    errorMsg.textContent = '';
    registerBtn.classList.add('btn-loading');
    registerBtn.querySelector('.btn-text').textContent = 'Memproses...';

    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaLengkap, nikKtp, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.message || 'Pendaftaran gagal.';
        registerBtn.classList.remove('btn-loading');
        registerBtn.querySelector('.btn-text').textContent = 'Daftar';
        return;
      }

      localStorage.setItem('token', data.token);
      window.location.href = 'app.html';
    } catch (err) {
      errorMsg.textContent = 'Tidak bisa terhubung ke server.';
      registerBtn.classList.remove('btn-loading');
      registerBtn.querySelector('.btn-text').textContent = 'Daftar';
    }
  });
}

// ==== Fungsi bantu (dipakai app.html) ====
async function getUserData() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/api/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      window.location.href = 'index.html';
      return null;
    }
    return await res.json();
  } catch (err) {
    window.location.href = 'index.html';
    return null;
  }
}

function requireLogin() {
  if (!localStorage.getItem('token')) {
    window.location.href = 'index.html';
  }
}
