import React from 'react';
import Container from '@mui/material/Container';
import ProfileForm from '../components/Profile/ProfileForm';

export default function ProfilePage() {
  return (
    <Container component="main" maxWidth="md"> {/* md for a wider form container */}
      <ProfileForm />
    </Container>
  );
}
