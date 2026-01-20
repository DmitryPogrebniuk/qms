import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Typography,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useHttpClient } from '@/hooks/useHttpClient'

interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUsername: string
  smtpPassword: string
  fromAddress: string
  fromName: string
  useTls: boolean
  enabled: boolean
}

export default function EmailSettings() {
  const { t } = useTranslation()
  const client = useHttpClient()
  const [config, setConfig] = useState<EmailConfig>({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    fromAddress: '',
    fromName: 'QMS',
    useTls: true,
    enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await client.get('/integrations/email')
        setConfig(response.data)
      } catch (error) {
        console.error('Failed to load Email settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [client])

  const handleChange = (field: keyof EmailConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [field]: field === 'smtpPort' ? parseInt(value) : value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await client.put('/integrations/email', config)
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
        {t('admin.emailDescription')}
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.smtpHost')}
            value={config.smtpHost}
            onChange={(e) => handleChange('smtpHost', e.target.value)}
            placeholder="smtp.gmail.com"
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.smtpPort')}
            type="number"
            value={config.smtpPort}
            onChange={(e) => handleChange('smtpPort', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.smtpUsername')}
            value={config.smtpUsername}
            onChange={(e) => handleChange('smtpUsername', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.smtpPassword')}
            type="password"
            value={config.smtpPassword}
            onChange={(e) => handleChange('smtpPassword', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.fromAddress')}
            type="email"
            value={config.fromAddress}
            onChange={(e) => handleChange('fromAddress', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={t('admin.fromName')}
            value={config.fromName}
            onChange={(e) => handleChange('fromName', e.target.value)}
            disabled={saving}
          />
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={config.useTls}
                onChange={(e) => handleChange('useTls', e.target.checked)}
                disabled={saving}
              />
            }
            label={t('admin.useTls')}
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
              smtpHost: '',
              smtpPort: 587,
              smtpUsername: '',
              smtpPassword: '',
              fromAddress: '',
              fromName: 'QMS',
              useTls: true,
              enabled: false,
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
