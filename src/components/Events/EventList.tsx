import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress, Container } from '@mui/material';
import { db, auth, functions as firebaseFunctionsInstance } from '../../firebase'; 
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable, HttpsCallableResult, Functions } from 'firebase/functions';

import EventItem from './EventItem';
import EventMapping from './EventMapping';
import SchemaProcessor from './SchemaProcessor';
import AutoMapper from './AutoMapper';
import CleanupDuplicates from './CleanupDuplicates';
import DirectSignup from './DirectSignup';

import { EventData } from '../../types/event';

export default function EventList() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ingestError, setIngestError] = useState('');
  const [ingestSuccess, setIngestSuccess] = useState('');
  const [newEventUrl, setNewEventUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  
  const currentUser = auth.currentUser;

  useEffect(() => {
    console.log('EventList useEffect - currentUser:', currentUser?.email);
    if (!currentUser) {
      console.log('No current user, showing login message');
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
        eventsData.push({ ...doc.data(), id: doc.id } as EventData);
      });
      setEvents(eventsData);
      setLoading(false);
    }, (err) => {
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

    setIngesting(true);
    setIngestError('');
    setIngestSuccess('');

    try {
      console.log('Calling ingestEvents cloud function with URL:', newEventUrl);
      const ingestEvents = httpsCallable(firebaseFunctionsInstance, 'ingestEventsV2');
      const result = await ingestEvents({ url: newEventUrl }) as HttpsCallableResult<{ message: string; eventIds: string[] }>;
      const resultData = result.data;

      if (!resultData || typeof resultData !== 'object' || !('message' in resultData)) {
        throw new Error('Invalid response from ingestEvents');
      }

      console.log('Successfully ingested events:', resultData);
      setIngestSuccess(resultData.message);
      setNewEventUrl('');
    } catch (err: any) {
      console.error('Error calling ingestEvents function details:', err);
      if (err instanceof Error) { // Standard JS Error
        setIngestError(err.message);
      } else if (err.code && err.message) { // Duck-typing for Firebase-like errors from proxy
        setIngestError(`Error: ${err.code} - ${err.message}`);
      }else {
        setIngestError('Failed to start event ingestion due to an unknown error.');
      }
    }
    setIngesting(false);
  };

  const handleMappingComplete = () => {
    setSelectedEvent(null);
  };

  if (loading && !events.length) { 
    return <Box sx={{ width: '100%', maxWidth: 800, margin: '0 auto', p: 2 }}><CircularProgress /></Box>;
  }
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Event Signup
        </Typography>
        <CleanupDuplicates />
        
        <SchemaProcessor />
        
        <DirectSignup />
        
        <AutoMapper />
        
        <Box sx={{ mb: 4 }}>
          <TextField
            label="Event URL"
            variant="outlined"
            fullWidth
            value={newEventUrl}
            onChange={(e) => setNewEventUrl(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleIngestUrl}
            disabled={!newEventUrl}
          >
            Add New Event
          </Button>
        </Box>
        {ingestError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {ingestError}
          </Alert>
        )}
        {ingestSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {ingestSuccess}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <CircularProgress />
        ) : events && events.length > 0 ? (
          events.map((event) => (
            <Box key={event.id} sx={{ mb: 2 }}>
              <EventItem event={event} />
              {event.status === 'pending_mapping' && (
                <Button
                  variant="contained"
                  onClick={() => event.id && setSelectedEvent(event.id)}
                  sx={{ mt: 1 }}
                >
                  Map Event
                </Button>
              )}
            </Box>
          ))
        ) : (
          <Typography>No events found</Typography>
        )}
        {selectedEvent && (
          <EventMapping eventId={selectedEvent} onMappingComplete={handleMappingComplete} />
        )}
      </Box>
    </Container>
  );
}
