/**
 * Evaluations list
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  TablePagination,
} from '@mui/material';
import { Visibility as ViewIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getEvaluations, type Evaluation } from '../services/evaluationsApi';

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'default',
  SUBMITTED: 'primary',
  ACKNOWLEDGED: 'success',
  DISPUTED: 'warning',
  RESOLVED: 'success',
  APPROVED: 'success',
};

export default function Evaluations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<{ data: Evaluation[]; total: number; page: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEvaluations(page, pageSize);
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePageChange = (_: unknown, newPage: number) => {
    load(newPage + 1, data?.pageSize || 20);
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    load(1, parseInt(e.target.value, 10) || 20);
  };

  if (loading && !data) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const evaluations = data?.data || [];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('evaluation.title', 'Evaluations')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('evaluation.recording', 'Recording')}</TableCell>
              <TableCell>{t('evaluation.agent', 'Agent')}</TableCell>
              <TableCell>{t('evaluation.scorecard', 'Scorecard')}</TableCell>
              <TableCell>{t('evaluation.score', 'Score')}</TableCell>
              <TableCell>{t('evaluation.status', 'Status')}</TableCell>
              <TableCell>{t('evaluation.date', 'Date')}</TableCell>
              <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {evaluations.map((ev) => (
              <TableRow key={ev.id} hover>
                <TableCell>
                  {ev.recording ? (
                    <Typography
                      variant="body2"
                      sx={{ cursor: 'pointer', color: 'primary.main' }}
                      onClick={() => navigate(`/recordings/${ev.recordingId}`)}
                    >
                      {new Date(ev.recording.startTime).toLocaleString()}
                    </Typography>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>{ev.agent?.fullName || ev.agent?.agentId || '-'}</TableCell>
                <TableCell>{ev.scorecard?.name || ev.scorecardTemplate?.name || '-'}</TableCell>
                <TableCell>
                  {ev.finalScore != null || ev.totalScore != null
                    ? `${(ev.finalScore ?? ev.totalScore ?? 0).toFixed(1)}%`
                    : '-'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={ev.status}
                    color={STATUS_COLORS[ev.status] || 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{new Date(ev.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/evaluations/${ev.id}`)}>
                    <ViewIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {data && (
        <TablePagination
          component="div"
          count={data.total}
          page={(data.page || 1) - 1}
          onPageChange={handlePageChange}
          rowsPerPage={data.pageSize || 20}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50]}
        />
      )}

      {evaluations.length === 0 && !loading && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('evaluation.empty', 'No evaluations yet.')}
        </Typography>
      )}
    </Container>
  );
}
