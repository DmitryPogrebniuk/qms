/**
 * Recording Search Filters Panel
 * Left sidebar with all filter options including date presets, duration, direction, agents, teams, etc.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  ButtonGroup,
  Slider,
  FormControlLabel,
  Checkbox,
  Autocomplete,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Today as TodayIcon,
  Timer as TimerIcon,
  CallReceived as InboundIcon,
  CallMade as OutboundIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Queue as QueueIcon,
  LocalOffer as TagIcon,
  Phone as PhoneIcon,
  Mic as MicIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { RecordingSearchParams, FilterOption, getFilterOptions, formatDuration } from '../../services/recordingsApi';

interface RecordingsSearchFiltersProps {
  filters: RecordingSearchParams;
  onChange: (filters: RecordingSearchParams) => void;
  onSearch: () => void;
  onClear: () => void;
  loading?: boolean;
}

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 days' },
  { value: 'last30days', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom' },
];

const DURATION_MARKS = [
  { value: 0, label: '0' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 600, label: '10m' },
  { value: 1800, label: '30m' },
  { value: 3600, label: '1h' },
];

export const RecordingsSearchFilters: React.FC<RecordingsSearchFiltersProps> = ({
  filters,
  onChange,
  onSearch,
  onClear,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [agentOptions, setAgentOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [queueOptions, setQueueOptions] = useState<FilterOption[]>([]);
  const [tagOptions, setTagOptions] = useState<FilterOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [durationRange, setDurationRange] = useState<number[]>([
    filters.durationMin || 0,
    filters.durationMax || 3600,
  ]);
  const [showCustomDate, setShowCustomDate] = useState(false);

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    setLoadingOptions(true);
    try {
      const [agents, teams, queues, tags] = await Promise.all([
        getFilterOptions('agents').catch(() => []),
        getFilterOptions('teams').catch(() => []),
        getFilterOptions('queues').catch(() => []),
        getFilterOptions('tags').catch(() => []),
      ]);
      setAgentOptions(agents);
      setTeamOptions(teams);
      setQueueOptions(queues);
      setTagOptions(tags);
    } catch (error) {
      console.error('Failed to load filter options:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleDatePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setShowCustomDate(true);
      onChange({ ...filters, datePreset: undefined });
    } else {
      setShowCustomDate(false);
      onChange({ ...filters, datePreset: preset as any, dateFrom: undefined, dateTo: undefined });
    }
  };

  const handleDurationChange = (_: Event, value: number | number[]) => {
    setDurationRange(value as number[]);
  };

  const handleDurationCommit = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const [min, max] = value as number[];
    onChange({
      ...filters,
      durationMin: min > 0 ? min : undefined,
      durationMax: max < 3600 ? max : undefined,
    });
  };

  const handleDirectionChange = (direction: string | undefined) => {
    onChange({ ...filters, direction: direction as any });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <Box
      sx={{
        width: 300,
        height: '100%',
        overflow: 'auto',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {/* Search Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FilterIcon /> {t('recordings.filters', 'Filters')}
        </Typography>

        {/* Text Search */}
        <TextField
          fullWidth
          size="small"
          placeholder={t('recordings.searchPlaceholder', 'Search recordings...')}
          value={filters.q || ''}
          onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
          onKeyPress={handleKeyPress}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/* Action Buttons */}
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={onSearch}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <SearchIcon />}
          >
            {t('common.search', 'Search')}
          </Button>
          <Button variant="outlined" onClick={onClear} startIcon={<ClearIcon />}>
            {t('common.clear', 'Clear')}
          </Button>
        </Box>
      </Box>

      {/* Date Filter */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TodayIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.dateRange', 'Date Range')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {DATE_PRESETS.map((preset) => (
              <Chip
                key={preset.value}
                label={t(`recordings.datePreset.${preset.value}`, preset.label)}
                size="small"
                color={
                  filters.datePreset === preset.value || (preset.value === 'custom' && showCustomDate)
                    ? 'primary'
                    : 'default'
                }
                onClick={() => handleDatePresetChange(preset.value)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>

          {showCustomDate && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                size="small"
                type="date"
                label={t('common.from', 'From')}
                value={filters.dateFrom?.split('T')[0] || ''}
                onChange={(e) =>
                  onChange({ ...filters, dateFrom: e.target.value ? `${e.target.value}T00:00:00Z` : undefined })
                }
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                type="date"
                label={t('common.to', 'To')}
                value={filters.dateTo?.split('T')[0] || ''}
                onChange={(e) =>
                  onChange({ ...filters, dateTo: e.target.value ? `${e.target.value}T23:59:59Z` : undefined })
                }
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Duration Filter */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TimerIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.duration', 'Duration')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <Slider
              value={durationRange}
              onChange={handleDurationChange}
              onChangeCommitted={handleDurationCommit}
              min={0}
              max={3600}
              step={30}
              marks={DURATION_MARKS}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => formatDuration(v)}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {formatDuration(durationRange[0])} - {formatDuration(durationRange[1])}
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Direction Filter */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <PhoneIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.direction', 'Direction')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ButtonGroup fullWidth size="small">
            <Button
              variant={!filters.direction ? 'contained' : 'outlined'}
              onClick={() => handleDirectionChange(undefined)}
            >
              {t('common.all', 'All')}
            </Button>
            <Button
              variant={filters.direction === 'inbound' ? 'contained' : 'outlined'}
              onClick={() => handleDirectionChange('inbound')}
              startIcon={<InboundIcon />}
            >
              {t('recordings.inbound', 'In')}
            </Button>
            <Button
              variant={filters.direction === 'outbound' ? 'contained' : 'outlined'}
              onClick={() => handleDirectionChange('outbound')}
              startIcon={<OutboundIcon />}
            >
              {t('recordings.outbound', 'Out')}
            </Button>
          </ButtonGroup>
        </AccordionDetails>
      </Accordion>

      {/* Has Audio Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <MicIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.audio', 'Audio')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.hasAudio === true}
                indeterminate={filters.hasAudio === undefined}
                onChange={() => {
                  if (filters.hasAudio === true) {
                    onChange({ ...filters, hasAudio: false });
                  } else if (filters.hasAudio === false) {
                    onChange({ ...filters, hasAudio: undefined });
                  } else {
                    onChange({ ...filters, hasAudio: true });
                  }
                }}
              />
            }
            label={t('recordings.hasAudioOnly', 'With audio only')}
          />
        </AccordionDetails>
      </Accordion>

      {/* Agent Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <PersonIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.agents', 'Agents')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Autocomplete
            multiple
            size="small"
            loading={loadingOptions}
            options={agentOptions}
            getOptionLabel={(opt) => opt.label}
            value={agentOptions.filter((o) => filters.agents?.includes(o.value))}
            onChange={(_, values) => onChange({ ...filters, agents: values.map((v) => v.value) })}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('recordings.selectAgents', 'Select agents...')}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.value}
                  label={option.label}
                  size="small"
                />
              ))
            }
          />
        </AccordionDetails>
      </Accordion>

      {/* Team Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <GroupIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.teams', 'Teams')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Autocomplete
            multiple
            size="small"
            loading={loadingOptions}
            options={teamOptions}
            getOptionLabel={(opt) => opt.label}
            value={teamOptions.filter((o) => filters.teams?.includes(o.value))}
            onChange={(_, values) => onChange({ ...filters, teams: values.map((v) => v.value) })}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('recordings.selectTeams', 'Select teams...')}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.value}
                  label={option.label}
                  size="small"
                />
              ))
            }
          />
        </AccordionDetails>
      </Accordion>

      {/* Queue Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <QueueIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.queues', 'Queues')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Autocomplete
            multiple
            size="small"
            loading={loadingOptions}
            options={queueOptions}
            getOptionLabel={(opt) => opt.label}
            value={queueOptions.filter((o) => filters.queues?.includes(o.value))}
            onChange={(_, values) => onChange({ ...filters, queues: values.map((v) => v.value) })}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('recordings.selectQueues', 'Select queues...')}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.value}
                  label={option.label}
                  size="small"
                />
              ))
            }
          />
        </AccordionDetails>
      </Accordion>

      {/* Tags Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TagIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.tags', 'Tags')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Autocomplete
            multiple
            size="small"
            freeSolo
            loading={loadingOptions}
            options={tagOptions}
            getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
            value={filters.tags || []}
            onChange={(_, values) =>
              onChange({
                ...filters,
                tags: values.map((v) => (typeof v === 'string' ? v : v.value)),
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('recordings.selectTags', 'Select or type tags...')}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={typeof option === 'string' ? option : option.value}
                  label={typeof option === 'string' ? option : option.label}
                  size="small"
                  color="secondary"
                />
              ))
            }
          />
        </AccordionDetails>
      </Accordion>

      {/* ANI/DNIS Filter */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <PhoneIcon sx={{ mr: 1 }} />
          <Typography>{t('recordings.phoneNumbers', 'Phone Numbers')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              size="small"
              label={t('recordings.ani', 'ANI (Caller)')}
              placeholder="+380..."
              value={filters.ani || ''}
              onChange={(e) => onChange({ ...filters, ani: e.target.value || undefined })}
              onKeyPress={handleKeyPress}
            />
            <TextField
              size="small"
              label={t('recordings.dnis', 'DNIS (Called)')}
              placeholder="+380..."
              value={filters.dnis || ''}
              onChange={(e) => onChange({ ...filters, dnis: e.target.value || undefined })}
              onKeyPress={handleKeyPress}
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default RecordingsSearchFilters;
