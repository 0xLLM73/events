import React from 'react';
import Container from '@mui/material/Container';
import MappingUI from '../components/Mapping/MappingUI';

export default function MappingPage() {
  // The eventId is extracted from the URL route parameters within MappingUI component
  return (
    <Container component="main" maxWidth="lg"> {/* lg for a wider mapping area */}
      <MappingUI />
    </Container>
  );
}
