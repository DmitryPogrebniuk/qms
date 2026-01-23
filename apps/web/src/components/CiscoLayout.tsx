import { 
  Box, 
  Typography, 
  IconButton, 
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  Divider
} from '@mui/material'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import HomeIcon from '@mui/icons-material/Home'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ArticleIcon from '@mui/icons-material/Article'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ListAltIcon from '@mui/icons-material/ListAlt'
import SettingsIcon from '@mui/icons-material/Settings'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SchoolIcon from '@mui/icons-material/School'
import PersonIcon from '@mui/icons-material/Person'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import { useHttpClient } from '@/hooks/useHttpClient'

// Cisco CUIC style sidebar navigation item
interface NavItemProps {
  icon: React.ReactNode
  label: string
  path: string
  isActive: boolean
  onClick: () => void
}

function NavItem({ icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Tooltip title={label} placement="right">
      <Box
        onClick={onClick}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 8px',
          cursor: 'pointer',
          backgroundColor: isActive ? '#049FD9' : 'transparent',
          borderRadius: isActive ? '8px' : 0,
          margin: isActive ? '4px 8px' : '4px 8px',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: isActive ? '#049FD9' : 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
          },
        }}
      >
        <Box sx={{ 
          color: '#FFFFFF', 
          display: 'flex', 
          alignItems: 'center',
          mb: 0.5
        }}>
          {icon}
        </Box>
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#FFFFFF', 
            fontSize: '10px',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: 60,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  )
}

export default function CiscoLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const client = useHttpClient()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('User')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const token = localStorage.getItem('jwt_token')
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          const role = payload.roles?.[0] || 'USER'
          setUserRole(role)
          setUserName(payload.username || payload.sub || 'User')
        }
      } catch (error) {
        console.error('Failed to decode token:', error)
      }
    }
    checkUserRole()
  }, [client])

  const mainNavItems = [
    { icon: <HomeIcon />, label: t('nav.dashboard'), path: '/' },
    { icon: <DashboardIcon />, label: t('ciscoNav.reportDashboards', 'Dashboards') },
    { icon: <ArticleIcon />, label: t('nav.search'), path: '/search' },
    { icon: <AssessmentIcon />, label: t('nav.evaluations'), path: '/evaluations' },
    { icon: <ListAltIcon />, label: t('ciscoNav.valueLists', 'Value Lists') },
    { icon: <SchoolIcon />, label: t('nav.coaching'), path: '/coaching' },
  ]

  const adminNavItems = userRole === 'ADMIN' ? [
    { icon: <SettingsIcon />, label: t('nav.adminSettings'), path: '/admin/settings' },
    { icon: <ScheduleIcon />, label: t('ciscoNav.schedules', 'Schedules') },
  ] : []

  const allNavItems = [...mainNavItems, ...adminNavItems].filter(item => item.path)

  const handleLogout = () => {
    localStorage.removeItem('jwt_token')
    navigate('/login')
    setAnchorEl(null)
  }

  const getRoleName = (role: string | null) => {
    switch (role) {
      case 'ADMIN': return t('users.roleAdmin', 'Administrator')
      case 'QA': return t('users.roleQa', 'QA')
      case 'SUPERVISOR': return t('users.roleSupervisor', 'Supervisor')
      default: return t('users.roleUser', 'User')
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Cisco-style Sidebar */}
      <Box
        sx={{
          width: 80,
          backgroundColor: '#2D2D2D',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 1,
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1200,
        }}
      >
        {/* Cisco Logo */}
        <Box sx={{ 
          padding: '16px 8px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <Typography 
            sx={{ 
              color: '#049FD9', 
              fontWeight: 'bold', 
              fontSize: '14px',
              letterSpacing: '1px'
            }}
          >
            ahah
          </Typography>
          <Typography 
            sx={{ 
              color: '#049FD9', 
              fontWeight: 'bold', 
              fontSize: '11px',
              letterSpacing: '2px'
            }}
          >
            CISCO
          </Typography>
        </Box>

        {/* Navigation Items */}
        <Box sx={{ flex: 1, width: '100%', overflowY: 'auto' }}>
          {allNavItems.map((item) => (
            <NavItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path!}
              isActive={location.pathname === item.path || 
                (item.path === '/' && location.pathname === '/') ||
                (item.path !== '/' && location.pathname.startsWith(item.path!))}
              onClick={() => navigate(item.path!)}
            />
          ))}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, marginLeft: '80px', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            height: 56,
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E0E0E0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 1100,
          }}
        >
          <Typography 
            variant="h6" 
            sx={{ 
              color: '#333333',
              fontWeight: 400,
              fontSize: '16px'
            }}
          >
            Cisco Unified Intelligence Center
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ThemeSwitcher />
            <LanguageSwitcher />
            
            <IconButton size="small">
              <SearchIcon />
            </IconButton>

            <Box 
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.04)'
                }
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#E0E0E0' }}>
                <PersonIcon sx={{ color: '#757575' }} />
              </Avatar>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                  {userName}
                </Typography>
                <Typography variant="caption" sx={{ color: '#757575', lineHeight: 1 }}>
                  {getRoleName(userRole)}
                </Typography>
              </Box>
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled>
                <Typography variant="body2">{userName}</Typography>
              </MenuItem>
              <MenuItem disabled>
                <Typography variant="caption" color="textSecondary">
                  {getRoleName(userRole)}
                </Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                {t('auth.logout')}
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Page Content with subtle gradient background like CUIC */}
        <Box
          sx={{
            flex: 1,
            background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(240,248,255,0.5) 25%, rgba(255,250,240,0.5) 50%, rgba(240,255,250,0.5) 75%, rgba(248,248,255,0.5) 100%)',
            padding: 3,
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          <Outlet />
        </Box>

        {/* Footer */}
        <Box
          sx={{
            padding: '16px 24px',
            textAlign: 'center',
            borderTop: '1px solid #E0E0E0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Typography variant="caption" sx={{ color: '#757575' }}>
            Copyright © 2010 - 2026 Cisco Systems, Inc. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
