import React, { useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ReplayIcon from '@mui/icons-material/Replay';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

export default function WebhookLogs({ logs = [], onRetry }) {
  const [inspect, setInspect] = useState(null);

  const rows = logs.map((l, idx) => ({
    id: l.id || idx + 1,
    event: l.event,
    endpoint: l.endpoint || 'https://example-client/hook',
    status: l.status,
    timestamp: l.timestamp,
    meta: l.meta || {},
  }));

  const columns = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'event', headerName: 'Event Type', width: 180 },
    { field: 'endpoint', headerName: 'Subscriber Endpoint', width: 300 },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => {
        const s = params.value;
        const color = s === 'Delivered' ? 'success' : s === 'Retrying' ? 'warning' : s === 'Failed' ? 'error' : 'default';
        return <Chip label={s} color={color} size="small" />;
      },
    },
    { field: 'timestamp', headerName: 'Timestamp', width: 200 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      renderCell: (params) => {
        const row = params.row;
        return (
          <>
            <IconButton size="small" onClick={() => onRetry && onRetry(row.id)} title="Retry delivery">
              <ReplayIcon />
            </IconButton>
            <IconButton size="small" onClick={() => setInspect(row)} title="Inspect">
              <VisibilityIcon />
            </IconButton>
          </>
        );
      },
    },
  ];

  return (
    <Paper sx={{ height: 420, width: '100%', mt: 4, p: 2, background: '#121212', color: '#fff' }}>
      <Typography variant="h6" sx={{ mb: 2, color: '#00BFFF' }}>
        Webhook Delivery Logs
      </Typography>

      <DataGrid
        rows={rows}
        columns={columns}
        disableRowSelectionOnClick
        sx={{
          color: '#111111ff',
          border: 'none',
          '& .MuiDataGrid-cell': { borderBottom: '1px solid #333' },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#0f0f0fff',
            color: '#00BFFF',
          },
        }}
      />

      <Dialog open={Boolean(inspect)} onClose={() => setInspect(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Inspect Log</DialogTitle>
        <DialogContent>
  {inspect && (
    <>
      <Typography variant="subtitle1" gutterBottom><b>Event:</b> {inspect.event}</Typography>
      <Typography variant="subtitle2" gutterBottom><b>Endpoint:</b> {inspect.endpoint}</Typography>
      <Typography variant="subtitle2" gutterBottom><b>Status:</b> {inspect.status}</Typography>
      <Typography variant="subtitle2" gutterBottom><b>Timestamp:</b> {inspect.timestamp}</Typography>
      <Typography variant="subtitle2" gutterBottom><b>Meta Details:</b></Typography>
      <pre
        style={{
          color: '#111',
          background: '#fcf9f9ff',
          padding: 12,
          borderRadius: 6,
          overflowX: 'auto',
        }}
      >
        {JSON.stringify(inspect.meta, null, 2)}
      </pre>
    </>
  )}
</DialogContent>

        <DialogActions>
          <Button onClick={() => setInspect(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
