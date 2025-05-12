"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueSignupTasks = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const functions_1 = require("firebase-admin/functions");
// Configuration for the Cloud Tasks queue
const TARGET_FUNCTION_NAME = 'processSignupTask'; // Name of your deployed Cloud Task handler function
exports.enqueueSignupTasks = (0, https_1.onCall)({
    timeoutSeconds: 60,
    memory: '256MiB'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in to enqueue tasks.');
    }
    const { eventIds } = request.data;
    if (!eventIds || !Array.isArray(eventIds)) {
        throw new https_1.HttpsError('invalid-argument', 'Event IDs must be provided as an array');
    }
    const uid = request.auth.uid;
    console.log(`User ${uid} requested to enqueue signup tasks.`);
    let enqueuedCount = 0;
    let skippedCount = 0;
    const errors = [];
    try {
        const eventsSnapshot = await admin.firestore()
            .collection(`users/${uid}/events`)
            .where('status', 'in', ['mapped', 'failed', 'needs_captcha']) // Eligible for signup/retry
            .get();
        if (eventsSnapshot.empty) {
            return { message: 'No events found that are ready for signup or retry.', enqueuedCount, skippedCount, errors };
        }
        const taskQueue = (0, functions_1.getFunctions)().taskQueue(TARGET_FUNCTION_NAME);
        const tasksToEnqueuePromises = [];
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
            tasksToEnqueuePromises.push(eventDoc.ref.update({
                status: 'queued',
                statusReason: 'Task enqueued for processing',
                lastEnqueuedAt: admin.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                return taskQueue.enqueue(taskPayload);
            }).then(() => {
                enqueuedCount++;
                console.log(`Task enqueued for event ${eventId} for user ${uid}`);
            }).catch(async (err) => {
                const errorMessage = (err instanceof Error) ? err.message : 'Task enqueuing failed or status update failed';
                console.error(`Failed to enqueue task or update status for event ${eventId}:`, errorMessage);
                errors.push({ eventId, error: errorMessage });
                try {
                    await eventDoc.ref.update({ status: 'enqueue_failed', statusReason: errorMessage.substring(0, 200) });
                }
                catch (updateErr) {
                    console.error(`Failed to update event status to enqueue_failed for ${eventId}:`, updateErr);
                }
                skippedCount++;
            }));
        }
        await Promise.all(tasksToEnqueuePromises);
        let message = `Successfully processed request. Enqueued: ${enqueuedCount}, Skipped/Failed: ${skippedCount}.`;
        if (errors.length > 0) {
            message += ` Some errors occurred during enqueueing.`; // Error details are in the errors array
        }
        console.log(message);
        return { message, enqueuedCount, skippedCount, errors };
    }
    catch (error) {
        console.error('Error querying events or enqueuing signup tasks:', error);
        let detailMessage = 'Failed to process event signup enqueuing.';
        if (error instanceof Error) {
            detailMessage = error.message;
        }
        throw new https_1.HttpsError('internal', 'Failed to process event signup enqueuing.', { details: detailMessage });
    }
});
//# sourceMappingURL=enqueueSignupTasks.js.map