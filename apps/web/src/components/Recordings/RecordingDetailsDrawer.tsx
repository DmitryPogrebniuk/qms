/**
 * Recording Details Drawer
 * Right panel showing full recording details, audio player, tags, notes, and related evaluations
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  Tabs,
  Tab,
  Tooltip,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as ForwardIcon,
  SkipPrevious as BackwardIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as MuteIcon,
  Speed as SpeedIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  LocalOffer as TagIcon,
  Note as NoteIcon,
  Assessment as AssessmentIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Timer as TimerIcon,
  CalendarToday as CalendarIcon,
  Queue as QueueIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Recording,
  formatDuration,
  formatFileSize,
  getStreamUrl,
  addTag,
  addNote,
  downloadRecording,
  logPlayback,
} from '../../services/recordingsApi';

interface RecordingDetailsDrawerProps {
  recording: Recording | null;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const RecordingDetailsDrawer: React.FC<RecordingDetailsDrawerProps> = ({
  recording,
  open,
  onClose,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tabValue, setTabValue] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [newTag, setNewTag] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when recording changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setTabValue(0);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [recording?.id]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (recording) logPlayback(recording.id, 'complete');
    };
    const handleError = () => setError(t('recordings.audioError', 'Failed to load audio'));

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [recording, t]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !recording) return;

    if (isPlaying) {
      audio.pause();
      logPlayback(recording.id, 'pause', audio.currentTime);
    } else {
      audio.play();
      logPlayback(recording.id, 'play', audio.currentTime);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio || !recording) return;
    const newTime = value as number;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    logPlayback(recording.id, 'seek', newTime);
  };

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  };

  const handleVolumeChange = (_: Event, value: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const vol = value as number;
    audio.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const handleToggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleDownload = async () => {
    if (!recording) return;
    setDownloading(true);
    try {
      const blob = await downloadRecording(recording.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${recording.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(t('recordings.downloadError', 'Failed to download recording'));
    } finally {
      setDownloading(false);
    }
  };

  const handleAddTag = async () => {
    if (!recording || !newTag.trim()) return;
    setSaving(true);
    try {
      await addTag(recording.id, newTag.trim());
      setNewTag('');
      onRefresh?.();
    } catch (err) {
      setError(t('recordings.tagError', 'Failed to add tag'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!recording || !newNote.trim()) return;
    setSaving(true);
    try {
      await addNote(recording.id, newNote.trim());
      setNewNote('');
      onRefresh?.();
    } catch (err) {
      setError(t('recordings.noteError', 'Failed to add note'));
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('uk-UA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!recording) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 450 },
          p: 0,
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {t('recordings.details', 'Recording Details')}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Audio Player */}
      {recording.hasAudio && (
        <Paper sx={{ m: 2, p: 2, bgcolor: 'grey.100' }} elevation={0}>
          <audio ref={audioRef} src={getStreamUrl(recording.id)} preload="metadata" />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Progress Slider */}
          <Box sx={{ mb: 1 }}>
            <Slider
              value={currentTime}
              max={duration || recording.durationSeconds || 100}
              onChange={handleSeek}
              sx={{ py: 1 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                {formatDuration(Math.floor(currentTime))}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDuration(Math.floor(duration || recording.durationSeconds || 0))}
              </Typography>
            </Box>
          </Box>

          {/* Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <Tooltip title={t('recordings.backward', 'Back 10s')}>
              <IconButton onClick={() => handleSkip(-10)}>
                <BackwardIcon />
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={handlePlayPause}
              color="primary"
              sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <Tooltip title={t('recordings.forward', 'Forward 10s')}>
              <IconButton onClick={() => handleSkip(10)}>
                <ForwardIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Volume & Speed */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <IconButton size="small" onClick={handleToggleMute}>
                {isMuted ? <MuteIcon /> : <VolumeIcon />}
              </IconButton>
              <Slider
                value={isMuted ? 0 : volume}
                max={1}
                step={0.1}
                onChange={handleVolumeChange}
                sx={{ ml: 1, width: 80 }}
                size="small"
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={playbackRate}
                onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                startAdornment={<SpeedIcon fontSize="small" sx={{ mr: 0.5 }} />}
              >
                {PLAYBACK_SPEEDS.map((speed) => (
                  <MenuItem key={speed} value={speed}>
                    {speed}x
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              size="small"
              startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleDownload}
              disabled={downloading}
            >
              MP3
            </Button>
          </Box>
        </Paper>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<InfoIcon />} label={t('recordings.tab.info', 'Info')} />
          <Tab icon={<TagIcon />} label={t('recordings.tab.tags', 'Tags')} />
          <Tab icon={<NoteIcon />} label={t('recordings.tab.notes', 'Notes')} />
          <Tab icon={<AssessmentIcon />} label={t('recordings.tab.evaluations', 'Evaluations')} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
        {/* Info Tab */}
        <TabPanel value={tabValue} index={0}>
          <List dense>
            <ListItem>
              <ListItemIcon><CalendarIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.startTime', 'Start Time')}
                secondary={formatDateTime(recording.startTime)}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><TimerIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.duration', 'Duration')}
                secondary={formatDuration(recording.durationSeconds)}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><PhoneIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.direction', 'Direction')}
                secondary={recording.direction || '-'}
              />
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem>
              <ListItemIcon><PhoneIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.ani', 'ANI (Caller)')}
                secondary={`${recording.ani || '-'}${recording.callerName ? ` - ${recording.callerName}` : ''}`}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><PhoneIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.dnis', 'DNIS (Called)')}
                secondary={`${recording.dnis || '-'}${recording.calledName ? ` - ${recording.calledName}` : ''}`}
              />
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem>
              <ListItemIcon><PersonIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.agent', 'Agent')}
                secondary={recording.agentName || recording.agentId || '-'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><GroupIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.team', 'Team')}
                secondary={recording.teamName || recording.teamCode || '-'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><QueueIcon /></ListItemIcon>
              <ListItemText
                primary={t('recordings.queue', 'Queue')}
                secondary={recording.queueName || recording.csq || '-'}
              />
            </ListItem>
            {recording.skillGroup && (
              <ListItem>
                <ListItemText
                  primary={t('recordings.skillGroup', 'Skill Group')}
                  secondary={recording.skillGroup}
                />
              </ListItem>
            )}
            {recording.wrapUpReason && (
              <ListItem>
                <ListItemText
                  primary={t('recordings.wrapUpReason', 'Wrap-up Reason')}
                  secondary={recording.wrapUpReason}
                />
              </ListItem>
            )}
            <Divider sx={{ my: 1 }} />
            {recording.hasAudio && (
              <>
                <ListItem>
                  <ListItemText
                    primary={t('recordings.audioFormat', 'Audio Format')}
                    secondary={`${recording.audioFormat || '-'} / ${recording.audioCodec || '-'}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={t('recordings.fileSize', 'File Size')}
                    secondary={formatFileSize(recording.fileSize)}
                  />
                </ListItem>
              </>
            )}
            <ListItem>
              <ListItemText
                primary={t('recordings.callId', 'Call ID')}
                secondary={recording.callId || '-'}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary={t('recordings.mediasenseId', 'MediaSense Session ID')}
                secondary={
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                    {recording.mediasenseSessionId || '-'}
                  </Typography>
                }
              />
            </ListItem>
          </List>
        </TabPanel>

        {/* Tags Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder={t('recordings.newTag', 'New tag...')}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleAddTag}
              disabled={!newTag.trim() || saving}
              startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
            >
              {t('common.add', 'Add')}
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {recording.tags?.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                sx={{ bgcolor: tag.color || undefined }}
                onDelete={() => {/* TODO: delete tag */}}
              />
            ))}
            {(!recording.tags || recording.tags.length === 0) && (
              <Typography color="text.secondary">
                {t('recordings.noTags', 'No tags yet')}
              </Typography>
            )}
          </Box>
        </TabPanel>

        {/* Notes Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2 }}>
            <TextField
              multiline
              rows={2}
              fullWidth
              placeholder={t('recordings.newNote', 'Add a note...')}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleAddNote}
              disabled={!newNote.trim() || saving}
              startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
              sx={{ mt: 1 }}
            >
              {t('common.addNote', 'Add Note')}
            </Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          {recording.notes?.map((note) => (
            <Paper key={note.id} sx={{ p: 2, mb: 1 }} variant="outlined">
              <Typography variant="body2">{note.text}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {note.createdBy?.name} • {new Date(note.createdAt).toLocaleString()}
              </Typography>
            </Paper>
          ))}
          {(!recording.notes || recording.notes.length === 0) && (
            <Typography color="text.secondary">
              {t('recordings.noNotes', 'No notes yet')}
            </Typography>
          )}
        </TabPanel>

        {/* Evaluations Tab */}
        <TabPanel value={tabValue} index={3}>
          {recording.evaluations?.map((evaluation) => (
            <Paper key={evaluation.id} sx={{ p: 2, mb: 1 }} variant="outlined">
              <Typography variant="subtitle2">{evaluation.formName}</Typography>
              <Typography variant="h6" color="primary">
                {evaluation.score}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {evaluation.evaluatorName} • {new Date(evaluation.completedAt).toLocaleDateString()}
              </Typography>
            </Paper>
          ))}
          {(!recording.evaluations || recording.evaluations.length === 0) && (
            <Typography color="text.secondary">
              {t('recordings.noEvaluations', 'No evaluations yet')}
            </Typography>
          )}
        </TabPanel>
      </Box>
    </Drawer>
  );
};

export default RecordingDetailsDrawer;
