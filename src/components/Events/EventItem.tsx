import React from 'react';
import { Card, CardContent, Typography, Chip, Link, Button, Box, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { format } from 'date-fns';

import { EventItemProps, EventStatus } from '../../types/event';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../firebase';
import { useState } from 'react';
import EventMapping from './EventMapping';
import { doc, setDoc } from 'firebase/firestore';

const EventItem: React.FC<EventItemProps> = (props) => {
  const [signingUp, setSigningUp] = useState(false);
  const [signupError, setSignupError] = useState<string>();
  const [mappingOpen, setMappingOpen] = useState(false);
  // Extract values either from event object or individual props
  const id = props.event?.id || props.id;
  const title = props.event?.title || props.title;
  const url = props.event?.url || props.url;
  const date = props.event?.date || props.date;
  const source = props.event?.source || props.source;
  const status = props.event?.status || props.status;
  const statusReason = props.event?.statusReason || props.statusReason;
  
  // Don't render if required props are missing
  if (!id || !url) {
    console.warn('EventItem: Missing required props', { id, url });
    return null;
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending_mapping':
        return 'info';
      case 'mapped':
        return 'success';
      case 'schema_failed':
      case 'enqueue_failed':
      case 'signup_failed':
        return 'error';
      case 'processing_schema':
      case 'processing_signup':
        return 'warning';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  // Don't render if we don't have the minimum required props
  if (!id || !url) {
    console.warn('EventItem: Missing required props (id or url)', { id, url });
    return null;
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        {signupError && (
          <Typography color="error" sx={{ mb: 1 }}>
            {signupError}
          </Typography>
        )}
        <Typography variant="h6" component="h2" gutterBottom>
          {title || url.split('?')[0]}
        </Typography>
        <Link href={url} target="_blank" rel="noopener noreferrer">
          Visit Event Page
        </Link>
        {date && (
          <Typography color="textSecondary" sx={{ mt: 1 }}>
            {format(new Date(date), 'PPP')}
          </Typography>
        )}
        {source && (
          <Typography color="textSecondary" variant="body2">
            Source: {source}
          </Typography>
        )}
        {status && (
          <Chip
            label={status.replace(/_/g, ' ').toUpperCase()}
            color={getStatusColor(status) as any}
            size="small"
            sx={{ mt: 1 }}
          />
        )}
        {statusReason && (
          <Typography color="textSecondary" variant="body2" sx={{ mt: 1 }}>
            {statusReason}
          </Typography>
        )}
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            disabled={signingUp || status === 'completed' || status === 'pending_mapping'}
            onClick={async () => {
              try {
                setSigningUp(true);
                setSignupError(undefined);
                const signupToEvent = httpsCallable(functions, 'signupToEventV2');
                await signupToEvent({ eventId: id });
              } catch (error) {
                console.error('Error signing up:', error);
                setSignupError(error instanceof Error ? error.message : 'Failed to sign up');
              } finally {
                setSigningUp(false);
              }
            }}
          >
            {signingUp ? 'Signing up...' : 'Sign up'}
          </Button>
          {status === 'pending_mapping' && (
            <Button
              variant="contained"
              color="secondary"
              onClick={() => setMappingOpen(true)}
            >
              Map Event
            </Button>
          )}
          <Button
            variant="outlined"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Event
          </Button>
        </Box>
        
        <Dialog open={mappingOpen} onClose={() => setMappingOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Map Event Fields</DialogTitle>
          <DialogContent>
            <EventMapping 
              eventId={id} 
              onMappingComplete={() => {
                setMappingOpen(false);
                // Refresh the component or parent component if needed
                if (props.onUpdate) {
                  props.onUpdate();
                }
              }} 
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default EventItem;
