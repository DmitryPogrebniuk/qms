/**
 * Evaluation detail - view/edit form with live score
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Paper,
  Box,
  TextField,
  FormControlLabel,
  Radio,
  RadioGroup,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getEvaluation,
  updateEvaluation,
  submitEvaluation,
  acknowledgeEvaluation,
  disputeEvaluation,
  type Evaluation,
  type EvaluationAnswer,
} from '../services/evaluationsApi';
import { getStreamUrl } from '../services/recordingsApi';

export default function EvaluationDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [answers, setAnswers] = useState<Record<string, EvaluationAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeComment, setDisputeComment] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const ev = await getEvaluation(id);
      setEvaluation(ev);
      const ans: Record<string, EvaluationAnswer> = {};
      (ev.answers || []).forEach((a) => {
        ans[a.questionId] = {
          questionId: a.questionId,
          value: a.value,
          score: a.score,
          comment: a.comment,
        };
      });
      setAnswers(ans);
    } catch (e: any) {
      setError(e.message || 'Failed to load evaluation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const updateAnswer = (questionId: string, field: string, value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateEvaluation(id, {
        answers: Object.values(answers),
      });
      setEvaluation(res);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await submitEvaluation(id);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await acknowledgeEvaluation(id);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDispute = async () => {
    if (!id || !disputeComment.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await disputeEvaluation(id, disputeComment);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !evaluation) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const scorecard = evaluation.scorecard;
  const isDraft = evaluation.status === 'DRAFT';
  const canEdit = isDraft;
  const liveScore = evaluation.finalScore ?? evaluation.totalScore;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('evaluation.detail', 'Evaluation')} - {scorecard?.name || evaluation.scorecardTemplate?.name}
        </Typography>
        <Chip label={evaluation.status} color="primary" />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {/* Recording player */}
        {evaluation.recordingId && (
          <Paper sx={{ p: 2, flex: '1 1 300px' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('evaluation.recording', 'Recording')}
            </Typography>
            <audio controls src={getStreamUrl(evaluation.recordingId)} style={{ width: '100%' }} />
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => navigate(`/recordings/${evaluation.recordingId}`)}
            >
              {t('evaluation.openRecording', 'Open Recording')}
            </Button>
          </Paper>
        )}

        {/* Live score */}
        <Paper sx={{ p: 2, minWidth: 120, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {t('evaluation.score', 'Score')}
          </Typography>
          <Typography variant="h3" color="primary">
            {liveScore != null ? `${liveScore.toFixed(1)}%` : '-'}
          </Typography>
        </Paper>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Form */}
      {scorecard?.sections?.map((section) => (
        <Paper key={section.id} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {section.name} (weight: {section.weight})
          </Typography>
          {(section.questions || []).map((q) => {
            const ans = answers[q.id] || { questionId: q.id };
            return (
              <Box key={q.id} sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {q.text}
                  {q.isCritical && (
                    <Chip label="Critical" size="small" color="error" sx={{ ml: 1 }} />
                  )}
                </Typography>
                {q.type === 'YES_NO' && (
                  <RadioGroup
                    row
                    value={ans.value || ''}
                    onChange={(e) => updateAnswer(q.id, 'value', e.target.value)}
                  >
                    <FormControlLabel value="yes" control={<Radio />} label="Yes" disabled={!canEdit} />
                    <FormControlLabel value="no" control={<Radio />} label="No" disabled={!canEdit} />
                  </RadioGroup>
                )}
                {q.type === 'SCALE' && (
                  <Slider
                    value={parseFloat(ans.value || '0') || 0}
                    onChange={(_, v) => updateAnswer(q.id, 'value', String(v))}
                    min={1}
                    max={5}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    disabled={!canEdit}
                    sx={{ maxWidth: 300 }}
                  />
                )}
                {q.type === 'TEXT' && (
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    value={ans.value || ''}
                    onChange={(e) => updateAnswer(q.id, 'value', e.target.value)}
                    disabled={!canEdit}
                  />
                )}
                {q.type === 'DROPDOWN' && (
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select
                      value={ans.value || ''}
                      onChange={(e) => updateAnswer(q.id, 'value', e.target.value)}
                      disabled={!canEdit}
                    >
                      {(Array.isArray(q.options) ? q.options : []).map((opt: string) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {q.type === 'CRITICAL' && (
                  <RadioGroup
                    row
                    value={ans.value || ''}
                    onChange={(e) => updateAnswer(q.id, 'value', e.target.value)}
                  >
                    <FormControlLabel value="yes" control={<Radio />} label="Pass" disabled={!canEdit} />
                    <FormControlLabel value="no" control={<Radio />} label="Fail" disabled={!canEdit} />
                  </RadioGroup>
                )}
                {canEdit && (
                  <TextField
                    size="small"
                    placeholder={t('evaluation.comment', 'Comment')}
                    value={ans.comment || ''}
                    onChange={(e) => updateAnswer(q.id, 'comment', e.target.value)}
                    sx={{ mt: 1, maxWidth: 400 }}
                    fullWidth
                  />
                )}
              </Box>
            );
          })}
        </Paper>
      ))}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        {canEdit && (
          <>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? <CircularProgress size={24} /> : t('common.save', 'Save')}
            </Button>
            <Button variant="contained" color="primary" onClick={handleSubmit} disabled={saving}>
              {t('evaluation.submit', 'Submit')}
            </Button>
          </>
        )}
        {evaluation.status === 'SUBMITTED' && (
          <Button variant="outlined" onClick={handleAcknowledge} disabled={saving}>
            {t('evaluation.acknowledge', 'Acknowledge')}
          </Button>
        )}
        {evaluation.status === 'SUBMITTED' && (
          <>
            <TextField
              size="small"
              placeholder={t('evaluation.disputeComment', 'Dispute comment')}
              value={disputeComment}
              onChange={(e) => setDisputeComment(e.target.value)}
              sx={{ width: 300 }}
            />
            <Button variant="outlined" color="warning" onClick={handleDispute} disabled={saving || !disputeComment.trim()}>
              {t('evaluation.dispute', 'Dispute')}
            </Button>
          </>
        )}
        <Button onClick={() => navigate(-1)}>{t('common.back', 'Back')}</Button>
      </Box>
    </Container>
  );
}
