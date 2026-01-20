import { Container, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export default function Coaching() {
  const { t } = useTranslation()

  return (
    <Container maxWidth="lg">
      <Typography variant="h4">{t('coaching.title')}</Typography>
    </Container>
  )
}
