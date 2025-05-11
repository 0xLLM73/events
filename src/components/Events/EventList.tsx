import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

import { db, auth, functions as firebaseFunctionsInstance, app } from '../../firebase'; 
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'; // Removed 'where' as it's not used here
import { httpsCallable, HttpsCallableError, FunctionsErrorCode } from 'firebase/functions'; // Added FunctionsErrorCode

import EventItem from './EventItem';
import { EventData } from '../../../functions/src/types';

export default function EventList() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ingestError, setIngestError] = useState('');
  const [ingestSuccess, setIngestSuccess] = useState('');
  const [newEventUrl, setNewEventUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  
  const currentUser = auth.currentUser;

  useEffect(() => {
    // Test T3: Basic Proxy Test (can be moved to a button click if preferred)
    if (process.env.NODE_ENV === 'development') {
      fetch('/test-proxy/todos/1')
        .then(response => response.json())
        .then(json => console.log('Test Proxy Response:', json))
        .catch(error => console.error('Test Proxy Error:', error));
    }
    // End Test T3

    if (!currentUser) {
      setLoading(false);
      setError('User not authenticated. Please login to see events.');
      setEvents([]);
      return;
    }
    setError('');
    setLoading(true);
    const q = query(collection(db, 'users', currentUser.uid, 'events'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const eventsData: EventData[] = [];
      querySnapshot.forEach((doc) => {
        eventsData.push({ ...(doc.data()), id: doc.id } as EventData);
      });
      setEvents(eventsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching events:", err);
      setError('Failed to load events. ' + err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleIngestUrl = async () => {
    if (!newEventUrl.trim()) {
      setIngestError('Please enter a URL.'); return;
    }
    if (!currentUser) {
      setIngestError('You must be logged in to ingest events.'); return;
    }

    // Test T1: Debug instanceof Error
    console.log('typeof HttpsCallableError:', typeof HttpsCallableError);
    console.log('HttpsCallableError itself:', HttpsCallableError);
    // End Test T1

    setIngesting(true);
    setIngestError('');
    setIngestSuccess('');

    try {
      let resultData: any;
      if (process.env.NODE_ENV === 'development') {
        console.log(`Calling proxied ingestEvents via fetch to /functions-api/ingestEvents for URL: ${newEventUrl}`);
        const response = await fetch(`/functions-api/ingestEvents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { url: newEventUrl, userId: currentUser.uid } }) 
        });
        
        const responseData = await response.json();
        if (!response.ok) {
          const status = responseData.error?.status || 'unknown';
          const message = responseData.error?.message || `HTTP error! status: ${response.status}`;
          console.error('Proxied function call error details:', responseData);
          // Ensure HttpsCallableError is a valid constructor before using new
          if (typeof HttpsCallableError === 'function') {
            throw new HttpsCallableError(status as FunctionsErrorCode, message);
          } else {
            // Fallback if HttpsCallableError is not a function for some reason
            const pseudoError = new Error(message) as any;
            pseudoError.code = status;
            throw pseudoError;
          }
        }
        resultData = responseData.result; 
      } else {
        if (!firebaseFunctionsInstance) {
          setIngestError('Firebase functions not initialized for production.'); 
          setIngesting(false); return;
        }
        const ingestEventsFn = httpsCallable(firebaseFunctionsInstance, 'ingestEvents');
        console.log(`Calling live ingestEvents function with URL: ${newEventUrl}`);
        const result: any = await ingestEventsFn({ url: newEventUrl, userId: currentUser.uid });
        resultData = result.data;
      }
      
      console.log('Ingest function result data:', resultData);
      setIngestSuccess(resultData.message || 'Event ingestion process started successfully.');
      setNewEventUrl('');
    } catch (err: any) {
      console.error('Error calling ingestEvents function details:', err);
      // Check HttpsCallableError carefully
      if (typeof HttpsCallableError === 'function' && err instanceof HttpsCallableError) {
         setIngestError(`Error: ${err.code} - ${err.message}`);
      } else if (err instanceof Error) { // Standard JS Error
        setIngestError(err.message);
      } else if (err.code && err.message) { // Duck-typing for Firebase-like errors from proxy
        setIngestError(`Error: ${err.code} - ${err.message}`);
      }else {
        setIngestError('Failed to start event ingestion due to an unknown error.');
      }
    }
    setIngesting(false);
  };

  // ... rest of the component JSX ...
  if (loading && !events.length) { 
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h5" gutterBottom>Add New Event</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
        <TextField fullWidth label="Event Page URL (e.g., Notion, Conference Site)" variant="outlined" value={newEventUrl} onChange={(e) => setNewEventUrl(e.target.value)} disabled={ingesting} size="small" />
        <Button variant="contained" onClick={handleIngestUrl} disabled={ingesting || !newEventUrl.trim()} size="large">
          {ingesting ? <CircularProgress size={24} /> : 'Ingest Event'}
        </Button>
      </Box>
      {ingestError && <Alert severity="error" sx={{ mb: 2 }}>{ingestError}</Alert>}
      {ingestSuccess && <Alert severity="success" sx={{ mb: 2 }}>{ingestSuccess}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>} 
      <Typography variant="h5" gutterBottom sx={{mt: 4}}>My Events</Typography>
      {events.length === 0 && !loading && !error && (
        <Typography>No events found. Add an event URL above to get started.</Typography>
      )}
      {events.map(event => (
        <EventItem key={event.id || event.url} event={event} /> 
      ))}
    </Box>
  );
}
