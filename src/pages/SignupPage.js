import React from 'react';
import Container from '@mui/material/Container';
import SignupForm from '../components/Auth/SignupForm';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

export default function SignupPage() {
  return (
    <Container component="main" maxWidth="xs">
      <SignupForm />
      <Typography align="center" sx={{ mt: 2 }}>
        Already have an account? <RouterLink to="/login">Sign In</RouterLink>
      </Typography>
    </Container>
  );
}
