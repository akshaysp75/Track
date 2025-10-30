import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import Map from './components/gMap/Map';
import Header from './components/Header/Header';
import WebhookLogs from './components/WebhookLogs/WebhookLogs';

import Container from '@mui/material/Container';


function App() {
  // logs are persisted to localStorage so they survive reloads/testing
  const [logs, setLogs] = useState(() => {
    try {
      const raw = localStorage.getItem('webhook_logs_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('webhook_logs_v1', JSON.stringify(logs));
  }, [logs]);

  // callback used by Map to produce log events
  const onLogEvent = useCallback((eventType, meta = {}) => {
    const id = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();
    let status = 'Pending';
    if (eventType === 'Delivered') status = 'Delivered';
    if (eventType === 'SimulationStarted') status = 'In Progress';
    if (eventType === 'Reset') status = 'Reset';

   const newLog = {
  id,
  event: eventType,
  endpoint: meta.endpoint || 'https://client.example.com/hook',
  status,
  timestamp,
  meta: {
    template: meta.template || 'webhook_delivery_update',
    payload: meta.payload || { status, event: eventType, time: timestamp },
    ...meta,
  },
};


    setLogs((prev) => [newLog, ...prev].slice(0, 200)); // keep last 200
  }, []);

  // simple retry handler: mark log as retrying then simulate delivered after timeout
  const handleRetry = useCallback((id) => {
    setLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'Retrying', timestamp: new Date().toISOString() } : l))
    );

    // simulate retry attempt (a background worker would do this)
    setTimeout(() => {
      setLogs((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, status: 'Delivered', timestamp: new Date().toISOString(), meta: { ...l.meta, retriedAt: new Date().toISOString() } }
            : l
        )
      );
    }, 2200);
  }, []);

 

  return (
    <div className="App">
      <Header />
      <Container maxWidth="lg" sx={{ paddingTop: 3 }}>
        <Map onLogEvent={onLogEvent} />

        <WebhookLogs logs={logs} onRetry={handleRetry} />
      </Container>
    </div>
  );
}

export default App;
