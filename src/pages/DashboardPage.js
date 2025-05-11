import React from 'react';
import Container from '@mui/material/Container';
import Dashboard from '../components/Dashboard/Dashboard';

export default function DashboardPage() {
  return (
    <Container component="main" maxWidth="lg"> {/* lg for a wider dashboard area */}
      <Dashboard />
    </Container>
  );
}
