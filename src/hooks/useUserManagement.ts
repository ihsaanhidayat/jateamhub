// ─────────────────────────────────────────────────────────────
// useUserManagement — shared hook untuk ProfilePage + SuperadminDashboard
// Extract logic duplikat: filter, pagination, edit, add user
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import { useStore }     from '../store/dashboardStore'
import { getAllowedRegions, getAllowedUnits, getAllowedRoles, getDisplayBadge } from '../utils/roles'
import type { Role } from '../types'
import type { Profile } from '../utils/supabaseClient'

export const EMOJI_PRESETS = [
  '','🌸','🔥','⭐','🎯','💎','🚀','🌊','🦁','🐯',
  '🌺','🎨','💡','🍀','🎭','🏆','🦋','🌙','☀️','🍉',
]

const PER_PAGE = 50

export function useUserManagement() {
  const { profile, users, loadUsers, addUser, updateUser, removeUser } = useAuthStore()
  const { toast } = useStore()

  // Filters
  const [search,       setSearch]       = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterUnit,   setFilterUnit]   = useState('')
  const [filterRole,   setFilterRole]   = useState('')
  const [page,         setPage]         = useState(0)

  // Edit state
  const [editTarget,   setEditTarget]   = useState<Profile | null>(null)
  const [editRole,     setEditRole]     = useState<Role>('user')
  const [editUnit,     setEditUnit]     = useState('')
  const [editRegion,   setEditRegion]   = useState('global')
  const [editUnitScope,setEditUnitScope]= useState('general')
  const [editPass,     setEditPass]     = useState('')
  const [editEmoji,    setEditEmoji]    = useState('')

  // Add state
  const [addMode,      setAddMode]      = useState(false)
  const [newUser,      setNewUser]      = useState('')
  const [newUPass,     setNewUPass]     = useState('')
  const [newRole,      setNewRole]      = useState<Role>('user')
  const [newRegion,    setNewRegion]    = useState('global')
  const [newUnitScope, setNewUnitScope] = useState('general')
  const [newUnitId,    setNewUnitId]    = useState('')

  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const canManage    = profile?.role === 'admin' || profile?.role === 'superadmin'
  const isSuperAdmin = profile?.role === 'superadmin'

  const allowedRegions = getAllowedRegions(profile as any)
  const allowedUnits   = getAllowedUnits(profile as any)
  const allowedRoles   = getAllowedRoles(profile as any)

  useEffect(() => {
    if (canManage) loadUsers()
  }, [canManage])

  // Filter + pagination
  const filteredUsers = useMemo(() => users.filter(u => {
    const matchSearch = !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRegion = !filterRegion || (u.region_scope ?? 'global') === filterRegion
    const matchUnit   = !filterUnit   || (u.unit_scope ?? 'general') === filterUnit
    const matchRole   = !filterRole   || u.role === filterRole
    return matchSearch && matchRegion && matchUnit && matchRole
  }), [users, search, filterRegion, filterUnit, filterRole])

  const pagedUsers  = filteredUsers.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const totalPages  = Math.ceil(filteredUsers.length / PER_PAGE)

  const getBadge = (u: Profile) => getDisplayBadge(u as any)
  const isMe     = (u: Profile) => u.id === profile?.id

  const openEdit = (u: Profile) => {
    setEditTarget(u)
    setEditRole(u.role as Role)
    setEditUnit(u.unit_id ?? '')
    setEditRegion(u.region_scope ?? 'global')
    setEditUnitScope(u.unit_scope ?? 'general')
    setEditPass('')
    setEditEmoji(u.emoji ?? u.avatar_emoji ?? '')
    setErr('')
    setAddMode(false)
  }

  const openAdd = () => {
    setEditTarget(null)
    setAddMode(true)
    setNewUser(''); setNewUPass('')
    setNewRole('user'); setNewRegion('global')
    setNewUnitScope('general'); setNewUnitId('')
    setErr('')
  }

  const handleSaveUser = async () => {
    if (!editTarget) return
    setErr(''); setSaving(true)
    const error = await updateUser(
      editTarget.id, editRole, editUnit,
      editPass || undefined, editEmoji,
      editRegion, editUnitScope,
    )
    setSaving(false)
    if (error) { setErr(error); return }
    toast('User diperbarui.', 'success')
    setEditTarget(null)
    loadUsers(true)
  }

  const handleAddUser = async () => {
    setErr(''); setSaving(true)
    const error = await addUser(newUser.trim(), newUPass, newRole, newUnitId, newRegion, newUnitScope)
    setSaving(false)
    if (error) { setErr(error); return }
    toast(`"${newUser}" ditambahkan.`, 'success')
    setNewUser(''); setNewUPass(''); setNewRole('user')
    setNewRegion('global'); setNewUnitScope('general'); setNewUnitId('')
    setAddMode(false)
    loadUsers(true)
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Hapus user "${username}"? Tindakan ini tidak dapat dibatalkan.`)) return
    const error = await removeUser(userId)
    if (error) { toast(error, 'error'); return }
    toast(`User "${username}" dihapus.`, 'success')
    loadUsers(true)
  }

  return {
    // Data
    users, filteredUsers, pagedUsers, totalPages, page, setPage,
    // Filters
    search, setSearch, filterRegion, setFilterRegion,
    filterUnit, setFilterUnit, filterRole, setFilterRole,
    // Edit
    editTarget, editRole, setEditRole, editUnit, setEditUnit,
    editRegion, setEditRegion, editUnitScope, setEditUnitScope,
    editPass, setEditPass, editEmoji, setEditEmoji,
    // Add
    addMode, setAddMode, openAdd,
    newUser, setNewUser, newUPass, setNewUPass,
    newRole, setNewRole, newRegion, setNewRegion,
    newUnitScope, setNewUnitScope, newUnitId, setNewUnitId,
    // Actions
    openEdit, handleSaveUser, handleAddUser, handleDeleteUser,
    // Status
    saving, err, setErr, getBadge, isMe,
    // Permissions
    canManage, isSuperAdmin, allowedRegions, allowedUnits, allowedRoles,
    // Utils
    profile, loadUsers,
  }
}
