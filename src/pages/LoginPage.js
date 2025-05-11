import React from 'react';
import Container from '@mui/material/Container';
import LoginForm from '../components/Auth/LoginForm';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link'; // Import Link from MUI
import { Link as RouterLink } from 'react-router-dom';

export default function LoginPage() {
  return (
    <Container component="main" maxWidth="xs">
      <LoginForm />
      <Typography align="center" sx={{ mt: 2 }}>
        Don't have an account? <Link component={RouterLink} to="/signup">Sign Up</Link>
      </Typography>
    </Container>
  );
}
