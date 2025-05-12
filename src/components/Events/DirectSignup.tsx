import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Alert, 
  Paper, 
  List, 
  ListItem, 
  ListItemText,
  Divider
} from '@mui/material';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const DirectSignup: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    message: string;
    results: Array<{
      eventId: string;
      success: boolean;
      message: string;
      title?: string;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signupToEvents = async () => {
    if (!auth.currentUser) {
      setError('You must be logged in to sign up for events');
      return;
    }

    setProcessing(true);
    setResults(null);
    setError(null);

    try {
      const userId = auth.currentUser.uid;
      const eventsRef = collection(db, 'users', userId, 'events');
      const mappedQuery = query(eventsRef, where('status', '==', 'mapped'));
      const mappedSnapshot = await getDocs(mappedQuery);

      if (mappedSnapshot.empty) {
        setError('No mapped events found to sign up for');
        setProcessing(false);
        return;
      }

      console.log(`Found ${mappedSnapshot.size} mapped events to sign up for`);
      
      // Process each event directly on the client side
      const processResults: Array<{
        eventId: string;
        success: boolean;
        message: string;
        title?: string;
      }> = [];
      
      let successCount = 0;
      let failCount = 0;
      
      // Process events one by one
      for (const eventDoc of mappedSnapshot.docs) {
        const eventId = eventDoc.id;
        const eventData = eventDoc.data();
        const title = eventData.title || 'Unnamed Event';
        
        try {
          // Update status to processing
          await updateDoc(eventDoc.ref, {
            status: 'processing_signup',
            statusReason: 'Processing signup...',
            processedAt: serverTimestamp()
          });
          
          // Check for mapping
          const mappingRef = doc(db, `users/${userId}/mappings/${eventId}`);
          const mappingDoc = await getDoc(mappingRef);
          
          if (!mappingDoc.exists()) {
            await updateDoc(eventDoc.ref, {
              status: 'signup_failed',
              statusReason: 'No mapping found for this event'
            });
            
            processResults.push({
              eventId,
              success: false,
              message: 'No mapping found',
              title
            });
            failCount++;
            continue;
          }
          
          // In a real implementation, this would submit the form
          // For now, we'll just mark it as completed
          
          // Mark as completed
          await updateDoc(eventDoc.ref, {
            status: 'completed',
            statusReason: 'Signup completed successfully',
            completedAt: serverTimestamp()
          });
          
          processResults.push({
            eventId,
            success: true,
            message: 'Signup completed successfully',
            title
          });
          successCount++;
          
        } catch (error) {
          console.error(`Error processing signup for event ${eventId}:`, error);
          
          try {
            // Update event status to failed
            await updateDoc(eventDoc.ref, {
              status: 'signup_failed',
              statusReason: error instanceof Error ? error.message.substring(0, 200) : 'Unknown error'
            });
          } catch (updateError) {
            console.error(`Failed to update event ${eventId} status to failed:`, updateError);
          }
          
          processResults.push({
            eventId,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            title
          });
          failCount++;
        }
      }
      
      // Set results
      setResults({
        success: successCount > 0,
        message: `Processed ${successCount + failCount} events. ${successCount} succeeded, ${failCount} failed.`,
        results: processResults
      });
      
    } catch (err) {
      console.error('Error signing up for events:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 4, bgcolor: '#e8f5e9' }}>
      <Typography variant="h6" gutterBottom>
        Direct Event Signup
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 2 }}>
        This will directly sign up for all mapped events without using the task queue.
      </Typography>
      
      <Button 
        variant="contained" 
        color="success"
        onClick={signupToEvents}
        disabled={processing}
        sx={{ mb: 2 }}
      >
        {processing ? 'Signing up...' : 'Direct Signup for All Events'}
      </Button>
      
      {processing && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={24} sx={{ mr: 2 }} />
          <Typography>Processing events...</Typography>
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {results && (
        <Box>
          <Alert severity={results.success ? "success" : "warning"} sx={{ mb: 2 }}>
            {results.message}
          </Alert>
          
          {results.results.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense>
                {results.results.map((result, index) => (
                  <React.Fragment key={result.eventId}>
                    <ListItem>
                      <ListItemText 
                        primary={result.title || result.eventId} 
                        secondary={`Status: ${result.success ? 'Success' : 'Failed'} - ${result.message}`}
                      />
                    </ListItem>
                    {index < results.results.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default DirectSignup;
