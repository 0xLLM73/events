import React from 'react';
import Container from '@mui/material/Container';
import EventList from '../components/Events/EventList';

export default function EventListPage() {
  return (
    <Container component="main" maxWidth="lg"> {/* lg for a wider list area */}
      <EventList />
    </Container>
  );
}
