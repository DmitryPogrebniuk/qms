/**
 * Recording detail page with Evaluations tab
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Tabs,
  Tab,
  Box,
  Button,
  Paper,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { getRecording, type Recording } from '../services/recordingsApi';
import {
  getRecordingEvaluations,
  getScorecards,
  createEvaluation,
  type Evaluation,
  type Scorecard,
} from '../services/evaluationsApi';

export default function Recording() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [rec, evals, scs] = await Promise.all([
        getRecording(id),
        getRecordingEvaluations(id),
        getScorecards(false),
      ]);
      setRecording(rec);
      setEvaluations(evals);
      setScorecards(scs);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleCreateEvaluation = async (scorecardId: string) => {
    if (!id) return;
    setCreating(true);
    setError(null);
    try {
      const ev = await createEvaluation({ recordingId: id, scorecardId });
      navigate(`/evaluations/${ev.id}`);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading || !recording) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('recording.title', 'Recording')} - {recording.agentName || recording.agentId}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('recording.tab.info', 'Info')} />
        <Tab label={t('recording.tab.evaluations', 'Evaluations')} />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1">
            {t('recording.startTime', 'Start')}: {recording.startTime && new Date(recording.startTime).toLocaleString()}
          </Typography>
          <Typography variant="body1">
            {t('recording.duration', 'Duration')}: {recording.durationSeconds != null ? `${Math.floor(recording.durationSeconds / 60)}:${String(recording.durationSeconds % 60).padStart(2, '0')}` : '-'}
          </Typography>
          <Typography variant="body1">
            {t('recording.direction', 'Direction')}: {recording.direction || '-'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 2 }}
            onClick={() => navigate('/search')}
          >
            {t('common.back', 'Back to Search')}
          </Button>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{t('recording.tab.evaluations', 'Evaluations')}</Typography>
            {evaluations.length === 0 && scorecards.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('evaluation.selectScorecard', 'Select a scorecard to create evaluation')}
              </Typography>
            )}
          </Box>

          {evaluations.length > 0 && (
            <List>
              {evaluations.map((ev) => (
                <ListItem
                  key={ev.id}
                  button
                  onClick={() => navigate(`/evaluations/${ev.id}`)}
                >
                  <ListItemText
                    primary={ev.scorecard?.name || ev.scorecardTemplate?.name}
                    secondary={`${ev.finalScore ?? ev.totalScore ?? 0}% - ${ev.status} - ${new Date(ev.createdAt).toLocaleDateString()}`}
                  />
                </ListItem>
              ))}
            </List>
          )}

          {evaluations.length === 0 && scorecards.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {scorecards.map((sc) => (
                <Button
                  key={sc.id}
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => handleCreateEvaluation(sc.id)}
                  disabled={creating}
                >
                  {t('evaluation.createWith', 'Create with')} {sc.name}
                </Button>
              ))}
            </Box>
          )}

          {evaluations.length === 0 && scorecards.length === 0 && (
            <Typography color="text.secondary">
              {t('evaluation.noScorecards', 'No active scorecards. Create one in Scorecards.')}
            </Typography>
          )}
        </Paper>
      )}
    </Container>
  );
}
