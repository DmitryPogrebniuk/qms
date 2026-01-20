import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Typography,
  Divider,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useHttpClient } from '@/hooks/useHttpClient'

interface KeycloakConfig {
  realmUrl: string
  realm: string
  clientId: string
  clientSecret: string
  enabled: boolean
}

export default function KeycloakSettings() {
  const { t } = useTranslation()
  const client = useHttpClient()
  const [config, setConfig] = useState<KeycloakConfig>({
    realmUrl: '',
    realm: 'master',
    clientId: '',
    clientSecret: '',
    enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await client.get('/integrations/keycloak')
        setConfig(response.data)
      } catch (error) {
        console.error('Failed to load Keycloak settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [client])

  const handleChange = (field: keyof KeycloakConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await client.put('/integrations/keycloak', config)
      setMessage({ type: 'success', text: t('admin.settingsSaved') })
      setTimeout(() => setMessage(null), 5000)
    } catch (error) {
      setMessage({ type: 'error', text: t('admin.settingsFailed') })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Typography variant="h6" sx={{ mb: 2 }}>
        {t('admin.keycloakDescription')}
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Alert severity="info" sx={{ mb: 3 }}>
        {t('admin.keycloakNote')}
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={t('admin.keycloakUrl')}
            value={config.realmUrl}
            onChange={(e) => handleChange('realmUrl', e.target.value)}
            placeholder="https://keycloak.example.com"
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.keycloakRealm')}
            value={config.realm}
            onChange={(e) => handleChange('realm', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.keycloakClientId')}
            value={config.clientId}
            onChange={(e) => handleChange('clientId', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label={t('admin.keycloakClientSecret')}
            type="password"
            value={config.clientSecret}
            onChange={(e) => handleChange('clientSecret', e.target.value)}
            disabled={saving}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ minWidth: 120 }}
        >
          {saving ? <CircularProgress size={24} /> : t('admin.save')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setConfig({
              realmUrl: '',
              realm: 'master',
              clientId: '',
              clientSecret: '',
              enabled: true,
            })
          }}
          disabled={saving}
        >
          {t('admin.reset')}
        </Button>
      </Box>
    </Box>
  )
}
