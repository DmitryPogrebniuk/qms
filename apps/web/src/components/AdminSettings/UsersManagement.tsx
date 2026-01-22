import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useHttpClient } from '@/hooks/useHttpClient'

interface User {
  id: string
  username: string
  email?: string
  fullName?: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface NewUser {
  username: string
  password: string
  email: string
  fullName: string
  role: string
}

export default function UsersManagement() {
  const { t } = useTranslation()
  const client = useHttpClient()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<NewUser>({
    username: '',
    password: '',
    email: '',
    fullName: '',
    role: 'USER',
  })
  const [editFormData, setEditFormData] = useState<Partial<User> & { password?: string }>({})

  // Load users
  useEffect(() => {
    loadUsers()
  }, [client])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await client.get('/users')
      setUsers(response.data)
    } catch (err: any) {
      setError(err.response?.data?.message || t('users.loadError', 'Failed to load users'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    try {
      await client.post('/users', formData)
      setMessage({ type: 'success', text: t('users.created', 'User created successfully') })
      setFormData({ username: '', password: '', email: '', fullName: '', role: 'USER' })
      setOpenDialog(false)
      loadUsers()
      setTimeout(() => setMessage(null), 5000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || t('users.createError', 'Failed to create user') })
    }
  }

  const handleEditUser = async () => {
    if (!editingUser) return
    try {
      await client.put(`/users/${editingUser.id}`, editFormData)
      setMessage({ type: 'success', text: t('users.updated', 'User updated successfully') })
      setEditingUser(null)
      setEditFormData({})
      setOpenDialog(false)
      loadUsers()
      setTimeout(() => setMessage(null), 5000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || t('users.updateError', 'Failed to update user') })
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm(t('users.deleteConfirm', 'Are you sure you want to delete this user?'))) {
      return
    }

    try {
      await client.delete(`/users/${id}`)
      setMessage({ type: 'success', text: t('users.deleted', 'User deleted successfully') })
      loadUsers()
      setTimeout(() => setMessage(null), 5000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || t('users.deleteError', 'Failed to delete user') })
    }
  }

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setEditFormData({
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
      })
    } else {
      setEditingUser(null)
      setFormData({ username: '', password: '', email: '', fullName: '', role: 'USER' })
    }
    setOpenDialog(true)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ py: 3 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity={message.type} sx={{ mb: 2 }}>{message.text}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <h2>{t('users.title', 'User Management')}</h2>
        <Button variant="contained" color="primary" onClick={() => handleOpenDialog()}>
          {t('users.addUser', 'Add New User')}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>{t('users.username', 'Username')}</TableCell>
              <TableCell>{t('users.email', 'Email')}</TableCell>
              <TableCell>{t('users.fullName', 'Full Name')}</TableCell>
              <TableCell>{t('users.role', 'Role')}</TableCell>
              <TableCell>{t('users.status', 'Status')}</TableCell>
              <TableCell align="right">{t('users.actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email || '-'}</TableCell>
                <TableCell>{user.fullName || '-'}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{user.isActive ? t('users.active', 'Active') : t('users.inactive', 'Inactive')}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenDialog(user)}
                    title={t('users.edit', 'Edit')}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteUser(user.id)}
                    title={t('users.delete', 'Delete')}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? t('users.editUser', 'Edit User') : t('users.newUser', 'Create New User')}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {editingUser ? (
            <>
              <TextField
                fullWidth
                label={t('users.username', 'Username')}
                value={editingUser.username}
                disabled
              />
              <TextField
                fullWidth
                label={t('users.email', 'Email')}
                type="email"
                value={editFormData.email || ''}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
              <TextField
                fullWidth
                label={t('users.fullName', 'Full Name')}
                value={editFormData.fullName || ''}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
              />
              <TextField
                fullWidth
                label={t('users.password', 'New Password (leave empty to keep current)')}
                type="password"
                value={(editFormData as any).password || ''}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
              />
              <Select
                value={editFormData.role || 'USER'}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
              >
                <MenuItem value="ADMIN">{t('users.roleAdmin', 'Admin')}</MenuItem>
                <MenuItem value="QA">{t('users.roleQa', 'QA')}</MenuItem>
                <MenuItem value="SUPERVISOR">{t('users.roleSupervisor', 'Supervisor')}</MenuItem>
                <MenuItem value="USER">{t('users.roleUser', 'User')}</MenuItem>
              </Select>
              <FormControlLabel
                control={
                  <Switch
                    checked={editFormData.isActive !== false}
                    onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                  />
                }
                label={t('users.active', 'Active')}
              />
            </>
          ) : (
            <>
              <TextField
                fullWidth
                label={t('users.username', 'Username')}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label={t('users.password', 'Password')}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label={t('users.email', 'Email')}
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <TextField
                fullWidth
                label={t('users.fullName', 'Full Name')}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <MenuItem value="ADMIN">{t('users.roleAdmin', 'Admin')}</MenuItem>
                <MenuItem value="QA">{t('users.roleQa', 'QA')}</MenuItem>
                <MenuItem value="SUPERVISOR">{t('users.roleSupervisor', 'Supervisor')}</MenuItem>
                <MenuItem value="USER">{t('users.roleUser', 'User')}</MenuItem>
              </Select>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={editingUser ? handleEditUser : handleAddUser}
            variant="contained"
            color="primary"
          >
            {editingUser ? t('common.save', 'Save') : t('users.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
