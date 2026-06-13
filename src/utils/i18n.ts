import { create } from 'zustand'

// Lightweight i18n. Core UI strings are translated now; expand the dictionary
// over time (keys fall through to the literal key/Indonesian default).
export type Lang = 'id' | 'en'

const DICT: Record<string, { id: string; en: string }> = {
  'greeting':       { id: 'Selamat datang', en: 'Welcome' },
  'profile.view':   { id: 'Lihat Profil Saya', en: 'View My Profile' },
  'activity':       { id: 'Aktivitas', en: 'Activity' },
  'signout':        { id: 'Sign Out', en: 'Sign Out' },
  'search.link':    { id: 'Cari link...', en: 'Search links...' },
  'tab.profile':    { id: 'Profil Saya', en: 'My Profile' },
  'tab.users':      { id: 'User Management', en: 'User Management' },
  'tab.settings':   { id: 'Settings', en: 'Settings' },
  'language':       { id: 'Bahasa', en: 'Language' },
  'fullname':       { id: 'Nama Lengkap', en: 'Full Name' },
  'connected':      { id: 'Akun Terhubung', en: 'Connected Accounts' },
  'notif':          { id: 'Notifikasi', en: 'Notifications' },
  'notif.on':       { id: 'Aktif', en: 'Enabled' },
  'notif.off':      { id: 'Nonaktif', en: 'Disabled' },
  'version':        { id: 'Versi Aplikasi', en: 'App Version' },
  'edit':           { id: 'Edit', en: 'Edit' },
  'save':           { id: 'Simpan', en: 'Save' },
  'cancel':         { id: 'Batal', en: 'Cancel' },
  'delete':         { id: 'Hapus', en: 'Delete' },
  'close':          { id: 'Tutup', en: 'Close' },
  'add':            { id: 'Tambah', en: 'Add' },

  // Dashboard groups / sections
  'group.widget':   { id: 'Widget', en: 'Widgets' },
  'group.section':  { id: 'Section', en: 'Sections' },
  'group.show':     { id: 'Tampilkan', en: 'Show' },
  'group.hide':     { id: 'Sembunyikan', en: 'Hide' },
  'sec.empty':      { id: 'Belum ada link', en: 'No links yet' },
  'sec.addlink':    { id: 'Tambah Link', en: 'Add Link' },
  'sec.modified':   { id: 'Diubah', en: 'Modified' },

  // Add section / widgets
  'add.section':    { id: 'Tambah Section', en: 'Add Section' },
  'w.clock':        { id: 'Jam', en: 'Clock' },
  'w.notes':        { id: 'Notes', en: 'Notes' },
  'w.calendar':     { id: 'Kalender', en: 'Calendar' },
  'w.password':     { id: 'Sandi', en: 'Passwords' },

  // Activity
  'activity.empty': { id: 'Belum ada aktivitas. Edit sebuah section untuk melihatnya di sini.', en: 'No activity yet. Edit a section to see it here.' },
  'activity.changed': { id: 'diubah', en: 'edited' },

  // Calendar
  'cal.today':      { id: 'Hari ini', en: 'Today' },
  'cal.sync':       { id: 'Sinkron', en: 'Sync' },
  'cal.search':     { id: 'Cari agenda…', en: 'Search agenda…' },
  'cal.holiday':    { id: 'Libur', en: 'Holidays' },
  'cal.noagenda':   { id: 'Tidak ada agenda', en: 'No agenda' },
  'cal.title':      { id: 'Judul event…', en: 'Event title…' },
  'cal.addevent':   { id: 'Tambah event', en: 'Add event' },
  'cal.discard':    { id: 'Buang masukan?', en: 'Discard input?' },
  'cal.delq':       { id: 'Hapus?', en: 'Delete?' },
  'cal.page':       { id: 'Hal.', en: 'Page' },

  // Vault
  'v.createpin':    { id: 'Buat PIN Brankas', en: 'Create Vault PIN' },
  'v.locked':       { id: 'Brankas Terkunci', en: 'Vault Locked' },
  'v.open':         { id: 'Buka', en: 'Open' },
  'v.opening':      { id: 'Membuka…', en: 'Opening…' },
  'v.addpw':        { id: 'Tambahkan password', en: 'Add password' },
  'v.search':       { id: 'Cari...', en: 'Search...' },
  'v.lock':         { id: 'Kunci', en: 'Lock' },
  'v.hidden':       { id: 'Disembunyikan', en: 'Hidden' },
  'v.sitename':     { id: 'Nama situs', en: 'Site name' },
  'v.username':     { id: 'Username / email', en: 'Username / email' },
  'v.password':     { id: 'Kata sandi', en: 'Password' },

  // Profile
  'p.detail':       { id: 'Detail Akun', en: 'Account Details' },
  'p.changepw':     { id: 'Ganti Password', en: 'Change Password' },
  'p.resetpw':      { id: 'Reset Password', en: 'Reset Password' },
  'p.prefs':        { id: 'Preferensi', en: 'Preferences' },
  'p.region':       { id: 'Wilayah', en: 'Region' },
  'p.unit':         { id: 'Unit', en: 'Unit' },
  'p.role':         { id: 'Role', en: 'Role' },
  'p.notfilled':    { id: 'Belum diisi', en: 'Not set' },
  'p.usermgmt':     { id: 'User Management', en: 'User Management' },

  // Add content modal
  'add.content':    { id: 'Tambah Konten', en: 'Add Content' },
  'add.choose':     { id: 'Pilih jenis konten yang ingin ditambahkan ke dashboard', en: 'Choose what to add to your dashboard' },
  'modal.section':  { id: 'Section', en: 'Section' },
  'modal.section.d':{ id: 'Kumpulkan link dan shortcut dalam satu folder', en: 'Group links and shortcuts in one folder' },
  'modal.widget':   { id: 'Widget', en: 'Widget' },
  'modal.widget.d': { id: 'Tambahkan fitur interaktif ke dashboard', en: 'Add interactive features to your dashboard' },

  // Item modal
  'item.add':       { id: 'Tambah Link', en: 'Add Link' },
  'item.edit':      { id: 'Edit Link', en: 'Edit Link' },
  'item.title':     { id: 'Judul', en: 'Title' },
  'item.url':       { id: 'URL', en: 'URL' },
}

interface I18nState { lang: Lang; setLang: (l: Lang) => void }
export const useI18n = create<I18nState>((set) => ({
  lang: ((typeof localStorage !== 'undefined' && localStorage.getItem('jateamhub-lang')) as Lang) || 'id',
  setLang: (l) => { try { localStorage.setItem('jateamhub-lang', l) } catch {} ; set({ lang: l }) },
}))

// Hook that re-renders on language change and returns a bound translator.
export const useT = () => {
  const lang = useI18n(s => s.lang)
  return (key: string) => DICT[key]?.[lang] ?? key
}
