# JateamHub

Dashboard portal link yang configurable — tema Black / Silver / Mint.

## Quick Start

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`

## Akun Default

| Username     | Password   | Role        | Akses               |
|-------------|-----------|-------------|---------------------|
| superadmin  | admin123  | Super Admin | Semua halaman       |
| admin       | admin456  | Admin       | Semua halaman       |
| user        | user123   | User        | Beranda, Panduan, Support |

> ⚠️ **Ganti password default segera setelah deploy!**
> Gunakan Options → Kelola Users.

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build → dist/
npm run preview  # Preview hasil build
```

## Deployment

Lihat [DEPLOYMENT.md](./DEPLOYMENT.md) untuk panduan lengkap.

## Struktur Config JSON

```json
{
  "version": "4.0",
  "meta": { "title": "JateamHub", "subtitle": "...", "nav": [] },
  "appearance": { "itemDisplayMode": "button", ... },
  "sections": [
    {
      "id": "s1", "title": "LAYANAN BERSAMA",
      "pageId": "beranda",
      "sharedRoles": ["user", "pro"],
      "items": [{ "id": "i1", "title": "...", "url": "https://..." }]
    }
  ]
}
```

## Fitur

- ✅ Multi-page dashboard (Beranda, Panduan, Support, PRO, CRO, Klaim)
- ✅ Role-based access (superadmin, admin, user, pro, cro, klaim)
- ✅ Drag & drop section + resize
- ✅ Folder Grid mode (app launcher style)
- ✅ Import / Export config JSON
- ✅ Favicon auto-fetch
- ✅ Dark theme Black/Silver/Mint
