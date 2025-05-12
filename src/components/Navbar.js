import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function Navbar({ currentUser }) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log('Successfully signed out');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              Conference Signup
            </RouterLink>
          </Typography>
          {currentUser ? (
            <>
              <Button color="inherit" component={RouterLink} to="/dashboard">Dashboard</Button>
              <Button color="inherit" component={RouterLink} to="/events">Events</Button>
              <Button color="inherit" component={RouterLink} to="/profile">Profile</Button>
              <Button color="inherit" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
            <Button color="inherit" component={RouterLink} to="/login">Login</Button>
          )}
        </Toolbar>
      </AppBar>
    </Box>
  );
}
