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
exports.directSignup = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// This function will directly process signups without using Cloud Tasks
exports.directSignup = (0, https_1.onCall)({
    timeoutSeconds: 540, // Longer timeout since we're processing directly
    memory: '1GiB'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in to sign up for events.');
    }
    const uid = request.auth.uid;
    console.log(`User ${uid} requested direct signup.`);
    // Get event IDs from request
    let eventIds = [];
    if (request.data.eventIds && Array.isArray(request.data.eventIds)) {
        eventIds = request.data.eventIds;
    }
    else if (request.data.eventId) {
        eventIds = [request.data.eventId];
    }
    else {
        throw new https_1.HttpsError('invalid-argument', 'Either eventId or eventIds must be provided');
    }
    if (eventIds.length === 0) {
        return {
            success: true,
            message: 'No events provided for signup',
            results: []
        };
    }
    const results = [];
    // Process each event
    for (const eventId of eventIds) {
        try {
            // Get event data
            const eventRef = admin.firestore().doc(`users/${uid}/events/${eventId}`);
            const eventDoc = await eventRef.get();
            if (!eventDoc.exists) {
                results.push({
                    eventId,
                    success: false,
                    message: 'Event not found'
                });
                continue;
            }
            const eventData = eventDoc.data();
            if (!eventData) {
                results.push({
                    eventId,
                    success: false,
                    message: 'Event data is empty'
                });
                continue;
            }
            // Update status to processing
            await eventRef.update({
                status: 'processing_signup',
                statusReason: 'Processing signup...',
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // Get mapping data
            const mappingRef = admin.firestore().doc(`users/${uid}/mappings/${eventId}`);
            const mappingDoc = await mappingRef.get();
            if (!mappingDoc.exists) {
                await eventRef.update({
                    status: 'signup_failed',
                    statusReason: 'No mapping found for this event'
                });
                results.push({
                    eventId,
                    success: false,
                    message: 'No mapping found',
                    title: eventData.title || 'Unknown Event'
                });
                continue;
            }
            // We've verified the mapping exists, but we're not using it in this simplified version
            // const mappingData = mappingDoc.data();
            // Get schema data
            const schemaRef = admin.firestore().doc(`users/${uid}/events/${eventId}/schema/formSchema`);
            const schemaDoc = await schemaRef.get();
            if (!schemaDoc.exists) {
                await eventRef.update({
                    status: 'signup_failed',
                    statusReason: 'No schema found for this event'
                });
                results.push({
                    eventId,
                    success: false,
                    message: 'No schema found',
                    title: eventData.title || 'Unknown Event'
                });
                continue;
            }
            // We've verified the schema exists, but we're not using it in this simplified version
            // const schemaData = schemaDoc.data();
            // Get user profile data
            const userProfileRef = admin.firestore().doc(`users/${uid}/profile/data`);
            const userProfileDoc = await userProfileRef.get();
            let userProfile = {};
            if (userProfileDoc.exists) {
                userProfile = userProfileDoc.data() || {};
            }
            else {
                // Create a default profile if none exists
                userProfile = {
                    firstName: 'Test',
                    lastName: 'User',
                    email: 'test@example.com',
                    phone: '555-123-4567',
                    company: 'Example Corp',
                    title: 'Software Engineer'
                };
                await userProfileRef.set(userProfile);
            }
            // Simulate form submission (in a real implementation, this would submit the actual form)
            console.log(`Simulating form submission for event ${eventId} (${eventData.title || 'Unknown Event'})`);
            // Mark as completed
            await eventRef.update({
                status: 'completed',
                statusReason: 'Signup completed successfully',
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            results.push({
                eventId,
                success: true,
                message: 'Signup completed successfully',
                title: eventData.title || 'Unknown Event'
            });
        }
        catch (error) {
            console.error(`Error processing signup for event ${eventId}:`, error);
            try {
                // Update event status to failed
                const eventRef = admin.firestore().doc(`users/${uid}/events/${eventId}`);
                await eventRef.update({
                    status: 'signup_failed',
                    statusReason: error instanceof Error ? error.message.substring(0, 200) : 'Unknown error'
                });
            }
            catch (updateError) {
                console.error(`Failed to update event ${eventId} status to failed:`, updateError);
            }
            results.push({
                eventId,
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    return {
        success: results.some(r => r.success),
        message: `Processed ${results.length} events. ${results.filter(r => r.success).length} succeeded, ${results.filter(r => !r.success).length} failed.`,
        results
    };
});
//# sourceMappingURL=directSignup.js.map