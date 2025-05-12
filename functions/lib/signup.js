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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupToEvent = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
exports.signupToEvent = (0, https_1.onCall)(async (request) => {
    // Ensure user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in to sign up for events.');
    }
    const { eventId } = request.data;
    if (!eventId) {
        throw new https_1.HttpsError('invalid-argument', 'Event ID is required');
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
            throw new https_1.HttpsError('not-found', 'Event not found');
        }
        const eventData = eventDoc.data();
        if (!eventData) {
            throw new https_1.HttpsError('not-found', 'Event data not found');
        }
        // Check if already signed up
        if (eventData.status === 'completed') {
            throw new https_1.HttpsError('already-exists', 'Already signed up for this event');
        }
        // Get user data for signup
        const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
        const userData = userDoc.data();
        if (!userData) {
            throw new https_1.HttpsError('not-found', 'User data not found');
        }
        // Attempt to sign up for the event
        const response = await (0, node_fetch_1.default)(eventData.url, {
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
    }
    catch (error) {
        console.error('Error signing up for event:', error);
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'Failed to sign up for event');
    }
});
//# sourceMappingURL=signup.js.map