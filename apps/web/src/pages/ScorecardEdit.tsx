/**
 * Scorecard Builder - create/edit scorecard with sections and questions
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Box,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  getScorecard,
  createScorecard,
  updateScorecard,
  type Scorecard,
  type ScorecardSection,
  type ScorecardQuestion,
} from '../services/evaluationsApi';

const QUESTION_TYPES = [
  { value: 'YES_NO', label: 'Yes/No' },
  { value: 'SCALE', label: 'Scale 1-5' },
  { value: 'TEXT', label: 'Text' },
  { value: 'DROPDOWN', label: 'Dropdown' },
  { value: 'CRITICAL', label: 'Critical' },
];

export default function ScorecardEdit() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isNew = location.pathname.endsWith('/new') || id === 'new' || !id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<Array<ScorecardSection & { questions: ScorecardQuestion[] }>>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && id) {
      setLoading(true);
      getScorecard(id)
        .then((sc) => {
          setName(sc.name);
          setDescription(sc.description || '');
          setSections(
            (sc.sections || []).map((s) => ({
              ...s,
              questions: s.questions || [],
            })),
          );
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const addSection = () => {
    setSections([
      ...sections,
      {
        id: '',
        name: '',
        weight: 1,
        order: sections.length,
        questions: [],
      } as any,
    ]);
  };

  const updateSection = (idx: number, field: string, value: unknown) => {
    const next = [...sections];
    (next[idx] as any)[field] = value;
    setSections(next);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const addQuestion = (sectionIdx: number) => {
    const next = [...sections];
    const qs = next[sectionIdx].questions || [];
    qs.push({
      id: '',
      text: '',
      type: 'TEXT',
      weight: 1,
      isCritical: false,
      order: qs.length,
    } as any);
    next[sectionIdx] = { ...next[sectionIdx], questions: qs };
    setSections(next);
  };

  const updateQuestion = (sectionIdx: number, qIdx: number, field: string, value: unknown) => {
    const next = [...sections];
    const qs = [...(next[sectionIdx].questions || [])];
    (qs[qIdx] as any)[field] = value;
    next[sectionIdx] = { ...next[sectionIdx], questions: qs };
    setSections(next);
  };

  const removeQuestion = (sectionIdx: number, qIdx: number) => {
    const next = [...sections];
    const qs = (next[sectionIdx].questions || []).filter((_, i) => i !== qIdx);
    next[sectionIdx] = { ...next[sectionIdx], questions: qs };
    setSections(next);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('scorecards.nameRequired', 'Name is required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        sections: sections.map((s, si) => ({
          name: s.name,
          weight: s.weight,
          order: si,
          questions: (s.questions || []).map((q, qi) => ({
            text: q.text,
            type: q.type,
            weight: q.weight,
            isCritical: q.isCritical,
            options: q.options,
            order: qi,
          })),
        })),
      };
      if (isNew) {
        await createScorecard(payload);
        navigate('/scorecards');
      } else {
        await updateScorecard(id!, payload);
        navigate('/scorecards');
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {isNew ? t('scorecards.create', 'Create Scorecard') : t('scorecards.edit', 'Edit Scorecard')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          label={t('scorecards.name', 'Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          multiline
          rows={2}
          label={t('scorecards.description', 'Description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Paper>

      {sections.map((section, sIdx) => (
        <Accordion key={sIdx} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <TextField
                size="small"
                placeholder={t('scorecards.sectionName', 'Section name')}
                value={section.name}
                onChange={(e) => updateSection(sIdx, 'name', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                sx={{ minWidth: 200 }}
              />
              <TextField
                size="small"
                type="number"
                label={t('scorecards.weight', 'Weight')}
                value={section.weight}
                onChange={(e) => updateSection(sIdx, 'weight', parseFloat(e.target.value) || 1)}
                onClick={(e) => e.stopPropagation()}
                sx={{ width: 80 }}
              />
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeSection(sIdx); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {(section.questions || []).map((q, qIdx) => (
              <Box key={qIdx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t('scorecards.questionText', 'Question text')}
                  value={q.text}
                  onChange={(e) => updateQuestion(sIdx, qIdx, 'text', e.target.value)}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={q.type}
                    label="Type"
                    onChange={(e) => updateQuestion(sIdx, qIdx, 'type', e.target.value)}
                  >
                    {QUESTION_TYPES.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="number"
                  label="Weight"
                  value={q.weight}
                  onChange={(e) => updateQuestion(sIdx, qIdx, 'weight', parseFloat(e.target.value) || 1)}
                  sx={{ width: 80 }}
                />
                <Chip
                  label="Critical"
                  color={q.isCritical ? 'error' : 'default'}
                  size="small"
                  onClick={() => updateQuestion(sIdx, qIdx, 'isCritical', !q.isCritical)}
                />
                <IconButton size="small" onClick={() => removeQuestion(sIdx, qIdx)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => addQuestion(sIdx)}
            >
              {t('scorecards.addQuestion', 'Add Question')}
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}

      <Button startIcon={<AddIcon />} onClick={addSection} sx={{ mt: 2 }}>
        {t('scorecards.addSection', 'Add Section')}
      </Button>

      <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={24} /> : t('common.save', 'Save')}
        </Button>
        <Button onClick={() => navigate('/scorecards')}>{t('common.cancel', 'Cancel')}</Button>
      </Box>
    </Container>
  );
}
