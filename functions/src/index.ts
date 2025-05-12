import * as admin from 'firebase-admin';
import { ingestEvents as ingestEventsFunction } from './ingestEvents';
import { discoverSchema as discoverSchemaFunction } from './discoverSchema';
import { enqueueSignupTasks as enqueueSignupTasksFunction } from './enqueueSignupTasks';
import { signupToEvent as signupToEventFunction } from './signup';
import { processSignupTask as processSignupTaskFunction } from './processSignupTask';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK only once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export v1 functions
export const ingestEvents = ingestEventsFunction;
export const discoverSchema = discoverSchemaFunction;
export const enqueueSignupTasks = enqueueSignupTasksFunction;
export const signupToEvent = signupToEventFunction;
export const processSignupTask = processSignupTaskFunction;

// Export v2 functions
export { signupToEvent as signupToEventV2 } from './signup';
export { ingestEvents as ingestEventsV2 } from './ingestEvents';
export { enqueueSignupTasks as enqueueSignupTasksV2 } from './enqueueSignupTasks';
export { processSignupTask as processSignupTaskV2 } from './processSignupTask';
export { directSignup as directSignupV2 } from './directSignup';

// Create a manual trigger for schema discovery since we're having issues with Firestore triggers in v2

// This function will manually trigger schema discovery for pending events
export const triggerSchemaDiscovery = onRequest({
  timeoutSeconds: 540,
  memory: '2GiB'
}, async (req, res) => {
  try {
    const db = getFirestore();
    const pendingEvents = await db.collectionGroup('events')
      .where('status', '==', 'pending_schema')
      .limit(10)
      .get();
    
    console.log(`Found ${pendingEvents.size} events pending schema discovery`);
    
    const promises: Promise<any>[] = [];
    pendingEvents.forEach(doc => {
      // Get event data from document
      // const eventData = doc.data(); // Uncomment if needed
      const path = doc.ref.path.split('/');
      const userId = path[1]; // users/{userId}/events/{eventId}
      const eventId = path[3];
      
      console.log(`Processing schema for event ${eventId} for user ${userId}`);
      
      // Update status to processing
      promises.push(doc.ref.update({
        status: 'processing_schema',
        statusReason: 'Starting schema discovery'
      }));
      
      // TODO: Add schema discovery logic here
      // For now, just mark as pending_mapping to allow user to map fields
      setTimeout(() => {
        doc.ref.update({
          status: 'pending_mapping',
          statusReason: 'Ready for field mapping'
        });
      }, 2000);
    });
    
    await Promise.all(promises);
    
    res.status(200).send({
      success: true,
      processed: pendingEvents.size
    });
  } catch (error) {
    console.error('Error triggering schema discovery:', error);
    res.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
