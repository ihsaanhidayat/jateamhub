(function(){
  try {
    var dark = ['midnight','slate','obsidian','dark-mint','dark-soft','enterprise',
      'aurora-dark','sand-dark','slate-dark','pearl-dark','ivory-dark','sage-dark','dark']
    var stored = ''
    try { var a = JSON.parse(localStorage.getItem('jateamhub-appearance') || '{}'); stored = a.theme || '' } catch(e) {}
    if (!stored) stored = localStorage.getItem('jateamhub-theme') || ''
    var isDark = stored ? dark.indexOf(stored) >= 0 : window.matchMedia('(prefers-color-scheme: dark)').matches
    var resolved = isDark ? 'midnight' : 'parchment'
    document.documentElement.setAttribute('data-theme', resolved)
    var color = isDark ? '#0A0D1A' : '#F7F3EE'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', color)
  } catch(e) {}
})()
