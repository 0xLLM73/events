import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
// import { db, auth, functions } from '../../firebase'; // User will uncomment and setup
// import { collection, query, onSnapshot, where } from 'firebase/firestore';
// import { httpsCallable } from 'firebase/functions';

// Mock event data for dashboard summary (similar to EventList)
const mockEventsForDashboard = [
  { id: 'evt1', title: 'Ready Event 1', status: 'mapped' },
  { id: 'evt2', title: 'Successful Event', status: 'success' },
  { id: 'evt3', title: 'Failed Event', status: 'failed' },
  { id: 'evt4', title: 'Needs Captcha', status: 'needs_captcha' },
  { id: 'evt5', title: 'Needs Mapping', status: 'pending_mapping' },
  { id: 'evt6', title: 'Ready Event 2', status: 'mapped' },
  { id: 'evt7', title: 'Queued Event', status: 'queued' },
];

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enqueueing, setEnqueueing] = useState(false);
  const [enqueueMessage, setEnqueueMessage] = useState('');

  // const currentUser = auth.currentUser;
  const currentUser = { uid: 'test-uid' }; // Mock current user

  useEffect(() => {
    // if (!currentUser) {
    //   setLoading(false);
    //   setError('User not authenticated.');
    //   return;
    // }

    // // Fetch all events to calculate summaries and identify ready ones
    // const q = query(collection(db, 'users', currentUser.uid, 'events'));
    // const unsubscribe = onSnapshot(q, (querySnapshot) => {
    //   const eventsData = [];
    //   querySnapshot.forEach((doc) => {
    //     eventsData.push({ id: doc.id, ...doc.data() });
    //   });
    //   setEvents(eventsData);
    //   setLoading(false);
    // }, (err) => {
    //   console.error("Error fetching events for dashboard:", err);
    //   setError('Failed to load event data.');
    //   setLoading(false);
    // });

    // return () => unsubscribe();
    console.log("Simulating event fetch for dashboard for user:", currentUser?.uid);
    setTimeout(() => {
        setEvents(mockEventsForDashboard);
        setLoading(false);
    }, 500);
  }, [currentUser]);

  const handleEnqueueAllReady = async () => {
    // if (!functions) {
    //   setError('Firebase functions not initialized');
    //   return;
    // }
    // setEnqueueing(true);
    // setError('');
    // setEnqueueMessage('');
    // try {
    //   const enqueueSignupTasksFn = httpsCallable(functions, 'enqueueSignupTasks');
    //   const result = await enqueueSignupTasksFn(); // No specific data needed, operates on user's events
    //   setEnqueueMessage(result.data.message || 'Successfully triggered batch signup.');
    //   // The statuses of events will update via Firestore listeners in EventList/Dashboard
    // } catch (err) {
    //   console.error('Error calling enqueueSignupTasks function:', err);
    //   setError(err.message || 'Failed to enqueue signup tasks.');
    // }
    // setEnqueueing(false);
    console.log("Simulating enqueue all ready events");
    setEnqueueing(true);
    setEnqueueMessage('');
    setError('');
    setTimeout(() => {
        const readyEvents = events.filter(event => event.status === 'mapped').length;
        setEnqueueMessage(`Simulated: ${readyEvents} events have been queued for signup.`);
        // Simulate updating status of 'mapped' events to 'queued'
        setEvents(prevEvents => 
            prevEvents.map(e => e.status === 'mapped' ? {...e, status: 'queued'} : e)
        );
        setEnqueueing(false);
    }, 1500);
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }
  if (error && !enqueueMessage) { // Show main error if not related to enqueue action
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  const eventsReadyForSignup = events.filter(event => event.status === 'mapped').length;
  const eventsSuccessful = events.filter(event => event.status === 'success').length;
  const eventsFailed = events.filter(event => event.status === 'failed' || event.status === 'needs_captcha').length;
  const eventsProcessing = events.filter(event => event.status === 'queued' || event.status === 'processing').length;
  const eventsNeedingAttention = events.filter(event => event.status === 'pending_mapping' || event.status === 'schema_failed').length;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Signup Dashboard
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>} 
      {enqueueMessage && <Alert severity={error ? "warning" : "success"} sx={{ mb: 2 }}>{enqueueMessage}</Alert>}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6">{eventsReadyForSignup}</Typography>
            <Typography color="primary">Ready for Signup</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6">{eventsSuccessful}</Typography>
            <Typography color="success.main">Successful</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6">{eventsFailed}</Typography>
            <Typography color="error">Failed / Needs Captcha</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={3} sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6">{eventsProcessing + eventsNeedingAttention}</Typography>
            <Typography color="warning.main">Pending / Needs Action</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Button 
        variant="contained" 
        color="primary" 
        size="large"
        onClick={handleEnqueueAllReady}
        disabled={enqueueing || eventsReadyForSignup === 0}
        sx={{ mb: 3 }}
      >
        {enqueueing ? <CircularProgress size={24} color="inherit" /> : `Sign Me Up For ${eventsReadyForSignup} Ready Event(s)`}
      </Button>

      <Typography variant="h5" gutterBottom>
        Event Status Overview
      </Typography>
      {events.length === 0 && !loading && (
        <Typography>No events loaded yet. Check the Events page to add some.</Typography>
      )}
      {/* 
        Consider re-using EventItem or a simplified version here to list events, 
        especially those needing attention or recently processed.
        For brevity, I'm omitting a full list here, but it would be a good addition.
        Example: 
        events.filter(e => e.status === 'failed' || e.status === 'needs_captcha' || e.status === 'pending_mapping')
              .map(event => <EventItem key={event.id} event={event} />)
      */}
      {events.filter(e => e.status === 'failed' || e.status === 'needs_captcha' || e.status === 'pending_mapping' || e.status === 'schema_failed').length > 0 &&
        <Box sx={{mt: 2}}>
            <Typography variant="h6" color="error">Events Needing Attention:</Typography>
            {events.filter(e => e.status === 'failed' || e.status === 'needs_captcha' || e.status === 'pending_mapping' || e.status === 'schema_failed').map(event => (
                <Paper key={event.id} sx={{p:1, mb:1, borderLeft: "4px solid #ff9800"}}>
                    <Typography variant="subtitle1">{event.title} - <Typography component="span" sx={{fontWeight: "bold"}}>{event.status.replace('_', ' ').toUpperCase()}</Typography></Typography>
                </Paper>
            ))}
        </Box>
      }

    </Box>
  );
}
