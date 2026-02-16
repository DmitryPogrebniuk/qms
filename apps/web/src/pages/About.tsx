import {
  Box,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import InfoIcon from '@mui/icons-material/Info'
import SearchIcon from '@mui/icons-material/Search'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DownloadIcon from '@mui/icons-material/Download'
import AssessmentIcon from '@mui/icons-material/Assessment'
import CodeIcon from '@mui/icons-material/Code'

const APP_VERSION = '1.0.0'
const LINES_OF_CODE = 19_551
const AI_ITERATIONS = 50

export default function About() {
  const { t } = useTranslation()

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, color: '#333' }}>
        {t('about.title', 'Довідка')}
      </Typography>

      {/* User Instructions */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="primary" />
          {t('about.userInstructions', 'Інструкція користувача')}
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <SearchIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText
              primary={t('about.searchTitle', 'Пошук записів')}
              secondary={t('about.searchDesc', 'Використовуйте фільтри за датою, агентом, командою, ANI/DNIS для пошуку розмов.')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <PlayArrowIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText
              primary={t('about.playbackTitle', 'Відтворення')}
              secondary={t('about.playbackDesc', 'Натисніть на запис для відкриття деталей та відтворення аудіо. Підтримується перемотування.')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <DownloadIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText
              primary={t('about.downloadTitle', 'Скачування')}
              secondary={t('about.downloadDesc', 'Файл зберігається як IGTAS_дата_час_DNIS_ANI.mp3')}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AssessmentIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText
              primary={t('about.evaluationsTitle', 'Оцінювання')}
              secondary={t('about.evaluationsDesc', 'Створюйте оцінки розмов, додавайте нотатки та теги.')}
            />
          </ListItem>
        </List>
      </Paper>

      {/* Developer Section */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon color="primary" />
          {t('about.developerSection', 'Про розробника')}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>{t('about.authors', 'Автори')}:</strong> Дмитро Погребнюк та AI
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>{t('about.version', 'Версія')}:</strong> {APP_VERSION}
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>{t('about.linesOfCode', 'Рядків згенерованого коду')}:</strong> {LINES_OF_CODE.toLocaleString()}
        </Typography>
        <Typography variant="body1">
          <strong>{t('about.iterations', 'Кількість ітерацій')}:</strong> {AI_ITERATIONS}+
        </Typography>
      </Paper>
    </Box>
  )
}
