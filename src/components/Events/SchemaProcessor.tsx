import React, { useState } from 'react';
import { Button, Typography, Box, CircularProgress, Alert } from '@mui/material';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

const SchemaProcessor: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processEvents = async () => {
    if (!auth.currentUser) {
      setError('You must be logged in to process events');
      return;
    }

    setProcessing(true);
    setResult(null);
    setError(null);

    try {
      const userId = auth.currentUser.uid;
      const eventsRef = collection(db, 'users', userId, 'events');
      const pendingQuery = query(eventsRef, where('status', '==', 'pending_schema'));
      const pendingSnapshot = await getDocs(pendingQuery);

      if (pendingSnapshot.empty) {
        setResult({ success: true, count: 0 });
        setProcessing(false);
        return;
      }

      console.log(`Found ${pendingSnapshot.size} events pending schema discovery`);
      
      // Update each event to pending_mapping status
      const updatePromises = pendingSnapshot.docs.map(async (doc) => {
        // First update to processing_schema
        await updateDoc(doc.ref, {
          status: 'processing_schema',
          statusReason: 'Starting schema discovery'
        });

        // Then update to pending_mapping after a short delay
        // In a real implementation, this would be where schema discovery happens
        return new Promise<void>((resolve) => {
          setTimeout(async () => {
            await updateDoc(doc.ref, {
              status: 'pending_mapping',
              statusReason: 'Ready for field mapping'
            });
            resolve();
          }, 1000);
        });
      });

      await Promise.all(updatePromises);
      setResult({ success: true, count: pendingSnapshot.size });
    } catch (err) {
      console.error('Error processing events:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ my: 4, p: 2, border: '1px solid #eee', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Event Schema Processor
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        This will process any events with 'pending_schema' status and prepare them for mapping.
      </Typography>
      
      <Button 
        variant="contained" 
        onClick={processEvents} 
        disabled={processing}
        sx={{ mb: 2 }}
      >
        {processing ? 'Processing...' : 'Process Events'}
      </Button>
      
      {processing && <CircularProgress size={24} sx={{ ml: 2 }} />}
      
      {result && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Successfully processed {result.count} events. {result.count > 0 ? 'They are now ready for mapping.' : 'No events needed processing.'}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default SchemaProcessor;
