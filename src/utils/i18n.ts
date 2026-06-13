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
