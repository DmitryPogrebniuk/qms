/**
 * Recording Search Page
 * Full-featured search interface with filters, results table, and details drawer
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  LinearProgress,
  Paper,
  Toolbar,
  Button,
  Menu,
  MenuItem,
  Badge,
  Chip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  ViewColumn as ColumnsIcon,
  MoreVert as MoreIcon,
  Assessment as StatsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  RecordingsSearchFilters,
  RecordingsResultsTable,
  RecordingDetailsDrawer,
} from '../components/Recordings';
import {
  Recording,
  RecordingSearchParams,
  SearchResponse,
  searchRecordings,
  getRecording,
  downloadRecording,
} from '../services/recordingsApi';

const DEFAULT_FILTERS: RecordingSearchParams = {
  datePreset: 'last7days',
  sortBy: 'startTime',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,
};

export default function Search() {
  const { t } = useTranslation();

  // State
  const [filters, setFilters] = useState<RecordingSearchParams>(DEFAULT_FILTERS);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailsRecording, setDetailsRecording] = useState<Recording | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);

  // Active filters count for badge
  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (['sortBy', 'sortOrder', 'page', 'pageSize'].includes(key)) return false;
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }).length;

  // Search function
  const performSearch = useCallback(async (searchFilters: RecordingSearchParams) => {
    setLoading(true);
    setError(null);

    try {
      const result = await searchRecordings(searchFilters);
      setSearchResult(result);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.message || t('recordings.searchError', 'Failed to search recordings'));
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Initial search on mount
  useEffect(() => {
    performSearch(filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleFiltersChange = (newFilters: RecordingSearchParams) => {
    setFilters(newFilters);
  };

  const handleSearch = () => {
    const searchFilters = { ...filters, page: 1 };
    setFilters(searchFilters);
    performSearch(searchFilters);
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    performSearch(DEFAULT_FILTERS);
  };

  const handleSort = (field: string) => {
    const newOrder = filters.sortBy === field && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    const newFilters = { ...filters, sortBy: field, sortOrder: newOrder as 'asc' | 'desc', page: 1 };
    setFilters(newFilters);
    performSearch(newFilters);
  };

  const handlePageChange = (page: number) => {
    const newFilters = { ...filters, page };
    setFilters(newFilters);
    performSearch(newFilters);
  };

  const handlePageSizeChange = (pageSize: number) => {
    const newFilters = { ...filters, pageSize, page: 1 };
    setFilters(newFilters);
    performSearch(newFilters);
  };

  const handleSelectAll = () => {
    if (!searchResult) return;
    if (selectedIds.length === searchResult.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(searchResult.items.map((r) => r.id));
    }
  };

  const handleView = async (recording: Recording) => {
    try {
      // Fetch full details
      const fullRecording = await getRecording(recording.id);
      setDetailsRecording(fullRecording);
      setDrawerOpen(true);
    } catch {
      setSnackbar({ message: t('recordings.fetchError', 'Failed to load recording'), severity: 'error' });
    }
  };

  const handlePlay = (recording: Recording) => {
    handleView(recording);
  };

  const handleDownload = async (recording: Recording) => {
    try {
      setSnackbar({ message: t('recordings.downloading', 'Downloading...'), severity: 'success' });
      const blob = await downloadRecording(recording.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${recording.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSnackbar({ message: t('recordings.downloadComplete', 'Download complete'), severity: 'success' });
    } catch {
      setSnackbar({ message: t('recordings.downloadError', 'Failed to download'), severity: 'error' });
    }
  };

  const handleCopyMetadata = (recording: Recording) => {
    const metadata = {
      id: recording.id,
      startTime: recording.startTime,
      duration: recording.durationSeconds,
      direction: recording.direction,
      ani: recording.ani,
      dnis: recording.dnis,
      agent: recording.agentName || recording.agentId,
      team: recording.teamName || recording.teamCode,
      queue: recording.queueName || recording.csq,
      callId: recording.callId,
    };
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setSnackbar({ message: t('recordings.metadataCopied', 'Metadata copied to clipboard'), severity: 'success' });
  };

  const handleRefreshDetails = async () => {
    if (!detailsRecording) return;
    try {
      const fullRecording = await getRecording(detailsRecording.id);
      setDetailsRecording(fullRecording);
    } catch {
      // Ignore
    }
  };

  const handleBulkDownload = async () => {
    setMoreMenuAnchor(null);
    for (const id of selectedIds.slice(0, 10)) { // Limit to 10
      const recording = searchResult?.items.find((r) => r.id === id);
      if (recording?.hasAudio) {
        await handleDownload(recording);
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Filters Panel */}
      {showFilters && (
        <RecordingsSearchFilters
          filters={filters}
          onChange={handleFiltersChange}
          onSearch={handleSearch}
          onClear={handleClearFilters}
          loading={loading}
        />
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <Paper sx={{ borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar variant="dense" sx={{ gap: 1 }}>
            <Tooltip title={showFilters ? t('recordings.hideFilters', 'Hide filters') : t('recordings.showFilters', 'Show filters')}>
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                <Badge badgeContent={activeFiltersCount} color="primary">
                  <FilterIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Typography variant="h6" sx={{ flex: 1 }}>
              {t('search.title', 'Recording Search')}
            </Typography>

            {/* Results summary */}
            {searchResult && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <Chip
                  label={t('recordings.totalResults', '{{count}} recordings', { count: searchResult.total })}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                {searchResult.queryTime && (
                  <Typography variant="caption" color="text.secondary">
                    ({searchResult.queryTime}ms)
                  </Typography>
                )}
                {searchResult.source && (
                  <Chip
                    label={searchResult.source === 'opensearch' ? 'OpenSearch' : 'PostgreSQL'}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                )}
              </Box>
            )}

            {selectedIds.length > 0 && (
              <Chip
                label={t('recordings.selected', '{{count}} selected', { count: selectedIds.length })}
                size="small"
                color="secondary"
                onDelete={() => setSelectedIds([])}
              />
            )}

            <Tooltip title={t('common.refresh', 'Refresh')}>
              <IconButton onClick={handleSearch} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <IconButton onClick={(e) => setMoreMenuAnchor(e.currentTarget)}>
              <MoreIcon />
            </IconButton>

            <Menu
              anchorEl={moreMenuAnchor}
              open={Boolean(moreMenuAnchor)}
              onClose={() => setMoreMenuAnchor(null)}
            >
              <MenuItem onClick={handleBulkDownload} disabled={selectedIds.length === 0}>
                <DownloadIcon sx={{ mr: 1 }} />
                {t('recordings.downloadSelected', 'Download selected')}
              </MenuItem>
            </Menu>
          </Toolbar>

          {loading && <LinearProgress />}
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Results Table */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <RecordingsResultsTable
            recordings={searchResult?.items || []}
            total={searchResult?.total || 0}
            page={filters.page || 1}
            pageSize={filters.pageSize || 20}
            sortBy={filters.sortBy || 'startTime'}
            sortOrder={filters.sortOrder || 'desc'}
            loading={loading}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onSelectAll={handleSelectAll}
            onSort={handleSort}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onPlay={handlePlay}
            onView={handleView}
            onDownload={handleDownload}
            onCopyMetadata={handleCopyMetadata}
          />
        </Box>
      </Box>

      {/* Details Drawer */}
      <RecordingDetailsDrawer
        recording={detailsRecording}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefresh={handleRefreshDetails}
      />

      {/* Snackbar */}
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)}>
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
