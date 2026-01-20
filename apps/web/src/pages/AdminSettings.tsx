import {
  Container,
  Typography,
  Paper,
  Box,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import UccxSettings from '@/components/AdminSettings/UccxSettings'
import MediaSenseSettings from '@/components/AdminSettings/MediaSenseSettings'
import OpenSearchSettings from '@/components/AdminSettings/OpenSearchSettings'
import EmailSettings from '@/components/AdminSettings/EmailSettings'
import KeycloakSettings from '@/components/AdminSettings/KeycloakSettings'
import UsersManagement from '@/components/AdminSettings/UsersManagement'
import { useHttpClient } from '@/hooks/useHttpClient'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function AdminSettings() {
  const { t } = useTranslation()
  const [tabValue, setTabValue] = useState(0)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const client = useHttpClient()

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Decode JWT to check if user is admin
        const token = localStorage.getItem('jwt_token')
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          const role = payload.roles?.[0] || 'USER'
          if (role !== 'ADMIN') {
            setUserRole(null)
            setLoading(false)
            return
          }
          setUserRole(role)
        } else {
          setUserRole(null)
        }
      } catch (error) {
        console.error('Failed to verify admin access:', error)
        setUserRole(null)
      } finally {
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [client])

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Container>
    )
  }

  if (!userRole) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('admin.accessDenied')}
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        {t('admin.integrationSettings')}
      </Typography>

      <Paper sx={{ borderRadius: 2, boxShadow: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={t('admin.uccx')} id="settings-tab-0" aria-controls="settings-tabpanel-0" />
          <Tab
            label={t('admin.mediaSense')}
            id="settings-tab-1"
            aria-controls="settings-tabpanel-1"
          />
          <Tab
            label={t('admin.openSearch')}
            id="settings-tab-2"
            aria-controls="settings-tabpanel-2"
          />
          <Tab label={t('admin.email')} id="settings-tab-3" aria-controls="settings-tabpanel-3" />
          <Tab
            label={t('admin.keycloak')}
            id="settings-tab-4"
            aria-controls="settings-tabpanel-4"
          />
          <Tab
            label={t('admin.users')}
            id="settings-tab-5"
            aria-controls="settings-tabpanel-5"
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <UccxSettings />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <MediaSenseSettings />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <OpenSearchSettings />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <EmailSettings />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <KeycloakSettings />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <UsersManagement />
        </TabPanel>
      </Paper>
    </Container>
  )
}
