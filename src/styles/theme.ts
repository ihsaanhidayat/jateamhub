export const COLORS = {
  black:    '#0A0A0A',
  bg2:      '#111111',
  bg3:      '#181818',
  bg4:      '#222222',
  border:   '#2A2A2A',
  border2:  '#333333',
  silver:   '#E0E0E0',
  silver2:  '#999999',
  silver3:  '#555555',
  mint:     '#00FFC2',
  mintDim:  '#00CC9A',
  mintBg:   'rgba(0,255,194,0.08)',
  mintBg2:  'rgba(0,255,194,0.14)',
  red:      '#E05555',
  yellow:   '#F0A500',
} as const

export const LAYOUT_WIDTHS: Record<string, number> = {
  default: 0,
  minimal: -40,
  compact: -20,
  wide: +60,
}
