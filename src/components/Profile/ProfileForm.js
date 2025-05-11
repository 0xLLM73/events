import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert'; // Added for better feedback

// Import Firebase services and serverTimestamp if needed
import { db, auth } from '../../firebase'; 
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const initialFormState = {
  name: '',
  phone: '',
  organization: '',
  dietaryRestrictions: '',
  otherInfo: '',
  email: '', // Will be pre-filled from auth
  createdAt: null, // To store creation timestamp
  updatedAt: null, // To store update timestamp
};

export default function ProfileForm() {
  const [formState, setFormState] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Get current user from Firebase Auth
  // Note: Relies on onAuthStateChanged in App.js to update parent state 
  // and protect this route. Here we assume currentUser is available if page is accessed.
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      setError('User not authenticated. Please login.');
      setLoading(false);
      return;
    }

    // Pre-fill email from auth user, which is read-only in the form
    setFormState(prev => ({ ...prev, email: currentUser.email || '' }));

    const fetchProfile = async () => {
      setLoading(true);
      const userDocRef = doc(db, 'users', currentUser.uid);
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          // Convert Firestore Timestamps to Date objects or strings if necessary for form state
          // For now, spread directly. Ensure form fields can handle timestamp objects if they are directly used.
          setFormState({ 
            ...initialFormState, // Start with initial to ensure all fields are present
            email: currentUser.email || '', // ensure email is from auth
            ...profileData 
          });
        } else {
          console.log('No existing profile found for user. A new one will be created on save.');
          // Form remains with initial state (email pre-filled)
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile. ' + err.message);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [currentUser]); // Re-fetch if currentUser changes (e.g., re-login)

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setError('User not authenticated. Cannot save profile.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    const userDocRef = doc(db, 'users', currentUser.uid);
    const profileDataToSave = {
      ...formState,
      email: currentUser.email, // Ensure email is always the authenticated user's email
      updatedAt: serverTimestamp(), // Use Firestore server timestamp for updates
    };

    // Set createdAt only if it's a new profile (i.e., not loaded from Firestore)
    if (!formState.createdAt) { 
      profileDataToSave.createdAt = serverTimestamp();
    }

    try {
      // Using setDoc with { merge: true } to create or update the document.
      await setDoc(userDocRef, profileDataToSave, { merge: true });
      setSuccessMessage('Profile saved successfully!');
      // Optionally, update local state with new timestamps if needed, though serverTimestamp resolves on server
      // setFormState(prev => ({...prev, updatedAt: new Date() })); // Or re-fetch profile
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile. ' + err.message);
    }
    setSaving(false);
  };

  if (!currentUser && !loading) { // Handling the case where auth might still be loading initially
    return <Alert severity="error">Please log in to view or edit your profile.</Alert>;
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box
      sx={{
        marginTop: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Typography component="h1" variant="h5">
        User Profile
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3, width: '100%' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              name="name"
              required
              fullWidth
              id="name"
              label="Full Name"
              autoFocus
              value={formState.name}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              value={formState.email} // Display user's email from state (synced with auth)
              InputProps={{
                readOnly: true, // Email should not be changed here
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="phone"
              fullWidth
              id="phone"
              label="Phone Number"
              value={formState.phone}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="organization"
              fullWidth
              id="organization"
              label="Organization/Company"
              value={formState.organization}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              name="dietaryRestrictions"
              fullWidth
              id="dietaryRestrictions"
              label="Dietary Restrictions (e.g., vegetarian, gluten-free)"
              multiline
              rows={3}
              value={formState.dietaryRestrictions}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              name="otherInfo"
              fullWidth
              id="otherInfo"
              label="Other Common Signup Fields (e.g., T-shirt size)"
              multiline
              rows={3}
              value={formState.otherInfo}
              onChange={handleChange}
            />
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {successMessage}
          </Alert>
        )}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={saving || loading || !currentUser} // Disable if not logged in
        >
          {saving ? <CircularProgress size={24} /> : 'Save Profile'}
        </Button>
      </Box>
    </Box>
  );
}
