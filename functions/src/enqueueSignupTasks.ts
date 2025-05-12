import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFunctions } from 'firebase-admin/functions';

// Configuration for the Cloud Tasks queue
const TARGET_FUNCTION_NAME = 'processSignupTask'; // Name of your deployed Cloud Task handler function

interface EnqueueError {
    eventId: string;
    error: string;
}

export const enqueueSignupTasks = onCall<{ eventIds: string[] }>(
  {
    timeoutSeconds: 60,
    memory: '256MiB'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in to enqueue tasks.'
      );
    }

    const { eventIds } = request.data;
    if (!eventIds || !Array.isArray(eventIds)) {
      throw new HttpsError(
        'invalid-argument',
        'Event IDs must be provided as an array'
      );
    }

    const uid = request.auth.uid;
    console.log(`User ${uid} requested to enqueue signup tasks.`);

    let enqueuedCount = 0;
    let skippedCount = 0;
    const errors: EnqueueError[] = [];

    try {
      const eventsSnapshot = await admin.firestore()
        .collection(`users/${uid}/events`)
        .where('status', 'in', ['mapped', 'failed', 'needs_captcha']) // Eligible for signup/retry
        .get();

      if (eventsSnapshot.empty) {
        return { message: 'No events found that are ready for signup or retry.', enqueuedCount, skippedCount, errors };
      }

      const taskQueue = getFunctions().taskQueue(TARGET_FUNCTION_NAME);

      const tasksToEnqueuePromises: Promise<void>[] = [];

      for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        const eventData = eventDoc.data();

        const mappingDoc = await admin.firestore().doc(`users/${uid}/mappings/${eventId}`).get();
        if (!mappingDoc.exists && eventData.status === 'mapped') {
          console.warn(`Event ${eventId} has status 'mapped' but no mapping document found. Skipping.`);
          // No need to await here as it's not critical for the main flow if this secondary update fails
          eventDoc.ref.update({ status: 'enqueue_failed', statusReason: 'Mapping data missing despite mapped status' })
              .catch(err => console.error(`Failed to update event ${eventId} to enqueue_failed (mapping missing):`, err));
          skippedCount++;
          continue;
        }

        const taskPayload = { userId: uid, eventId };

        tasksToEnqueuePromises.push(
          eventDoc.ref.update({ 
              status: 'queued', 
              statusReason: 'Task enqueued for processing',
              lastEnqueuedAt: admin.firestore.FieldValue.serverTimestamp()
          }).then(() => {
              return taskQueue.enqueue(taskPayload);
          }).then(() => {
              enqueuedCount++;
              console.log(`Task enqueued for event ${eventId} for user ${uid}`);
          }).catch(async (err: any) => { // Explicitly type err as any or check instanceof Error
              const errorMessage = (err instanceof Error) ? err.message : 'Task enqueuing failed or status update failed';
              console.error(`Failed to enqueue task or update status for event ${eventId}:`, errorMessage);
              errors.push({ eventId, error: errorMessage });
              try {
                  await eventDoc.ref.update({ status: 'enqueue_failed', statusReason: errorMessage.substring(0,200) });
              } catch (updateErr) {
                  console.error(`Failed to update event status to enqueue_failed for ${eventId}:`, updateErr);
              }
              skippedCount++;
          })
        );
      }

      await Promise.all(tasksToEnqueuePromises);

      let message = `Successfully processed request. Enqueued: ${enqueuedCount}, Skipped/Failed: ${skippedCount}.`;
      if (errors.length > 0) {
          message += ` Some errors occurred during enqueueing.`; // Error details are in the errors array
      }
      console.log(message);
      return { message, enqueuedCount, skippedCount, errors };

    } catch (error) {
      console.error('Error querying events or enqueuing signup tasks:', error);
      let detailMessage = 'Failed to process event signup enqueuing.';
      if (error instanceof Error) {
          detailMessage = error.message;
      }
      throw new HttpsError(
        'internal',
        'Failed to process event signup enqueuing.',
        { details: detailMessage }
      );
    }
  }
);
