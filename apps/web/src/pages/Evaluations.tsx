import { Container, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export default function Evaluations() {
  const { t } = useTranslation()

  return (
    <Container maxWidth="lg">
      <Typography variant="h4">{t('evaluation.title')}</Typography>
    </Container>
  )
}
