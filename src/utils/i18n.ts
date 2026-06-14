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
  'v.changepin':    { id: 'Ganti PIN', en: 'Change PIN' },
  'v.newpin':       { id: 'PIN baru', en: 'New PIN' },
  'v.confirmpin':   { id: 'Konfirmasi PIN baru', en: 'Confirm new PIN' },
  'v.pinmin':       { id: 'PIN minimal 6 karakter', en: 'PIN must be at least 6 characters' },
  'v.pinmismatch':  { id: 'PIN tidak cocok', en: 'PINs do not match' },
  'v.pinkept':      { id: 'PIN diperbarui · semua kata sandi tetap aman', en: 'PIN updated · all passwords kept' },
  'v.pinfailed':    { id: 'Gagal mengganti PIN. Coba lagi.', en: 'Failed to change PIN. Try again.' },

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
  'item.name':      { id: 'Nama Link *', en: 'Link Name *' },
  'item.urlreq':    { id: 'URL *', en: 'URL *' },
  'item.popup':     { id: 'Teks popup (hover)', en: 'Hover text' },
  'item.icon':      { id: 'Custom Icon URL (opsional)', en: 'Custom Icon URL (optional)' },
  'confirm.del':    { id: 'Hapus?', en: 'Delete?' },
  'yes':            { id: 'Ya', en: 'Yes' },
  'no':             { id: 'Tidak', en: 'No' },

  // Chat
  'chat.type':      { id: 'Ketik pesan...', en: 'Type a message...' },
  'chat.team':      { id: 'Chat internal tim', en: 'Team chat' },
  'chat.pick':      { id: 'Pilih percakapan di samping, atau mulai yang baru. Pesan teks diamankan end-to-end.', en: 'Pick a conversation, or start a new one. Text messages are end-to-end encrypted.' },

  // Chat — lock screen
  'chat.lock.setup':      { id: 'Buat PIN Chat', en: 'Create Chat PIN' },
  'chat.lock.locked':     { id: 'Chat Terkunci', en: 'Chat Locked' },
  'chat.lock.setupdesc':  { id: 'Buat PIN 4–8 digit untuk mengamankan chat kamu.', en: 'Create a 4–8 digit PIN to secure your chat.' },
  'chat.lock.unlockdesc': { id: 'Masukkan PIN untuk membuka chat.', en: 'Enter your PIN to unlock chat.' },
  'chat.lock.newpin':     { id: 'Buat PIN baru', en: 'Create new PIN' },
  'chat.lock.enterpin':   { id: 'Masukkan PIN', en: 'Enter PIN' },
  'chat.lock.confirmpin': { id: 'Konfirmasi PIN', en: 'Confirm PIN' },
  'chat.lock.verifying':  { id: 'Memverifikasi...', en: 'Verifying...' },
  'chat.lock.createbtn':  { id: 'Buat PIN & Buka Chat', en: 'Create PIN & Open Chat' },
  'chat.lock.openbtn':    { id: 'Buka Chat', en: 'Open Chat' },
  'chat.lock.min':        { id: 'PIN minimal 4 digit.', en: 'PIN must be at least 4 digits.' },
  'chat.lock.mismatch':   { id: 'PIN tidak cocok.', en: 'PINs do not match.' },
  'chat.lock.wrong':      { id: 'PIN salah.', en: 'Wrong PIN.' },

  // Chat — conversation list
  'chat.messages':  { id: 'Pesan', en: 'Messages' },
  'chat.new':       { id: 'Chat Baru', en: 'New Chat' },
  'chat.searchconv':{ id: 'Cari percakapan...', en: 'Search conversations...' },
  'chat.startnew':  { id: 'Mulai chat baru', en: 'Start a new chat' },
  'chat.you':       { id: 'Anda: ', en: 'You: ' },
  'chat.online':    { id: 'online', en: 'online' },
  'chat.searchuser':{ id: 'Cari nama atau username...', en: 'Search name or username...' },

  // Chat — thread + bubble
  'chat.back':      { id: 'Kembali', en: 'Back' },
  'chat.options':   { id: 'Opsi', en: 'Options' },
  'chat.nomsg':     { id: 'Belum ada pesan', en: 'No messages yet' },
  'chat.tolatest':  { id: 'Ke pesan terbaru', en: 'To latest message' },
  'chat.nostarred': { id: 'Belum ada pesan berbintang di percakapan ini.', en: 'No starred messages in this conversation.' },
  'chat.reply':     { id: 'Balas', en: 'Reply' },
  'chat.forward':   { id: 'Teruskan', en: 'Forward' },
  'chat.editmsg':   { id: 'Edit pesan', en: 'Edit message' },
  'chat.delmsg':    { id: 'Hapus pesan', en: 'Delete message' },
  'chat.edited':    { id: 'diedit', en: 'edited' },
  'chat.sent':      { id: 'Terkirim', en: 'Sent' },
  'chat.delivered': { id: 'Diterima', en: 'Delivered' },
  'chat.read':      { id: 'Dibaca', en: 'Read' },
  'chat.react':     { id: 'Beri reaksi', en: 'React' },

  // Chat — forward
  'chat.forwardto': { id: 'Teruskan ke…', en: 'Forward to…' },
  'chat.noconv':    { id: 'Belum ada percakapan.', en: 'No conversations yet.' },
  'chat.forwarded': { id: 'Terkirim ✓', en: 'Sent ✓' },

  // Superadmin dashboard
  'adm.panel':       { id: 'Admin Panel', en: 'Admin Panel' },
  'adm.tab.pending': { id: 'Pending', en: 'Pending' },
  'adm.tab.audit':   { id: 'Log Audit', en: 'Audit Log' },
  'adm.tab.settings':{ id: 'Pengaturan', en: 'Settings' },
  'adm.loading':     { id: 'Memuat...', en: 'Loading...' },
  'adm.pendingdesc': { id: 'Pendaftaran baru yang menunggu persetujuan.', en: 'New registrations awaiting approval.' },
  'adm.noreg':       { id: 'Tidak ada pendaftaran.', en: 'No registrations.' },
  'adm.reject':      { id: 'Tolak Pendaftaran', en: 'Reject Registration' },
  'adm.rejectreason':{ id: 'Alasan penolakan (opsional)', en: 'Rejection reason (optional)' },
  'adm.reasonph':    { id: 'Masukkan alasan...', en: 'Enter a reason...' },
  'adm.searchuser':  { id: 'Cari username / nama...', en: 'Search username / name...' },
  'adm.allregions':  { id: 'Semua Wilayah', en: 'All Regions' },
  'adm.allunits':    { id: 'Semua Unit', en: 'All Units' },
  'adm.usernamereq': { id: 'Username *', en: 'Username *' },
  'adm.passwordreq': { id: 'Password *', en: 'Password *' },
  'adm.email':       { id: 'Email', en: 'Email' },
  'adm.fullnameph':  { id: 'Nama lengkap', en: 'Full name' },
  'adm.confirmdel':  { id: 'Yakin hapus?', en: 'Delete for sure?' },
  'adm.resetpw':     { id: 'Reset Password (kosong = tidak berubah)', en: 'Reset Password (blank = unchanged)' },
  'adm.newpwph':     { id: 'Password baru min. 6 karakter', en: 'New password, min. 6 characters' },
  'adm.chataccess':  { id: 'Akses Fitur Chat', en: 'Chat Feature Access' },
  'adm.emoji':       { id: 'Emoji', en: 'Emoji' },
  'adm.noaudit':     { id: 'Belum ada aktivitas tercatat.', en: 'No activity recorded yet.' },
  'adm.announce':    { id: 'Pengumuman', en: 'Announcements' },
  'adm.anntitle':    { id: 'Judul pengumuman', en: 'Announcement title' },
  'adm.annbody':     { id: 'Isi pengumuman…', en: 'Announcement body…' },
  'adm.allroles':    { id: 'Semua role', en: 'All roles' },
  'adm.allregions2': { id: 'Semua wilayah', en: 'All regions' },
  'adm.allunits2':   { id: 'Semua unit', en: 'All units' },
  'adm.role.admin':  { id: 'Admin', en: 'Admin' },
  'adm.role.user':   { id: 'User', en: 'User' },
  'adm.role.guest':  { id: 'Guest', en: 'Guest' },
  'adm.annsent':     { id: 'Pengumuman terkirim.', en: 'Announcement sent.' },
  'adm.regrejected': { id: 'Pendaftaran ditolak.', en: 'Registration rejected.' },
  'adm.annfail':     { id: 'Gagal mengirim pengumuman.', en: 'Failed to send announcement.' },
  'adm.userupdated': { id: 'User diperbarui.', en: 'User updated.' },
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
