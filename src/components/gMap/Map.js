import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, Polyline, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Button, Card, LinearProgress, Typography, Box, Chip} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import config from './config';

const containerStyle = { width: '100%', height: '600px', borderRadius: '12px', overflow: 'hidden' };
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'water', stylers: [{ color: '#121722ff' }] },
];
const libraries = ['geometry'];

export default function Map({ onLogEvent }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: config.mapsKey,
    libraries,
  });

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routePoints, setRoutePoints] = useState([]); // full route positions
  const [positionHistory, setPositionHistory] = useState([]); // vehicle path so far
  const [status, setStatus] = useState('Idle');
  const [completion, setCompletion] = useState(0);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const velocity = 200; // m/s (adjust to taste)
  const totalDistanceRef = useRef(0);

  // click handler to set origin/destination
  const handleClick = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    if (!origin) {
      setOrigin({ lat, lng });
      setStatus('Origin set — click to set destination');
      onLogEvent && onLogEvent('OriginSelected', { lat, lng });
      return;
    }

    // if origin exists and destination not set -> set destination
    if (!destination) {
      setDestination({ lat, lng });
      setStatus('Destination set — ready to simulate');
      onLogEvent && onLogEvent('DestinationSelected', { lat, lng });
      return;
    }

    // if both exist, clicking resets selection to new origin
    setOrigin({ lat, lng });
    setDestination(null);
    setRoutePoints([]);
    setPositionHistory([]);
    setCompletion(0);
    setStatus('Origin set — click to set destination');
    onLogEvent && onLogEvent('OriginSelected', { lat, lng });
  };

  // compute route points as interpolated points between origin & destination
  const computeRoute = useCallback(() => {
    if (!isLoaded || !origin || !destination) return [];

    const originLatLng = new window.google.maps.LatLng(origin.lat, origin.lng);
    const destLatLng = new window.google.maps.LatLng(destination.lat, destination.lng);
    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(originLatLng, destLatLng);
    totalDistanceRef.current = distance;

    // use dynamic steps based on distance (one point per ~20m)
    const approxStepMeters = 20;
    const steps = Math.max(5, Math.min(1000, Math.ceil(distance / approxStepMeters)));

    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const fraction = i / steps;
      const interp = window.google.maps.geometry.spherical.interpolate(originLatLng, destLatLng, fraction);
      pts.push({ lat: interp.lat(), lng: interp.lng(), distanceAlong: distance * fraction });
    }
    return pts;
  }, [isLoaded, origin, destination]);

  useEffect(() => {
    if (isLoaded && origin && destination) {
      const pts = computeRoute();
      setRoutePoints(pts);
      setPositionHistory([]);
      setCompletion(0);
      setStatus('Ready to start');
    }
    return () => {};
  }, [isLoaded, origin, destination, computeRoute]);

  const getDistanceTravelled = () => {
    if (!startTimeRef.current) return 0;
    const elapsed = (Date.now() - startTimeRef.current) / 1000; // sec
    return elapsed * velocity;
  };

  const moveStep = useCallback(() => {
    if (!routePoints.length) return;
    const dist = getDistanceTravelled();
    let progressed = routePoints.filter((p) => p.distanceAlong <= dist);
    const next = routePoints.find((p) => p.distanceAlong > dist);

    if (!next) {
      // reached end
      setPositionHistory(routePoints);
      setCompletion(100);
      setStatus('Delivered ✅');
      onLogEvent && onLogEvent('Delivered', { endpoint: 'https://example-client/hook', deliveredAt: new Date().toISOString() });
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    const last = progressed.length ? progressed[progressed.length - 1] : routePoints[0];
    const lastLatLng = new window.google.maps.LatLng(last.lat, last.lng);
    const nextLatLng = new window.google.maps.LatLng(next.lat, next.lng);
    const segmentDistance = next.distanceAlong - last.distanceAlong || 1;
    const fraction = (dist - last.distanceAlong) / segmentDistance;

    // spherical.interpolate works with fraction 0..1  
   
    const interp = window.google.maps.geometry.spherical.interpolate(lastLatLng, nextLatLng, fraction);
    const currentPos = { lat: interp.lat(), lng: interp.lng(), timestamp: new Date().toISOString(), distance: dist };
    
    setPositionHistory([...progressed, currentPos]);

    const percent = ((dist / totalDistanceRef.current) * 100);
    setCompletion(Math.min(100, parseFloat(percent.toFixed(1))));
    setStatus('In Transit 🚀');

    // emit periodic progress logs at certain thresholds
    if (percent > 0 && Math.floor(percent) % 10 === 0) {
      // avoid spamming by checking last log time — simple heuristic (only log on exact tens)
      onLogEvent && onLogEvent('Progress', { percent: Math.floor(percent), at: new Date().toISOString() });
    }
  }, [routePoints, onLogEvent]);

  const startSimulation = () => {
    if (!routePoints.length) {
      setStatus('Set origin & destination first');
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    setPositionHistory([]);
    setCompletion(0);
    setStatus('Starting...');
    onLogEvent && onLogEvent('SimulationStarted', { startedAt: new Date().toISOString() });

    // update every 1s
    timerRef.current = setInterval(() => moveStep(), 1000);
  };

  const resetAll = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setOrigin(null);
    setDestination(null);
    setRoutePoints([]);
    setPositionHistory([]);
    setStatus('Idle');
    setCompletion(0);
    onLogEvent && onLogEvent('Reset', { at: new Date().toISOString() });
  };

  if (!isLoaded) return <div>Loading Map...</div>;

  const center = origin || destination || { lat: 20.5937, lng: 78.9629 }; // India center as fallback

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ color: '#fffbfbff' }}>Webhook Delivery Simulation</Typography>

        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={startSimulation}
          disabled={!origin || !destination || status === 'In Transit'}
        >
          Start Simulation
        </Button>

        <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={resetAll}>
          Reset
        </Button>

        <Chip label={`Status: ${status}`} color="info" variant="filled" sx={{ ml: 'auto' }} />
        <Typography sx={{ color: '#fff', minWidth: 140 }}>Completion: <strong>{completion}%</strong></Typography>
        <Box sx={{ width: 240 }}>
          <LinearProgress variant="determinate" value={completion} sx={{ height: 10, borderRadius: 2 }} />
        </Box>
      </Box>

      <Card sx={{ background: '#121212', padding: 2 }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          zoom={13}
          center={center}
          options={{ disableDefaultUI: true, styles: darkMapStyle }}
          onClick={handleClick}
        >
          {/* full route */}
          {routePoints.length > 0 && (
            <Polyline
              path={routePoints.map(p => ({ lat: p.lat, lng: p.lng }))}
              options={{ strokeColor: '#00BFFF', strokeWeight: 4, strokeOpacity: 0.35 }}
            />
          )}

          {/* progress route */}
          {positionHistory.length > 0 && (
            <Polyline
              path={positionHistory.map(p => ({ lat: p.lat, lng: p.lng }))}
              options={{ strokeColor: 'orange', strokeWeight: 5 }}
            />
          )}

          {/* origin & destination markers */}
          {origin && (
            <Marker
              position={origin}
              label={{ text: 'Start', color: '#fff', fontWeight: 'bold' }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4caf50',
                fillOpacity: 1,
                strokeWeight: 1,
              }}
              title="Origin"
            />
          )}
          {destination && (
            <Marker
              position={destination}
              label={{ text: 'END', color: '#fff', fontWeight: 'bold' }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#f44336',
                fillOpacity: 1,
                strokeWeight: 1,
              }}
              title="Destination"
            />
          )}

          {/* vehicle marker */}
          {positionHistory.length > 0 && (
            <Marker
              position={positionHistory[positionHistory.length - 1]}
              icon={{
                url: 'https://cdn-icons-png.flaticon.com/512/744/744465.png',
                scaledSize: new window.google.maps.Size(42, 42),
                anchor: new window.google.maps.Point(21, 21),
              }}
              title="Webhook Event"
            />
          )}
        </GoogleMap>
      </Card>

      <Box sx={{ mt: 2, color: '#9aa' }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Click map to set <strong>Origin</strong> (A) and then <strong>Destination</strong> (B). Click <em>Start Simulation</em> to simulate vehicle movement and produce delivery logs.
        </Typography>
        <Typography variant="caption">Tip: When both points are set, the route is auto-generated. Click Reset to choose different points.</Typography>
      </Box>
    </>
  );
}
