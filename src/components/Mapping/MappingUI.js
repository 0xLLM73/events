import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
// import { db, auth } from '../../firebase'; // User will uncomment and setup
// import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Mock data (replace with Firestore fetching)
const mockUserProfile = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '123-456-7890',
  organization: 'Example Corp',
  dietaryRestrictions: 'Vegetarian',
  otherInfo: `T-Shirt: L
Emergency Contact: Jane Doe - 0987654321`,
  // Fields from profile form
};

const mockEventSchema = {
  // Fetched from /users/{uid}/events/{eventId}/schema/formSchema
  forms: [
    {
      id: 'eventSignupForm1',
      fields: [
        { name: 'entry.123.fullName', label: 'Full Name', type: 'text', placeholder: 'Enter your full name' },
        { name: 'entry.456.emailAddress', label: 'Email', type: 'email', placeholder: 'your@email.com' },
        { name: 'entry.789.phoneNumber', label: 'Phone (Optional)', type: 'tel', placeholder: '123-456-7890' },
        { name: 'entry.101.company', label: 'Company/Organization', type: 'text', placeholder: 'Your Company' },
        { name: 'entry.112.diet', label: 'Dietary Needs', type: 'select', options: ['None', 'Vegetarian', 'Gluten-Free'] },
        { name: 'entry.113.abstractField', label: 'Abstract Submission Title', type: 'text', placeholder: 'N/A' }
      ],
    },
  ],
};

export default function MappingUI() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [eventSchema, setEventSchema] = useState(null);
  const [mappings, setMappings] = useState({}); // { schemaFieldKey: profileFieldKey_OR_CUSTOM_VALUE }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // const currentUser = auth.currentUser;
  const currentUser = { uid: 'test-uid' }; // Mock current user

  useEffect(() => {
    // if (!currentUser || !eventId) {
    //   setError('User or Event ID missing.');
    //   setLoading(false);
    //   return;
    // }

    const fetchData = async () => {
      // try {
      //   // Fetch user profile
      //   const userProfileRef = doc(db, 'users', currentUser.uid);
      //   const userProfileSnap = await getDoc(userProfileRef);
      //   if (userProfileSnap.exists()) {
      //     setUserProfile(userProfileSnap.data());
      //   } else {
      //     throw new Error('User profile not found. Please complete your profile first.');
      //   }

      //   // Fetch event schema
      //   const schemaRef = doc(db, 'users', currentUser.uid, 'events', eventId, 'schema', 'formSchema');
      //   const schemaSnap = await getDoc(schemaRef);
      //   if (schemaSnap.exists()) {
      //     setEventSchema(schemaSnap.data());
      //   } else {
      //     throw new Error('Event schema not found.');
      //   }

      //   // Fetch existing mappings
      //   const mappingRef = doc(db, 'users', currentUser.uid, 'mappings', eventId);
      //   const mappingSnap = await getDoc(mappingRef);
      //   if (mappingSnap.exists()) {
      //     setMappings(mappingSnap.data().fieldMappings || {});
      //   }
      // } catch (err) {
      //   console.error('Error fetching data for mapping:', err);
      //   setError(err.message || 'Failed to load data.');
      // }
      // setLoading(false);
      console.log("Simulating fetch for mapping UI for event:", eventId, "and user:", currentUser?.uid);
      setTimeout(() => {
        setUserProfile(mockUserProfile);
        setEventSchema(mockEventSchema);
        // Simulate fetching existing mappings if any, for now empty
        setMappings({}); 
        setLoading(false);
      }, 500);
    };

    fetchData();
  }, [currentUser, eventId]);

  const handleMappingChange = (schemaFieldKey, profileFieldKeyOrCustomValue) => {
    setMappings(prev => ({ ...prev, [schemaFieldKey]: profileFieldKeyOrCustomValue }));
  };

  const handleSaveMappings = async () => {
    // if (!currentUser || !eventId) {
    //   setError('Cannot save: User or Event ID missing.');
    //   return;
    // }
    setSaving(true);
    setError('');
    setSuccessMessage('');
    // try {
    //   const mappingData = { eventId, userId: currentUser.uid, fieldMappings: mappings, updatedAt: new Date() };
    //   await setDoc(doc(db, 'users', currentUser.uid, 'mappings', eventId), mappingData, { merge: true });
      
    //   // Update event status to 'mapped'
    //   const eventRef = doc(db, 'users', currentUser.uid, 'events', eventId);
    //   await updateDoc(eventRef, { status: 'mapped' });

    //   setSuccessMessage('Mappings saved successfully! Event is ready for signup.');
    //   setTimeout(() => navigate('/events'), 2000); // Redirect after a delay
    // } catch (err) {
    //   console.error('Error saving mappings:', err);
    //   setError('Failed to save mappings.');
    // }
    // setSaving(false);
    console.log("Simulating save mappings:", mappings);
    setTimeout(() => {
        setSuccessMessage('Mappings saved successfully! (simulated)');
        setSaving(false);
        // Update mock event status in EventList would require passing state up or re-fetching, for now just navigate
        // For actual app, Firestore listener in EventList.js would update the status automatically.
        setTimeout(() => navigate('/events'), 1500);
    }, 1000);
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }
  if (!userProfile || !eventSchema || !eventSchema.forms || eventSchema.forms.length === 0) {
    return <Alert severity="info" sx={{ m: 2 }}>Missing profile or event schema data to perform mapping.</Alert>;
  }

  const profileFieldsForSelect = Object.keys(userProfile).map(key => ({ value: key, label: `${key.charAt(0).toUpperCase() + key.slice(1)} (${userProfile[key].toString().substring(0,20)}...)` }));
  // Add an option for custom input or leaving unmapped
  profileFieldsForSelect.unshift({ value: '__LEAVE_UNMAPPED__', label: '-- Leave Unmapped / Manual Entry --' });
  profileFieldsForSelect.unshift({ value: '__CUSTOM_VALUE__', label: '-- Enter Custom Value --' }); // Future: allow direct text input for some


  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>Map Profile to Event Form</Typography>
      <Typography variant="subtitle1" gutterBottom>Event ID: {eventId}</Typography>
      
      {eventSchema.forms.map(form => (
        <Paper key={form.id || 'form1'} sx={{ p: 2, mt: 2, mb: 2 }}>
          <Typography variant="h6">Form: {form.id || 'Default Form'}</Typography>
          {form.fields.map(field => {
            const schemaFieldKey = field.name || field.label.replace(/\s+/g, ''); // Create a unique key
            return (
              <Grid container spacing={2} key={schemaFieldKey} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={12} sm={5}>
                  <Typography variant="body1"><strong>{field.label || field.name}</strong></Typography>
                  <Typography variant="caption">({field.name}, type: {field.type}, placeholder: {field.placeholder || 'N/A'})</Typography>
                </Grid>
                <Grid item xs={12} sm={7}>
                  <FormControl fullWidth>
                    <InputLabel id={`select-label-${schemaFieldKey}`}>Map to Profile Field</InputLabel>
                    <Select
                      labelId={`select-label-${schemaFieldKey}`}
                      value={mappings[schemaFieldKey] || '__LEAVE_UNMAPPED__'}
                      label="Map to Profile Field"
                      onChange={(e) => handleMappingChange(schemaFieldKey, e.target.value)}
                    >
                      {profileFieldsForSelect.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {/* TODO: If '__CUSTOM_VALUE__' is selected, show a TextField here */}
                </Grid>
              </Grid>
            );
          })}
        </Paper>
      ))}

      {successMessage && <Alert severity="success" sx={{ mt: 2 }}>{successMessage}</Alert>}
      
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleSaveMappings} 
        disabled={saving || loading}
        sx={{ mt: 3 }}
      >
        {saving ? <CircularProgress size={24} /> : 'Save Mappings & Mark as Ready'}
      </Button>
    </Box>
  );
}
