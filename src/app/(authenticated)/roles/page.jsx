'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shield, Plus } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState, LoadingState, PageContainer, PageHeader, AccessDenied } from '@/components/ui/page'

import { useCan } from '@/hooks/useCan'
import * as api from '@/services/centralApi'

import { RoleCard } from './RoleCard'
import { RoleFormModal } from './RoleFormModal'
import { DeleteRoleModal } from './DeleteRoleModal'
import { showToast } from '@/utils/toast-utils'

// /roles page — list, create, edit, delete roles for the active Org.
// Mirrors OSP's /admin/roles orchestrator but slimmer (no admin gate —
// permission-based gating via useCan instead).
export default function RolesPage() {
  const canView = useCan('organization.roles_permissions.view')
  const canManage = useCan('organization.roles_permissions.manage')

  const [roles, setRoles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [selectedRole, setSelectedRole] = useState(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingRole, setDeletingRole] = useState(null)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const list = await api.listRolesForOrg()
      setRoles(list)
    } catch (err) {
      showToast.error(err?.message || 'Failed to load roles')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles
    const q = searchQuery.toLowerCase()
    return roles.filter((role) =>
      (role.name || '').toLowerCase().includes(q) ||
      (role.title || '').toLowerCase().includes(q) ||
      (role.description || '').toLowerCase().includes(q)
    )
  }, [roles, searchQuery])

  const handleOpenCreate = () => {
    setSelectedRole(null)
    setFormMode('create')
    setFormOpen(true)
  }
  const handleOpenEdit = (role) => {
    setSelectedRole(role)
    setFormMode('edit')
    setFormOpen(true)
  }
  const handleOpenDelete = (role) => {
    setDeletingRole(role)
    setDeleteOpen(true)
  }

  const handleFormSuccess = () => {
    setFormOpen(false)
    setSelectedRole(null)
    fetchData()
  }
  const handleDeleteSuccess = () => {
    setDeleteOpen(false)
    setDeletingRole(null)
    fetchData()
  }

  if (!canView) {
    return <AccessDenied module="roles" />
  }

  return (
    <PageContainer size="md">
      <PageHeader
        eyebrow="Access"
        title="Roles"
        description="Manage roles and permissions for this organization."
      >
        {canManage && (
          <Button onClick={handleOpenCreate}  className="gap-2">
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        )}
      </PageHeader>

      {roles.length > 0 && (
        <div className="relative max-w-md">
          <input
            placeholder="Search roles by name, title, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-colors"
          />
          <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400 pointer-events-none" />
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Loading roles…" />
      ) : filteredRoles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={searchQuery ? 'No roles match' : 'No roles yet'}
          description={
            searchQuery
              ? 'Try a different search term.'
              : 'Every organization has Admin and Member by default. Create a custom role to get started.'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              canManage={canManage}
              onEdit={() => handleOpenEdit(role)}
              onDelete={() => handleOpenDelete(role)}
            />
          ))}
        </div>
      )}

      <RoleFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        role={selectedRole}
        onSuccess={handleFormSuccess}
      />

      <DeleteRoleModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        role={deletingRole}
        onSuccess={handleDeleteSuccess}
      />
    </PageContainer>
  )
}