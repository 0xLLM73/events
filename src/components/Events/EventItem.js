import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { Link as RouterLink } from 'react-router-dom';

export default function EventItem({ event }) {
  const { id, title, url, date, status, schema } = event;

  const getStatusChip = () => {
    let color = 'default';
    let label = status ? status.replace('_', ' ').toUpperCase() : 'UNKNOWN';

    switch (status) {
      case 'success':
        color = 'success';
        label = '✅ SIGNED UP';
        break;
      case 'pending_schema':
        color = 'info';
        label = 'PENDING SCHEMA';
        break;
      case 'schema_failed':
        color = 'error';
        label = 'SCHEMA FAILED';
        break;
      case 'pending_mapping':
        color = 'warning';
        label = 'NEEDS MAPPING';
        break;
      case 'mapped':
        color = 'primary';
        label = 'READY TO SIGNUP';
        break;
      case 'queued':
        color = 'secondary';
        label = 'QUEUED FOR SIGNUP';
        break;
      case 'processing':
        color = 'info';
        label = '⏳ PROCESSING SIGNUP';
        break;
      case 'needs_captcha':
        color = 'warning';
        label = '⚠️ NEEDS CAPTCHA';
        break;
      case 'failed':
        color = 'error';
        label = '❌ SIGNUP FAILED';
        break;
      default:
        break;
    }
    return <Chip label={label} color={color} size="small" />;
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" component="div">
          {title || 'Event Title Missing'}
        </Typography>
        <Typography sx={{ mb: 1.5 }} color="text.secondary">
          {date ? new Date(date).toLocaleDateString() : 'Date Missing'} - <a href={url} target="_blank" rel="noopener noreferrer">Visit Event Page</a>
        </Typography>
        {getStatusChip()}
        {schema && status === 'pending_mapping' && (
            <Typography variant="body2" sx={{mt:1}}>Form schema discovered. Ready for field mapping.</Typography>
        )}
      </CardContent>
      <CardActions>
        {status === 'pending_mapping' && schema && (
          <Button size="small" component={RouterLink} to={`/events/${id}/map`}>
            Map Fields
          </Button>
        )}
        {(status === 'failed' || status === 'needs_captcha') && (
          <Button size="small" /* onClick={() => handleRetry(id)} - Implement retry logic */ >
            Retry Signup
          </Button>
        )}
         {/* Add other actions, e.g., view details, delete event */}
      </CardActions>
    </Card>
  );
}
