# JateamHub — Dokumentasi Teknis Lengkap

> Versi: 4.0 | Terakhir diperbarui: Mei 2026  
> Dibuat oleh: ihsaanhidayat | Stack: React + Vite + TypeScript + Supabase + Cloudflare Workers

---

## DAFTAR ISI

1. [Gambaran Proyek](#1-gambaran-proyek)
2. [Perjalanan Pembangunan](#2-perjalanan-pembangunan)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Struktur Folder](#4-struktur-folder)
5. [Sistem Role & Permission](#5-sistem-role--permission)
6. [Dokumentasi Kode per File](#6-dokumentasi-kode-per-file)
7. [Database Supabase](#7-database-supabase)
8. [Deployment & CI/CD](#8-deployment--cicd)
9. [Cara Maintenance](#9-cara-maintenance)
10. [Panduan Debug & Error](#10-panduan-debug--error)
11. [Yang Harus Diketahui Creator](#11-yang-harus-diketahui-creator)
12. [Roadmap Selanjutnya](#12-roadmap-selanjutnya)

---

## 1. GAMBARAN PROYEK

JateamHub adalah **dashboard portal link internal** untuk tim Jateam. Fungsinya seperti halaman bookmark/launcher yang bisa dikonfigurasi sesuai kebutuhan tiap unit kerja.

### Fitur Utama
- Multi-halaman dengan navigasi (Beranda, Panduan, Support)
- Section dan link yang bisa di-drag, resize, tambah, hapus
- Role-based access: superadmin, admin, unit_admin, user
- Unit-based content: PRO, CRO, Klaim punya konten berbeda
- Auth via Supabase (JWT, multi-device)
- Config tersimpan di database (sync semua device)
- Widget Clock dan Notes
- Animasi ringan berbasis CSS

### URL Live
```
https://jateamhub.ihsaanhidayat.workers.dev
```

### Tech Stack
| Layer | Teknologi |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript |
| State | Zustand |
| Grid | react-grid-layout |
| Auth & DB | Supabase (PostgreSQL + Auth + Edge Functions) |
| Deploy | Cloudflare Workers (via Wrangler) |
| CSS | Custom CSS (Space Grotesk + JetBrains Mono) |

---

## 2. PERJALANAN PEMBANGUNAN

### Fase 1 — UI & Struktur Dasar
Membangun tampilan dashboard dengan tema Black (#0A0A0A) / Silver (#E0E0E0) / Mint (#00FFC2).
- Login page dengan animasi
- Header dengan logo dan navigasi
- Grid layout menggunakan react-grid-layout
- Section card dengan drag & resize
- Options panel untuk pengaturan tampilan

### Fase 2 — Auth & Multi-Page (localStorage)
- Sistem login berbasis localStorage (sebelum Supabase)
- Multi-halaman: Beranda, Panduan, Support, PRO, CRO, Klaim
- Role system: superadmin, admin, user
- Section visibility: all, admin, unit

### Fase 3 — Section & Item System
- Section dengan visibility control (all/admin/unit)
- targetUnits untuk assign section ke unit tertentu
- Item modal untuk tambah/edit link
- Drag item antar section
- Widget Clock dan Notes (resizable)

### Fase 4 — Role & Unit Revisi
- Role disederhanakan menjadi 3: superadmin, admin, user
- Unit (PRO/CRO/Klaim) dipisahkan dari role → field `unit_id`
- Preview mode: admin bisa preview tampilan unit lain
- Undo/Redo hingga 20 langkah
- Section badge ALL dan ADM

### Fase 5 — Supabase Backend
- Migrasi auth dari localStorage ke Supabase Auth (JWT)
- Config dashboard tersimpan di Supabase DB (sync multi-device)
- User management via Supabase (bukan localStorage)
- Edge Function `create-user` untuk buat user tanpa expose service key
- Edge Function `update-user-password` untuk reset password

### Fase 6 — Unit Admin & Polish
- `is_unit_admin` field: user biasa dengan akses edit terbatas
- Avatar emoji per user (diatur admin)
- Animasi CSS: fade, slide, hover lift
- Shake animation saat login gagal
- Fix berbagai bug visibility dan permission

---

## 3. ARSITEKTUR SISTEM

```
┌─────────────────────────────────────────┐
│              BROWSER                     │
│                                          │
│  React App (Cloudflare Workers CDN)      │
│  ├── authStore (Supabase Auth JWT)       │
│  ├── dashboardStore (config + UI state)  │
│  └── Components                         │
│       ├── Header, Nav, Options           │
│       ├── GridLayout (react-grid-layout) │
│       ├── SectionCard + ItemModal        │
│       └── Widgets (Clock, Notes)         │
└──────────────────┬──────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────┐
│              SUPABASE                    │
│                                          │
│  Auth (JWT) ─── profiles table           │
│  dashboard_config table                  │
│  Edge Functions:                         │
│  ├── create-user (buat user baru)        │
│  └── update-user-password (reset pw)     │
└─────────────────────────────────────────┘
```

### Alur Data
```
Login:
  Browser → Supabase Auth → JWT token → authStore.profile

Config Load:
  Login berhasil → loadRemoteConfig() → Supabase DB → dashboardStore.config

Config Save:
  Edit section/item → dashboardStore.persist() → localStorage (cache)
                    → saveConfigToDB() → Supabase DB (master)

Create User:
  Admin UI → authStore.addUser() → Edge Function create-user
           → Supabase Admin API → profiles table (via trigger)
```

---

## 4. STRUKTUR FOLDER

```
jateamhub/
├── src/
│   ├── App.tsx                          # Root component, routing auth
│   ├── main.tsx                         # Entry point React
│   ├── vite-env.d.ts                    # TypeScript env declaration
│   │
│   ├── types/
│   │   └── index.ts                     # Semua type/interface global
│   │
│   ├── utils/
│   │   ├── supabaseClient.ts            # Supabase client + helpers DB
│   │   ├── helpers.ts                   # uid(), getFaviconUrl(), dll
│   │   ├── security.ts                  # URL validator, sanitizer
│   │   └── roles.ts                     # Permission & role logic
│   │
│   ├── store/
│   │   ├── authStore.ts                 # Auth state (Supabase)
│   │   └── dashboardStore.ts            # Config + UI state (Zustand)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx               # Top bar, nav, search
│   │   │   ├── LoginPage.tsx            # Halaman login
│   │   │   ├── OptionsPanel.tsx         # Panel pengaturan kanan
│   │   │   ├── EditBar.tsx              # Bar edit (undo/redo/export)
│   │   │   ├── GridLayout.tsx           # Grid utama dashboard
│   │   │   └── SupportPage.tsx          # Halaman support statis
│   │   │
│   │   ├── section/
│   │   │   ├── SectionCard.tsx          # Card section + items
│   │   │   └── SectionModal.tsx         # Modal tambah/edit section
│   │   │
│   │   ├── item/
│   │   │   └── ItemModal.tsx            # Modal tambah/edit link item
│   │   │
│   │   ├── ui/
│   │   │   ├── Modal.tsx                # Base modal component
│   │   │   ├── Toast.tsx                # Notifikasi toast
│   │   │   ├── AppIcon.tsx              # Icon aplikasi + favicon
│   │   │   ├── ConfigModal.tsx          # Modal app config
│   │   │   ├── PageInfoModal.tsx        # Modal page info
│   │   │   └── UserManagementModal.tsx  # Modal kelola users
│   │   │
│   │   └── widgets/
│   │       ├── ClockWidget.tsx          # Widget jam digital
│   │       └── NotesWidget.tsx          # Widget catatan
│   │
│   └── styles/
│       └── global.css                   # Semua CSS global + animasi
│
├── supabase/
│   └── functions/
│       ├── create-user/
│       │   └── index.ts                 # Edge Function buat user
│       └── update-user-password/
│           └── index.ts                 # Edge Function reset password
│
├── public/
│   ├── _headers                         # Security headers Cloudflare
│   └── _redirects                       # SPA fallback (kosong)
│
├── .env                                 # Env vars (tidak di-commit)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc                       # Cloudflare Workers config
├── DEPLOYMENT.md                        # Panduan deploy
└── JATEAMHUB_DOCS.md                   # File ini
```

---

## 5. SISTEM ROLE & PERMISSION

### Role Hierarchy

```
superadmin
  ├── Semua akses admin
  ├── Buat/hapus admin
  ├── Lihat semua section semua halaman
  └── Preview tampilan unit lain

admin
  ├── Edit dashboard (section, item, layout)
  ├── Buat/hapus user (bukan admin)
  ├── Lihat section visibility=all dan visibility=admin
  └── Preview tampilan unit lain

unit_admin (user dengan is_unit_admin=true)
  ├── Akses sama seperti user biasa (read-only global)
  ├── Edit section yang targetUnits includes unit mereka
  ├── Tambah section baru (auto-assign ke unit mereka)
  └── Hapus section milik unit mereka

user
  └── Read-only, lihat section sesuai unit
```

### Unit System

```
unit_id: '' | 'pro' | 'cro' | 'klaim'

Kosong ('')  → user umum, akses: Beranda, Panduan, Support
pro          → akses + section targetUnits=['pro']
cro          → akses + section targetUnits=['cro']
klaim        → akses + section targetUnits=['klaim']
```

### Section Visibility

```
visibility: 'all' | 'admin' | 'unit'

all   → tampil untuk semua role (badge: ALL)
admin → hanya superadmin & admin (badge: ADM)
unit  → hanya unit yang ada di targetUnits
        contoh: targetUnits=['pro'] → hanya user unit pro
```

### Aturan Tampil Section di Beranda

```
superadmin/admin:
  - Lihat section visibility=all dan visibility=admin
  - Section visibility=unit TIDAK tampil di beranda admin
    (dikelola via preview mode / SectionModal)

user (unit=pro):
  - visibility=all → tampil
  - visibility=unit + targetUnits includes 'pro' → tampil
  - visibility=admin → tidak tampil

Preview Mode (admin):
  - Admin klik PRO di options → simulasi tampilan user PRO
  - Edit mode tetap aktif saat preview
  - Banner ungu muncul di atas header
```

---

## 6. DOKUMENTASI KODE PER FILE

### `src/types/index.ts`
**Fungsi:** Definisi semua TypeScript type dan interface global.

Key types:
- `Section` — struktur section dengan `visibility`, `targetUnits`, `pageId`, `type` (section/widget)
- `LinkItem` — item link dalam section
- `UserSession` — session user (legacy localStorage)
- `UserAccount` — akun user (legacy localStorage)
- `JateamConfig` — seluruh konfigurasi dashboard
- `DEFAULT_PAGES` — array halaman default
- `GRID_ROW_HEIGHT`, `SECTION_MIN_W/H` — konstanta grid

---

### `src/utils/supabaseClient.ts`
**Fungsi:** Supabase client dan semua helper untuk komunikasi dengan database.

Key exports:
- `supabase` — instance Supabase client (anon key)
- `Profile` — interface profil user dari DB
- `signIn(email, password)` — login via Supabase Auth
- `signOut()` — logout
- `getProfile(userId)` — ambil profil satu user
- `getAllProfiles()` — ambil semua profil (untuk Kelola Users)
- `updateProfile(userId, updates)` — update profil user
- `loadConfigFromDB()` — load config dari tabel `dashboard_config`
- `saveConfigToDB(config)` — simpan config ke DB
- `createUser(...)` — buat user baru via Edge Function `create-user`
- `updateUserPassword(userId, password)` — reset password via Edge Function

**Penting:** Semua operasi yang butuh service role key dilakukan via Edge Function, bukan langsung dari browser.

---

### `src/utils/roles.ts`
**Fungsi:** Semua logika permission dan role.

Key exports:
- `canEdit(session)` — true jika superadmin atau admin
- `canCreateUser(session)` — true jika superadmin atau admin
- `canViewSection(session, visibility, targetUnits)` — cek apakah section boleh tampil
- `getAccessiblePages(session)` — halaman yang bisa diakses (semua dapat Beranda/Panduan/Support)
- `getDisplayBadge(session)` — badge label + warna untuk display (tampilkan unit bukan role untuk user)
- `UNIT_LABELS`, `UNIT_BADGE_COLOR` — label dan warna per unit
- `ROLE_LABELS`, `ROLE_BADGE_COLOR` — label dan warna per role

**Aturan penting:**
- `canViewSection` cek `session.unit_id` (Profile) atau `session.unitId` (legacy) → keduanya di-support
- Admin lihat semua section KECUALI `visibility=unit` di beranda (logika di GridLayout)

---

### `src/utils/security.ts`
**Fungsi:** Keamanan dan validasi input.

Key exports:
- `isSafeUrl(url)` — blokir `javascript:`, `data:`, `vbscript:`
- `sanitizeUrl(url)` — return `#` kalau URL berbahaya
- `validateImportConfig(data)` — validasi struktur JSON saat import config
- `sanitizeRole(role)` — fallback ke `'user'` jika role tidak dikenal
- `sanitizePage(pageId, validPages)` — fallback ke `'beranda'` jika page tidak valid

---

### `src/utils/helpers.ts`
**Fungsi:** Utility functions umum.

Key exports:
- `uid()` — generate random ID 8 karakter
- `getFaviconUrl(url, size)` — Google favicon service URL
- `getDomainFromUrl(url)` — extract domain dari URL
- `highlight(text, query)` — wrap teks dengan `<mark>` untuk highlight search
- `isValidUrl(url)` — validasi URL

---

### `src/store/authStore.ts`
**Fungsi:** State management untuk autentikasi (Supabase).

State:
- `profile` — profil user yang sedang login (null = belum login)
- `loading` — loading state
- `initialized` — apakah init() sudah selesai
- `users` — list semua profil (untuk Kelola Users)

Actions:
- `init()` — cek session aktif saat app mount, subscribe auth changes
- `login(username, password)` — login via Supabase, email = `username@jateamhub.app`
- `logout()` — logout, clear profile
- `loadUsers()` — fetch semua profil dari DB
- `addUser(username, password, role, unitId, adminKey)` — buat user via Edge Function
- `updateUser(userId, role, unitId, newPassword, avatarEmoji, isUnitAdmin)` — update profil + password
- `removeUser(userId)` — hapus user via Edge Function delete-user

**Penting:** `login()` mengkonversi username → email dengan format `username@jateamhub.app`.

---

### `src/store/dashboardStore.ts`
**Fungsi:** State management untuk konfigurasi dashboard dan UI state.

State utama:
- `config` — seluruh JateamConfig (sections, pages, appearance, meta)
- `session` — legacy UserSession (untuk kompatibilitas)
- `editMode` — toggle mode edit
- `currentPage` — halaman aktif ('beranda', 'panduan', dll)
- `previewUnit` — null = admin view, string = preview unit tertentu
- `history[]` / `future[]` — undo/redo stack (max 20)
- `searchQuery` — query filter section

Actions config:
- `setConfig(cfg)` — set config baru, sync ke localStorage + Supabase DB
- `resetConfig()` — reset ke defaultConfig
- `loadRemoteConfig()` — load config dari Supabase DB (dipanggil setelah login)

Actions section:
- `addSection(...)` — tambah section baru, push ke history
- `updateSection(id, ...)` — update section, push ke history
- `deleteSection(id)` — hapus section, push ke history
- `toggleCollapse(id)` — collapse/expand section
- `batchUpdateLayouts(layouts)` — update posisi banyak section sekaligus (drag result)

Actions item:
- `addItem(sectionId, data)` — tambah item ke section
- `updateItem(sectionId, itemId, data)` — update item
- `deleteItem(sectionId, itemId)` — hapus item
- `moveItem(srcId, itemId, tgtId)` — pindah item antar section

Undo/Redo:
- `undo()` — restore config sebelumnya
- `redo()` — maju ke config berikutnya
- `canUndo` / `canRedo` — boolean untuk disable tombol

**Penting:** Setiap mutasi (add/update/delete section & item) otomatis push ke `history` via `pushHistory()` sebelum eksekusi.

---

### `src/App.tsx`
**Fungsi:** Root component, handle auth state dan render halaman utama.

Alur:
1. `useEffect → init()` — cek session Supabase saat mount
2. Kalau `!initialized` → tampil loading spinner
3. Kalau `!profile` → tampil `<LoginPage />`
4. Setelah login → `loadRemoteConfig()` → render dashboard
5. Render semua modal (Config, PageInfo, UserManagement)

---

### `src/components/layout/Header.tsx`
**Fungsi:** Top bar dengan branding, navigasi halaman, search, dan tombol edit.

Fitur:
- Logo URL dari config (dengan white background wrapper agar terlihat di tema gelap)
- Logo placeholder klik → buka ConfigModal
- Nav links difilter berdasarkan `getAccessiblePages(session)`
- Auto-redirect ke beranda kalau `currentPage` tidak accessible
- Search input untuk filter section
- Tombol edit (✏️) hanya untuk admin/superadmin
- Preview banner (ungu) kalau `previewUnit` aktif
- Emoji user tampil di subtitle: `Selamat datang, username 🌸`

---

### `src/components/layout/GridLayout.tsx`
**Fungsi:** Grid utama yang render semua section dan handle drag/resize.

Logika filter section:
```
Admin (bukan preview):
  - Beranda: tampil section visibility=all + visibility=admin
  - Unit page: tampil section pageId=unit + targetUnits includes unit

Preview mode / user biasa:
  - Tampil section pageId=currentPage
  - ATAU section visibility=unit + targetUnits includes unit user (di beranda)
  - Filter via canViewSection()
```

Unit Admin:
- `isUnitAdmin` → bisa drag/resize section yang `canEditSection()` return true
- `canEditSection(s)` → true kalau `s.targetUnits.includes(myUnit)`

Add Section ghost:
- Selalu di posisi akhir grid
- Ukuran ikuti section tetangga
- Hanya muncul saat edit mode aktif (admin atau unit_admin)

Widget rendering:
- Section dengan `type='widget'` di-render via `WidgetWrapper`
- `widgetType='clock'` → ClockWidget
- `widgetType='notes'` → NotesWidget

---

### `src/components/section/SectionCard.tsx`
**Fungsi:** Render satu section beserta semua item di dalamnya.

Props:
- `section` — data section
- `canEdit?` — override permission (dari GridLayout berdasarkan unit admin)
- `onEditSection`, `onEditItem`, `onAddItem` — callbacks ke parent

Fitur:
- Drag handle di header (`.section-header`)
- Badge ALL (mint) dan ADM (biru) di header
- Collapse toggle
- Item display: button, list, icon+text, icon only, text only, folder grid
- Search highlight via `highlight()`
- Favicon load via Google service dengan fallback emoji 🔗
- Item drag & drop native HTML (bukan RGL) antar section
- Semua external link pakai `rel="noopener noreferrer"`
- URL di-sanitize via `sanitizeUrl()` sebelum dibuka

---

### `src/components/section/SectionModal.tsx`
**Fungsi:** Modal untuk tambah dan edit section.

Fields:
- Title, subtitle, icon
- Tipe (section / widget) — hanya saat add
- Widget type (clock / notes) — hanya saat add widget
- Halaman (pageId)
- Lebar (kolom grid)
- Visibility + targetUnits — **disembunyikan untuk unit_admin**
- Accent color picker (preset + custom)

Unit admin auto-assignment:
- `finalVisibility = 'unit'`
- `finalTargetUnits = [myUnit]`
- `finalPageId = 'beranda'`

---

### `src/components/ui/UserManagementModal.tsx`
**Fungsi:** Modal kelola users (list, tambah, edit, hapus).

Views:
- `list` — tampil semua user dengan badge unit/role + tombol edit/hapus
- `add` — form tambah user baru (username, password, role, unit, emoji)
- `edit` — form edit user (role, unit, is_unit_admin toggle, emoji, password baru)

Permission rules:
- Superadmin: bisa edit/hapus admin dan user
- Admin: hanya bisa edit/hapus user (bukan admin/superadmin)
- Superadmin tidak bisa diedit oleh siapapun kecuali dirinya sendiri (hanya emoji + password)

is_unit_admin toggle:
- Muncul hanya untuk role=user dengan unit yang dipilih
- Toggle visual dengan animasi slide

---

### `src/components/widgets/ClockWidget.tsx`
**Fungsi:** Widget jam digital real-time.

Fitur:
- Update setiap 1 detik via `setInterval`
- Toggle 12h/24h
- Tampil hari, tanggal, bulan, tahun dalam Bahasa Indonesia
- Detik berkedip (opacity animasi)
- Font JetBrains Mono untuk tampilan digital

---

### `src/components/widgets/NotesWidget.tsx`
**Fungsi:** Widget catatan per section.

Fitur:
- Auto-save ke localStorage dengan key `jateamhub-notes-{sectionId}`
- Debounce 800ms sebelum save
- Indikator status: `● menyimpan...` / `✓ tersimpan`
- Textarea resizable mengikuti ukuran widget

**Penting:** Notes tersimpan di localStorage browser masing-masing user, TIDAK di database. Artinya notes beda antar device/browser.

---

### `src/styles/global.css`
**Fungsi:** Semua styling aplikasi dalam satu file.

Struktur:
- CSS Variables (warna, radius, font)
- Reset & base styles
- Login page styles
- Header & navigation
- Options panel
- Section card & items
- Modal
- Edit bar
- Toast
- Form fields
- Grid layout overrides
- Mobile responsive
- Animasi (fadeSlideUp, shake, scaleIn, dll)

Animasi yang tersedia:
- `fadeSlideUp` — section muncul dari bawah
- `loginShake` — kotak login goyang saat password salah
- `scaleIn` — modal muncul dengan scale
- `slideInRight` — options panel dari kanan
- `slideInBottom` — edit bar dari bawah
- `fadeSlideDown` — header dari atas
- `toastIn` — toast dari kanan

---

### `supabase/functions/create-user/index.ts`
**Fungsi:** Edge Function Supabase untuk membuat user baru.

Alur:
1. Verifikasi JWT caller (harus admin/superadmin)
2. Cek role caller di tabel `profiles`
3. Buat user baru via `supabaseAdmin.auth.admin.createUser()`
4. Trigger `on_auth_user_created` otomatis insert ke `profiles`
5. Return user data

Menggunakan `SUPABASE_SERVICE_ROLE_KEY` dari environment Supabase (tidak pernah ke browser).

---

### `supabase/functions/update-user-password/index.ts`
**Fungsi:** Edge Function untuk reset password user.

Alur:
1. Verifikasi JWT caller
2. Cek role caller (harus admin/superadmin)
3. Update password via `supabaseAdmin.auth.admin.updateUserById()`
4. Return success

---

## 7. DATABASE SUPABASE

### Tabel `profiles`
```sql
id            uuid     PRIMARY KEY (ref auth.users)
username      text     UNIQUE NOT NULL
role          text     DEFAULT 'user' CHECK (role IN ('superadmin','admin','user'))
unit_id       text     DEFAULT '' CHECK (unit_id IN ('pro','cro','klaim',''))
avatar_emoji  text     DEFAULT ''
is_unit_admin boolean  DEFAULT false
created_at    timestamptz DEFAULT now()
```

### Tabel `dashboard_config`
```sql
id          uuid     PRIMARY KEY
config      jsonb    NOT NULL DEFAULT '{}'
updated_at  timestamptz DEFAULT now()
updated_by  uuid     REFERENCES profiles
```

Config ID tetap: `00000000-0000-0000-0000-000000000001`

### RLS Policies
- `profiles` — semua user bisa baca, update diri sendiri; admin bisa update/delete semua
- `dashboard_config` — semua bisa baca; hanya admin yang bisa update

### Trigger
`on_auth_user_created` — auto-create profil saat user baru dibuat di `auth.users`. Ambil `username`, `role`, `unit_id` dari `raw_user_meta_data`.

### Format Email
Semua user pakai email synthetic: `username@jateamhub.app`

---

## 8. DEPLOYMENT & CI/CD

### Deploy ke Cloudflare

```bash
# Build + deploy sekaligus
npm run deploy

# Atau terpisah
npm run build        # output ke dist/
wrangler deploy      # upload dist/ ke Cloudflare
```

### Deploy Edge Function

```bash
supabase functions deploy create-user
supabase functions deploy update-user-password
```

### Simpan ke GitHub

```bash
git add .
git commit -m "deskripsi perubahan"
git push
```

**Penting:** `npm run deploy` TIDAK otomatis git push. Lakukan manual setelah deploy.

### File Penting untuk Deployment
- `wrangler.jsonc` — konfigurasi Cloudflare Workers
- `public/_headers` — security headers
- `tsconfig.json` — harus ada `"exclude": ["supabase"]` agar TypeScript tidak compile Edge Function

---

## 9. CARA MAINTENANCE

### Tambah User Baru
1. Login sebagai superadmin/admin
2. Options (⚙️) → Kelola Users → ＋ Tambah User
3. Isi username, password, role, unit
4. Simpan

Atau via PowerShell (cara cepat):
```powershell
$key = "SERVICE_ROLE_KEY"
$username = "nama.user"
$password = "Password123"
$unitId = "pro"

$result = Invoke-RestMethod -Method POST `
  -Uri "https://qsvrqdnyjywjzxkqwszl.supabase.co/auth/v1/admin/users" `
  -Headers @{"apikey"=$key; "Authorization"="Bearer $key"; "Content-Type"="application/json"} `
  -Body "{""email"":""$username@jateamhub.app"",""password"":""$password"",""email_confirm"":true,""user_metadata"":{""username"":""$username"",""role"":""user"",""unit_id"":""$unitId""}}"
```

### Reset Password User
1. Kelola Users → Edit user → isi Password Baru → Simpan
2. Atau via Supabase Dashboard → Authentication → Users → klik user → Reset Password

### Backup Config
1. Edit Mode aktif → klik 📤 Export
2. File `jateamhub-config-YYYY-MM-DD.json` terdownload
3. Simpan sebagai backup

### Restore Config
1. Edit Mode → 📥 Import → pilih file JSON backup
2. Konfirmasi → config diganti

### Update Tampilan/Konten
1. Login superadmin/admin
2. Aktifkan Edit Mode (✏️)
3. Drag section, resize, tambah item sesuai kebutuhan
4. Perubahan auto-save ke DB — semua device langsung sync

### Assign Unit Admin
1. Kelola Users → Edit user
2. Pastikan Role = User dan Unit dipilih
3. Toggle "Akses Edit Terbatas" → ON
4. Simpan

---

## 10. PANDUAN DEBUG & ERROR

### App Blank / Tidak Load
**Penyebab:** Config localStorage corrupt atau versi mismatch.
```js
// Di browser console
localStorage.removeItem('jateamhub-data')
location.reload()
```

### Login Gagal (username/password benar)
**Cek 1:** Pastikan email user di Supabase format `username@jateamhub.app`
```sql
SELECT email FROM auth.users WHERE email LIKE '%@jateamhub.app';
```

**Cek 2:** Pastikan profil ada di tabel profiles
```sql
SELECT * FROM public.profiles;
```

**Fix:** Reset password via Supabase Dashboard → Authentication → Users

### Section Tidak Muncul untuk User
**Cek 1:** Verifikasi visibility dan targetUnits section
```sql
SELECT id, title, visibility, target_units 
FROM dashboard_config 
WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Cek 2:** Di browser, login sebagai admin → Options → Preview unit → cek tampilan

**Fix:** Edit section → pastikan visibility=unit dan targetUnits include unit user

### Config Tidak Sync ke Device Lain
**Penyebab:** `saveConfigToDB()` gagal atau koneksi Supabase bermasalah.

**Cek:** Buka Supabase Dashboard → Table Editor → `dashboard_config` → lihat `updated_at`

**Fix:** Export config dari device yang benar → Import di device lain

### Build Error TypeScript
**Error umum:** `Cannot find module` → cek import path

**Error umum:** `Property does not exist` → cek interface di `types/index.ts` dan `supabaseClient.ts`

**Fix cepat:**
```bash
npx tsc --noEmit    # cek error tanpa build
npm run build       # build lengkap
```

### Edge Function Error
**Cek logs:**
```bash
supabase functions logs create-user
supabase functions logs update-user-password
```

**Re-deploy:**
```bash
supabase functions deploy create-user --no-verify-jwt
```

### Cloudflare Build Gagal
**Cek:** Build log di Cloudflare Dashboard → Workers & Pages → jateamhub → Deployments

**Fix umum:**
- TypeScript error → fix dulu di lokal, `npm run build` sukses, baru push
- Cache issue → `npm run deploy` dari lokal (bypass Cloudflare builder)

### User Tidak Bisa Edit (unit_admin)
**Cek:** Pastikan `is_unit_admin = true` di database
```sql
SELECT username, role, unit_id, is_unit_admin 
FROM public.profiles 
WHERE username = 'nama.user';
```

**Fix:** Kelola Users → Edit user → toggle Unit Admin → Simpan

### Notes Widget Hilang
**Penyebab:** Notes tersimpan di localStorage browser, bukan DB. Beda browser = beda notes.
**Ini by design** — notes adalah catatan lokal per browser.

---

## 11. YANG HARUS DIKETAHUI CREATOR

### Keamanan

1. **Service Role Key JANGAN di-commit ke GitHub.**
   Saat ini tidak ada di kode (sudah dipindahkan ke Edge Function).
   Jangan pernah paste service role key ke file yang di-commit.

2. **Anon key aman di frontend** — by design Supabase. Anon key hanya bisa akses sesuai RLS policy.

3. **Auth via Supabase JWT** — token auto-refresh, persist di localStorage browser. Jika user clear localStorage, perlu login ulang.

4. **RLS Supabase** adalah lapisan keamanan pertama. Pastikan RLS selalu enabled di semua tabel.

5. **Admin key** di App Config sekarang tidak digunakan untuk validasi. Hanya tersimpan di config.

### Limitasi Saat Ini

1. **Notes widget** tersimpan di localStorage — tidak sync antar device.

2. **Config** sync via Supabase DB — sync otomatis saat login. Jika ada conflict (dua admin edit bersamaan), yang terakhir simpan yang menang (last-write-wins).

3. **Tidak ada realtime sync** — jika admin A edit config, admin B tidak langsung lihat perubahan. Perlu refresh manual.

4. **Favicon** diambil dari Google service — butuh koneksi internet. Domain tanpa favicon tampil emoji 🔗.

5. **Cloudflare Workers** tidak mendukung environment variable untuk VITE — itu sebabnya Supabase URL dan anon key hardcode di `supabaseClient.ts`. Ini aman karena keduanya adalah public key.

### Konvensi Kode

- **ID section:** prefix `s` + random 8 char → `s1a2b3c4`
- **ID item:** prefix `i` + random 8 char → `ia1b2c3d`
- **Email user:** selalu format `username@jateamhub.app`
- **Config ID:** selalu `00000000-0000-0000-0000-000000000001` (singleton)
- **localStorage keys:**
  - `jateamhub-data` — config dashboard
  - `jateamhub-auth` — session legacy (localStorage auth)
  - `jateamhub-notes-{sectionId}` — notes per widget

### Cara Kerja Undo/Redo

Setiap mutasi config (add/update/delete section & item) memanggil `pushHistory()` terlebih dahulu yang menyimpan snapshot config saat ini ke array `history[]`. Maksimal 20 snapshot. `undo()` ambil snapshot terakhir dari `history[]` dan push config saat ini ke `future[]`. `redo()` kebalikannya.

---

## 12. ROADMAP SELANJUTNYA

### Prioritas Tinggi
- [ ] Realtime sync config antar admin (Supabase Realtime)
- [ ] Notes widget sync ke database per user
- [ ] Halaman Panduan dengan konten yang bisa dikelola
- [ ] Mobile UI yang lebih responsif

### Prioritas Menengah
- [ ] Notifikasi/pengumuman dari admin ke semua user
- [ ] Riwayat perubahan config (audit log)
- [ ] Folder/kategori untuk section
- [ ] Dark/light mode toggle

### Prioritas Rendah
- [ ] Multi-tenant (beberapa organisasi dalam satu instance)
- [ ] Custom domain per unit
- [ ] Widget tambahan (weather, RSS feed, embed iframe)
- [ ] Export config sebagai template

---

*Dokumentasi ini dibuat otomatis berdasarkan kode aktual JateamHub v4.0*
*Untuk pertanyaan teknis, hubungi creator: ihsaanhidayat*
