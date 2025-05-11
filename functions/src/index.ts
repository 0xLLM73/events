import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK only once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Import and re-export functions from their individual files.
// This makes the main index file cleaner and organizes functions by feature.

// Event Ingestion Function
import { ingestEvents as ingestEventsFunction } from './ingestEvents';
export const ingestEvents = ingestEventsFunction;

// Schema Discovery Function (Firestore Trigger)
import { discoverSchema as discoverSchemaFunction } from './discoverSchema';
export const discoverSchema = discoverSchemaFunction;

// Task Enqueueing Function
import { enqueueSignupTasks as enqueueSignupTasksFunction } from './enqueueSignupTasks';
export const enqueueSignupTasks = enqueueSignupTasksFunction;

// Task Processing Function (Cloud Task Handler)
import { processSignupTask as processSignupTaskFunction } from './processSignupTask';
export const processSignupTask = processSignupTaskFunction;

// You can add other utility functions or groups here if needed.
