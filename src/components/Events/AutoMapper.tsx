import React, { useState, useEffect } from 'react';
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
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

interface FormField {
  name: string;
  id?: string;
  type: string;
  label: string;
  placeholder?: string;
  options?: { value: string; text: string }[];
  selector: string;
}

interface FormSchema {
  id: string;
  action?: string;
  method?: string;
  fields: FormField[];
}

interface EventSchema {
  forms: FormSchema[];
  discoveredAt: any;
  sourceUrl: string;
}

const AutoMapper: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    processed: number;
    mapped: number;
    failed: number;
    details: Array<{ eventId: string; title: string; status: string; message: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const autoMapEvents = async () => {
    if (!auth.currentUser) {
      setError('You must be logged in to map events');
      return;
    }

    setProcessing(true);
    setResults(null);
    setError(null);

    const details: Array<{ eventId: string; title: string; status: string; message: string }> = [];
    let mappedCount = 0;
    let failedCount = 0;

    try {
      const userId = auth.currentUser.uid;
      const eventsRef = collection(db, 'users', userId, 'events');
      const pendingQuery = query(eventsRef, where('status', '==', 'pending_mapping'));
      const pendingSnapshot = await getDocs(pendingQuery);

      if (pendingSnapshot.empty) {
        setResults({
          success: true,
          processed: 0,
          mapped: 0,
          failed: 0,
          details: []
        });
        setProcessing(false);
        return;
      }

      console.log(`Found ${pendingSnapshot.size} events pending mapping`);
      
      // Process each event
      const processPromises = pendingSnapshot.docs.map(async (eventDoc) => {
        const eventId = eventDoc.id;
        const eventData = eventDoc.data();
        const title = eventData.title || 'Unnamed Event';
        
        try {
          // Get schema for this event
          const schemaRef = doc(db, `users/${userId}/events/${eventId}/schema/formSchema`);
          const schemaDoc = await getDoc(schemaRef);
          
          if (!schemaDoc.exists()) {
            details.push({
              eventId,
              title,
              status: 'failed',
              message: 'No schema found'
            });
            failedCount++;
            return;
          }
          
          const schema = schemaDoc.data() as EventSchema;
          
          // Create automatic mapping
          const mapping: Record<string, string> = {};
          
          // For each form in the schema
          schema.forms.forEach(form => {
            // For each field in the form
            form.fields.forEach(field => {
              const fieldKey = field.name || field.label.replace(/\\s+/g, '');
              const fieldLabel = field.label?.toLowerCase() || '';
              const fieldName = field.name?.toLowerCase() || '';
              
              // Simple mapping logic based on field names/labels
              if (fieldLabel.includes('first') || fieldName.includes('first') || 
                  fieldLabel.includes('fname') || fieldName.includes('fname')) {
                mapping[fieldKey] = 'firstName';
              } else if (fieldLabel.includes('last') || fieldName.includes('last') || 
                        fieldLabel.includes('lname') || fieldName.includes('lname')) {
                mapping[fieldKey] = 'lastName';
              } else if (fieldLabel.includes('email') || fieldName.includes('email')) {
                mapping[fieldKey] = 'email';
              } else if (fieldLabel.includes('phone') || fieldName.includes('phone') || 
                        fieldLabel.includes('mobile') || fieldName.includes('mobile')) {
                mapping[fieldKey] = 'phone';
              } else if (fieldLabel.includes('company') || fieldName.includes('company') || 
                        fieldLabel.includes('organization') || fieldName.includes('organization')) {
                mapping[fieldKey] = 'company';
              } else if (fieldLabel.includes('title') || fieldName.includes('title') || 
                        fieldLabel.includes('job') || fieldName.includes('job') || 
                        fieldLabel.includes('position') || fieldName.includes('position')) {
                mapping[fieldKey] = 'title';
              } else {
                // Default to empty string for fields we can't map
                mapping[fieldKey] = '';
              }
            });
          });
          
          // Save the mapping
          const mappingRef = doc(db, `users/${userId}/mappings/${eventId}`);
          await setDoc(mappingRef, mapping);
          
          // Update event status to mapped
          await updateDoc(eventDoc.ref, {
            status: 'mapped',
            statusReason: 'Auto-mapped and ready for signup'
          });
          
          details.push({
            eventId,
            title,
            status: 'mapped',
            message: 'Successfully mapped'
          });
          mappedCount++;
          
        } catch (err) {
          console.error(`Error mapping event ${eventId}:`, err);
          details.push({
            eventId,
            title,
            status: 'failed',
            message: err instanceof Error ? err.message : 'Unknown error'
          });
          failedCount++;
        }
      });
      
      await Promise.all(processPromises);
      
      setResults({
        success: true,
        processed: pendingSnapshot.size,
        mapped: mappedCount,
        failed: failedCount,
        details
      });
      
    } catch (err) {
      console.error('Error auto-mapping events:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const autoSignupEvents = async () => {
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
      
      // Get all event IDs
      const eventIds = mappedSnapshot.docs.map(doc => doc.id);
      
      // Call the enqueueSignupTasks function
      const enqueueSignup = httpsCallable(functions, 'enqueueSignupTasksV2');
      const result = await enqueueSignup({ eventIds });
      
      console.log('Signup result:', result.data);
      
      setResults({
        success: true,
        processed: mappedSnapshot.size,
        mapped: 0,
        failed: 0,
        details: mappedSnapshot.docs.map(doc => ({
          eventId: doc.id,
          title: doc.data().title || 'Unnamed Event',
          status: 'processing',
          message: 'Signup task queued'
        }))
      });
      
    } catch (err) {
      console.error('Error signing up for events:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Automatic Event Processing
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button 
          variant="contained" 
          color="primary"
          onClick={autoMapEvents}
          disabled={processing}
        >
          Auto-Map All Events
        </Button>
        
        <Button 
          variant="contained" 
          color="secondary"
          onClick={autoSignupEvents}
          disabled={processing}
        >
          Auto-Signup All Mapped Events
        </Button>
      </Box>
      
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
          <Alert severity={results.failed > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
            Processed {results.processed} events: {results.mapped} mapped, {results.failed} failed
          </Alert>
          
          {results.details.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
              <List dense>
                {results.details.map((detail, index) => (
                  <React.Fragment key={detail.eventId}>
                    <ListItem>
                      <ListItemText 
                        primary={detail.title} 
                        secondary={`Status: ${detail.status} - ${detail.message}`}
                      />
                    </ListItem>
                    {index < results.details.length - 1 && <Divider />}
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

export default AutoMapper;
