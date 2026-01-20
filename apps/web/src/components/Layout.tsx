import { AppBar, Toolbar, Typography, Box, Container, Drawer, List, ListItem, ListItemButton, ListItemText, Button, Divider, IconButton } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import LanguageSwitcher from './LanguageSwitcher'
import { useHttpClient } from '@/hooks/useHttpClient'

export default function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const client = useHttpClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        // Decode JWT to get user role
        const token = localStorage.getItem('jwt_token')
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          const role = payload.roles?.[0] || 'USER'
          setUserRole(role)
        }
      } catch (error) {
        console.error('Failed to decode token:', error)
      }
    }

    checkUserRole()
  }, [client])

  const menuItems = [
    { label: t('nav.dashboard'), path: '/' },
    { label: t('nav.search'), path: '/search' },
    { label: t('nav.evaluations'), path: '/evaluations' },
    { label: t('nav.coaching'), path: '/coaching' },
  ]

  const adminItems = userRole === 'ADMIN' ? [
    { label: t('nav.adminSettings'), path: '/admin/settings' },
  ] : []

  const handleLogout = () => {
    localStorage.removeItem('jwt_token')
    navigate('/login')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" sx={{ background: '#FF8C00' }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Cisco QMS
          </Typography>
          <LanguageSwitcher />
          <Button color="inherit" onClick={handleLogout}>
            {t('auth.logout')}
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{ width: 250 }}
        >
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  onClick={() => {
                    navigate(item.path)
                    setDrawerOpen(false)
                  }}
                >
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
            {adminItems.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                {adminItems.map((item) => (
                  <ListItem key={item.path} disablePadding>
                    <ListItemButton
                      onClick={() => {
                        navigate(item.path)
                        setDrawerOpen(false)
                      }}
                      sx={{ backgroundColor: 'rgba(255, 140, 0, 0.1)' }}
                    >
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </>
            )}
          </List>
        </Drawer>

        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  )
}
