/**
 * Recordings Results Table
 * Main table displaying search results with sorting, selection, and quick actions
 */

import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Checkbox,
  IconButton,
  Chip,
  Tooltip,
  Typography,
  Skeleton,
  Paper,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  CallReceived as InboundIcon,
  CallMade as OutboundIcon,
  SwapHoriz as InternalIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Recording, formatDuration, getDirectionLabel } from '../../services/recordingsApi';

interface RecordingsResultsTableProps {
  recordings: Recording[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  loading?: boolean;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onSelectAll: () => void;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onPlay: (recording: Recording) => void;
  onView: (recording: Recording) => void;
  onDownload: (recording: Recording) => void;
  onCopyMetadata: (recording: Recording) => void;
}

interface Column {
  id: string;
  label: string;
  sortable: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
}

const COLUMNS: Column[] = [
  { id: 'select', label: '', sortable: false, width: 50, align: 'center' },
  { id: 'startTime', label: 'Date/Time', sortable: true, width: 160 },
  { id: 'durationSeconds', label: 'Duration', sortable: true, width: 80, align: 'center' },
  { id: 'direction', label: 'Direction', sortable: true, width: 100, align: 'center' },
  { id: 'ani', label: 'ANI', sortable: true, width: 130 },
  { id: 'dnis', label: 'DNIS', sortable: true, width: 130 },
  { id: 'agentName', label: 'Agent', sortable: true, width: 150 },
  { id: 'teamName', label: 'Team', sortable: true, width: 120 },
  { id: 'queueName', label: 'Queue', sortable: true, width: 120 },
  { id: 'tags', label: 'Tags', sortable: false, width: 150 },
  { id: 'actions', label: 'Actions', sortable: false, width: 120, align: 'center' },
];

export const RecordingsResultsTable: React.FC<RecordingsResultsTableProps> = ({
  recordings,
  total,
  page,
  pageSize,
  sortBy,
  sortOrder,
  loading = false,
  selectedIds,
  onSelect,
  onSelectAll,
  onSort,
  onPageChange,
  onPageSizeChange,
  onPlay,
  onView,
  onDownload,
  onCopyMetadata,
}) => {
  const { t } = useTranslation();

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelect(selectedIds.filter((i) => i !== id));
    } else {
      onSelect([...selectedIds, id]);
    }
  };

  const isAllSelected = recordings.length > 0 && selectedIds.length === recordings.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < recordings.length;

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('uk-UA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDirectionIcon = (direction?: string) => {
    switch (direction) {
      case 'inbound':
        return <InboundIcon fontSize="small" color="success" />;
      case 'outbound':
        return <OutboundIcon fontSize="small" color="primary" />;
      case 'internal':
        return <InternalIcon fontSize="small" color="secondary" />;
      default:
        return null;
    }
  };

  const renderCell = (recording: Recording, columnId: string) => {
    switch (columnId) {
      case 'select':
        return (
          <Checkbox
            checked={selectedIds.includes(recording.id)}
            onChange={() => handleSelectOne(recording.id)}
            size="small"
          />
        );

      case 'startTime':
        return (
          <Box>
            <Typography variant="body2">{formatDateTime(recording.startTime)}</Typography>
            {recording.hasAudio ? (
              <Tooltip title={t('recordings.hasAudio', 'Has audio')}>
                <MicIcon fontSize="small" color="success" sx={{ mt: 0.5 }} />
              </Tooltip>
            ) : (
              <Tooltip title={t('recordings.noAudio', 'No audio')}>
                <MicOffIcon fontSize="small" color="disabled" sx={{ mt: 0.5 }} />
              </Tooltip>
            )}
          </Box>
        );

      case 'durationSeconds':
        return (
          <Typography variant="body2" fontFamily="monospace">
            {formatDuration(recording.durationSeconds)}
          </Typography>
        );

      case 'direction':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            {getDirectionIcon(recording.direction)}
            <Typography variant="body2">
              {t(`recordings.direction.${recording.direction}`, getDirectionLabel(recording.direction))}
            </Typography>
          </Box>
        );

      case 'ani':
        return (
          <Tooltip title={recording.callerName || ''}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 130 }}>
              {recording.ani || '-'}
            </Typography>
          </Tooltip>
        );

      case 'dnis':
        return (
          <Tooltip title={recording.calledName || ''}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 130 }}>
              {recording.dnis || '-'}
            </Typography>
          </Tooltip>
        );

      case 'agentName':
        return (
          <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
            {recording.agentName || recording.agentId || '-'}
          </Typography>
        );

      case 'teamName':
        return (
          <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
            {recording.teamName || recording.teamCode || '-'}
          </Typography>
        );

      case 'queueName':
        return (
          <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>
            {recording.queueName || recording.csq || '-'}
          </Typography>
        );

      case 'tags':
        return (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {recording.tags?.slice(0, 2).map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: tag.color || undefined,
                }}
              />
            ))}
            {(recording.tags?.length || 0) > 2 && (
              <Chip
                label={`+${recording.tags!.length - 2}`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        );

      case 'actions':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
            {recording.hasAudio && (
              <Tooltip title={t('recordings.play', 'Play')}>
                <IconButton size="small" onClick={() => onPlay(recording)} color="primary">
                  <PlayIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={t('recordings.view', 'View details')}>
              <IconButton size="small" onClick={() => onView(recording)}>
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {recording.hasAudio && (
              <Tooltip title={t('recordings.download', 'Download')}>
                <IconButton size="small" onClick={() => onDownload(recording)}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={t('recordings.copyMetadata', 'Copy metadata')}>
              <IconButton size="small" onClick={() => onCopyMetadata(recording)}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );

      default:
        return null;
    }
  };

  const renderSkeletonRow = (index: number) => (
    <TableRow key={`skeleton-${index}`}>
      {COLUMNS.map((col) => (
        <TableCell key={col.id} align={col.align}>
          <Skeleton variant="text" />
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  sx={{ width: column.width, fontWeight: 'bold', bgcolor: 'background.paper' }}
                >
                  {column.id === 'select' ? (
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isSomeSelected}
                      onChange={onSelectAll}
                      size="small"
                    />
                  ) : column.sortable ? (
                    <TableSortLabel
                      active={sortBy === column.id}
                      direction={sortBy === column.id ? sortOrder : 'asc'}
                      onClick={() => onSort(column.id)}
                    >
                      {t(`recordings.column.${column.id}`, column.label)}
                    </TableSortLabel>
                  ) : (
                    t(`recordings.column.${column.id}`, column.label)
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: pageSize }).map((_, i) => renderSkeletonRow(i))
              : recordings.map((recording) => (
                  <TableRow
                    key={recording.id}
                    hover
                    selected={selectedIds.includes(recording.id)}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onView(recording)}
                  >
                    {COLUMNS.map((column) => (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        onClick={column.id === 'select' || column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                      >
                        {renderCell(recording, column.id)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

            {!loading && recordings.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {t('recordings.noResults', 'No recordings found')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[10, 20, 50, 100]}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
        labelRowsPerPage={t('common.rowsPerPage', 'Rows per page')}
        labelDisplayedRows={({ from, to, count }) =>
          t('common.displayedRows', '{{from}}-{{to}} of {{count}}', { from, to, count })
        }
      />
    </Box>
  );
};

export default RecordingsResultsTable;
