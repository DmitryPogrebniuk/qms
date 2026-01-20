import { Container, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export default function Recording() {
  const { t } = useTranslation()

  return (
    <Container maxWidth="lg">
      <Typography variant="h4">{t('recording.title')}</Typography>
    </Container>
  )
}
