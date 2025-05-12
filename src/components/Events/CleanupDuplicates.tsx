import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress, 
  Alert, 
  Paper
} from '@mui/material';
import { db, auth } from '../../firebase';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';

const CleanupDuplicates: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ 
    total: number; 
    unique: number; 
    deleted: number; 
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanupDuplicates = async () => {
    if (!auth.currentUser) {
      setError('You must be logged in to clean up events');
      return;
    }

    setProcessing(true);
    setResult(null);
    setError(null);

    try {
      const userId = auth.currentUser.uid;
      const eventsRef = collection(db, 'users', userId, 'events');
      const eventsSnapshot = await getDocs(eventsRef);
      
      const eventMap = new Map<string, {
        id: string;
        url: string;
        title: string;
        docId: string;
        timestamp: number;
      }>();
      
      // First pass: identify duplicates based on URL
      eventsSnapshot.forEach(doc => {
        const data = doc.data();
        const url = data.url;
        const normalizedUrl = url.split('?')[0]; // Remove query parameters
        const timestamp = data.createdAt?.toMillis() || 0;
        
        if (!eventMap.has(normalizedUrl) || timestamp > eventMap.get(normalizedUrl)!.timestamp) {
          // Keep the most recent version of each event
          eventMap.set(normalizedUrl, {
            id: data.id,
            url: data.url,
            title: data.title || 'Unnamed Event',
            docId: doc.id,
            timestamp
          });
        }
      });
      
      // Second pass: delete duplicates
      const deletePromises: Promise<void>[] = [];
      const uniqueDocIds = new Set(Array.from(eventMap.values()).map(e => e.docId));
      
      eventsSnapshot.forEach(doc => {
        if (!uniqueDocIds.has(doc.id)) {
          deletePromises.push(deleteDoc(doc.ref));
        }
      });
      
      await Promise.all(deletePromises);
      
      setResult({
        total: eventsSnapshot.size,
        unique: eventMap.size,
        deleted: eventsSnapshot.size - eventMap.size
      });
      
    } catch (err) {
      console.error('Error cleaning up duplicates:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 4, bgcolor: '#fff8e1' }}>
      <Typography variant="h6" gutterBottom>
        Clean Up Duplicate Events
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 2 }}>
        This will remove duplicate events based on their URLs, keeping only the most recent version of each event.
      </Typography>
      
      <Button 
        variant="contained" 
        color="warning"
        onClick={cleanupDuplicates}
        disabled={processing}
        sx={{ mb: 2 }}
      >
        {processing ? 'Cleaning...' : 'Remove Duplicate Events'}
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
      
      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Found {result.total} total events. Identified {result.unique} unique events and removed {result.deleted} duplicates.
        </Alert>
      )}
    </Paper>
  );
};

export default CleanupDuplicates;
