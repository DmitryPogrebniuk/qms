/**
 * Scorecards list and management
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  getScorecards,
  deleteScorecard,
  type Scorecard,
} from '../services/evaluationsApi';

export default function Scorecards() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getScorecards(true);
      setScorecards(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load scorecards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('common.confirmDelete', 'Are you sure?'))) return;
    try {
      await deleteScorecard(id);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('scorecards.title', 'Scorecards')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/scorecards/new')}
        >
          {t('scorecards.create', 'Create Scorecard')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('scorecards.name', 'Name')}</TableCell>
              <TableCell>{t('scorecards.sections', 'Sections')}</TableCell>
              <TableCell>{t('scorecards.status', 'Status')}</TableCell>
              <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scorecards.map((sc) => (
              <TableRow key={sc.id} hover>
                <TableCell>
                  <Typography variant="body1" fontWeight={500}>
                    {sc.name}
                  </Typography>
                  {sc.description && (
                    <Typography variant="caption" color="text.secondary">
                      {sc.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{sc.sections?.length || 0}</TableCell>
                <TableCell>
                  <Chip
                    label={sc.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                    color={sc.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/scorecards/${sc.id}/edit`)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(sc.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {scorecards.length === 0 && !loading && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('scorecards.empty', 'No scorecards yet. Create one to get started.')}
        </Typography>
      )}
    </Container>
  );
}
