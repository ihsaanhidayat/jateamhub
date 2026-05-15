# JateamHub — Deployment Guide

## Run Lokal

```bash
npm install
npm run dev
# → http://localhost:5173
```

## Build

```bash
npm run build
# Output: dist/

npm run preview
# Preview dist/ di http://localhost:4173
```

---

## Deploy ke Cloudflare Pages (Rekomendasi)

### Langkah 1 — Push ke GitHub

```bash
git init
git add .
git commit -m "JateamHub MVP"
git remote add origin https://github.com/ihsaanhidayat/jateamhub.git
git push -u origin main
```

### Langkah 2 — Hubungkan ke Cloudflare Pages

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pilih **Workers & Pages** → **Create application** → **Pages**
3. Connect ke GitHub repo kamu
4. Set build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Klik **Save and Deploy**
6. Tunggu deploy selesai → dapat URL `*.pages.dev`

### Langkah 3 — Setup Cloudflare Zero Trust Access (Opsional tapi direkomendasikan)

Zero Trust Access membatasi siapa yang bisa buka URL app — lapisan keamanan di atas aplikasi.

1. Buka [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. Pilih **Access** → **Applications** → **Add an application**
3. Pilih **Self-hosted**
4. Isi:
   - **Application name**: JateamHub
   - **Application domain**: `jateamhub.pages.dev` (atau custom domain)
5. Buat **Policy**:
   - **Policy name**: Allow Team
   - **Action**: Allow
   - **Rule**: Emails → masukkan email teman-teman yang boleh akses
6. Simpan
7. Sekarang hanya email yang di-allowlist yang bisa buka app

### Langkah 4 — Test via Incognito

1. Buka browser incognito
2. Buka URL Cloudflare Pages kamu
3. Harusnya muncul halaman login Cloudflare Access
4. Login dengan email yang sudah di-allowlist
5. Setelah itu baru masuk ke JateamHub login page

---

## Deploy ke Vercel (Alternatif)

```bash
npm install -g vercel
vercel
# Ikuti prompt:
# - Framework: Vite
# - Build: npm run build
# - Output: dist
```

Atau via dashboard [vercel.com](https://vercel.com) → Import Git Repository.

---

## Deploy ke Netlify (Alternatif)

1. Drag & drop folder `dist/` ke [app.netlify.com/drop](https://app.netlify.com/drop)
2. Atau connect GitHub dan set:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

File `public/_redirects` sudah ada untuk SPA fallback.

---

## Security Notes

### ⚠️ localStorage Auth bukan Production Security

Auth dan role JateamHub disimpan di `localStorage` browser. Ini berarti:

- User teknis yang **sudah melewati Cloudflare Access** bisa manipulasi localStorage
- Mereka bisa ubah role diri sendiri jika tahu caranya
- Jangan simpan data sangat sensitif di config JateamHub untuk saat ini

### Untuk MVP ini aman karena:

- Cloudflare Zero Trust Access membatasi siapa yang bisa buka URL
- Edit mode hanya tampil untuk admin/superadmin
- User biasa tidak bisa akses halaman admin
- Config hanya tersimpan di browser masing-masing user (tidak shared)

### Untuk Production penuh nanti:

Implementasi Supabase Auth + Database + RLS:
- Auth pindah ke Supabase (JWT, bukan localStorage)
- Config tersimpan di database (bukan localStorage)
- Role management via Supabase RLS
- Real-time sync antar user

---

## Backup & Restore Config

### Export Config

1. Login sebagai admin/superadmin
2. Aktifkan Edit Mode (✏️)
3. Klik **📤 Export** di edit bar bawah
4. File `jateamhub-config-YYYY-MM-DD.json` akan terdownload
5. Simpan file ini sebagai backup

### Import Config

1. Aktifkan Edit Mode
2. Klik **📥 Import**
3. Pilih file JSON backup
4. Konfirmasi — config akan diganti

### Reset Config ke Default

1. Aktifkan Edit Mode
2. Klik **🔄 Reset Config**
3. Konfirmasi dua kali — tidak bisa dibatalkan

### Reset localStorage Manual (jika error)

Buka browser DevTools (F12) → Console → ketik:

```js
// Reset semua data JateamHub
localStorage.clear()
location.reload()
```

Atau hanya config:
```js
localStorage.removeItem('jateamhub-data')
location.reload()
```

---

## Ganti Password Default

Setelah deploy, segera ganti password default:

1. Login sebagai `superadmin` / `admin123`
2. Buka Options (⚙️) → **Kelola Users**
3. Klik **Edit** di setiap user
4. Set password baru yang kuat
5. Simpan

---

## Roadmap Backend / Supabase

Fase berikutnya setelah MVP stabil:

| Fase | Fitur |
|------|-------|
| Backend 1 | Supabase Auth (JWT) — ganti localStorage auth |
| Backend 2 | Supabase Database — config tersimpan di DB |
| Backend 3 | Supabase RLS — role-based data access di DB level |
| Backend 4 | Real-time sync — perubahan config sync ke semua user |
| Backend 5 | Multi-tenant — tiap organisasi punya config sendiri |

---

## Troubleshooting

**App blank / tidak load setelah update**
```js
localStorage.removeItem('jateamhub-data')
location.reload()
```

**Login tidak bisa padahal password benar**
```js
localStorage.removeItem('jateamhub-users')
location.reload()
// Login dengan akun default: superadmin / admin123
```

**Drag & resize tidak bekerja**
- Pastikan login sebagai admin/superadmin
- Aktifkan Edit Mode (✏️ di header)

**Favicon tidak muncul**
- Normal jika domain tidak punya favicon
- App akan tampilkan icon fallback otomatis
