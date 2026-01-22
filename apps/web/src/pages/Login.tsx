import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Paper,
  TextField,
  Button,
  Alert,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useHttpClient } from '@/hooks/useHttpClient'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const client = useHttpClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await client.post('/auth/login', {
        username,
        password,
      })

      // Store JWT token
      localStorage.setItem('jwt_token', response.data.jwt)

      // Navigate to dashboard
      navigate('/')
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || t('login.error')
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" align="center" sx={{ mb: 4, fontWeight: 'bold' }}>
          {t('login.title', 'QMS Login')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleLogin} noValidate>
          <TextField
            fullWidth
            label={t('login.username', 'Username')}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            disabled={loading}
            required
          />

          <TextField
            fullWidth
            label={t('login.password', 'Password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            disabled={loading}
            required
          />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            sx={{ mt: 3 }}
            disabled={loading}
            type="submit"
          >
            {loading ? <CircularProgress size={24} /> : t('login.submit', 'Login')}
          </Button>

          <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
            {t('login.hint', 'Demo credentials: boss / boss')}
          </Typography>
        </Box>
      </Paper>
    </Container>
  )
}
