import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; // Removed BrowserRouter as it's in index.js
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Firebase - User will uncomment and set up src/firebase.js
import { auth } from './firebase'; 
import { onAuthStateChanged } from 'firebase/auth';

// Pages
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import EventListPage from './pages/EventListPage';
import MappingPage from './pages/MappingPage';
import DashboardPage from './pages/DashboardPage';
import SignupPage from './pages/SignupPage'; // Assuming we'll add a dedicated signup page

// Components
import Navbar from './components/Navbar';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? `Logged in as ${user.email}` : 'Logged out');
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe();

  }, []);

  if (loadingAuth) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
        </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
        <Navbar currentUser={currentUser} />
        <Routes>
          <Route path="/login" element={!currentUser ? <LoginPage /> : <Navigate to="/dashboard" />} />
          <Route path="/signup" element={!currentUser ? <SignupPage /> : <Navigate to="/dashboard" />} /> 
          
          {/* Protected Routes */}
          <Route path="/profile" element={currentUser ? <ProfilePage /> : <Navigate to="/login" />} />
          <Route path="/events" element={currentUser ? <EventListPage /> : <Navigate to="/login" />} />
          <Route path="/events/:eventId/map" element={currentUser ? <MappingPage /> : <Navigate to="/login" />} />
          <Route path="/dashboard" element={currentUser ? <DashboardPage /> : <Navigate to="/login" />} />
          
          <Route path="/" element={currentUser ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/login"} />} /> {/* Catch-all */}
        </Routes>
    </ThemeProvider>
  );
}

export default App;
