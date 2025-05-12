import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

export const signupToEvent = onCall<{ eventId: string }>(async (request) => {
  // Ensure user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'You must be logged in to sign up for events.'
    );
  }

  const { eventId } = request.data;
  if (!eventId) {
    throw new HttpsError(
      'invalid-argument',
      'Event ID is required'
    );
  }

  try {
    // Get the event data
    const eventDoc = await admin
      .firestore()
      .collection('users')
      .doc(request.auth.uid)
      .collection('events')
      .doc(eventId)
      .get();

    if (!eventDoc.exists) {
      throw new HttpsError(
        'not-found',
        'Event not found'
      );
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      throw new HttpsError(
        'not-found',
        'Event data not found'
      );
    }

    // Check if already signed up
    if (eventData.status === 'completed') {
      throw new HttpsError(
        'already-exists',
        'Already signed up for this event'
      );
    }

    // Get user data for signup
    const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();
    if (!userData) {
      throw new HttpsError(
        'not-found',
        'User data not found'
      );
    }

    // Attempt to sign up for the event
    const response = await fetch(eventData.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: userData.displayName || '',
        email: userData.email || '',
        // Add any other required fields
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to sign up: ${response.statusText}`);
    }

    // Update event status
    await eventDoc.ref.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error signing up for event:', error);
    throw new HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to sign up for event'
    );
  }
});
