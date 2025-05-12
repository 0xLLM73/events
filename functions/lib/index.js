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
exports.triggerSchemaDiscovery = exports.directSignupV2 = exports.processSignupTaskV2 = exports.enqueueSignupTasksV2 = exports.ingestEventsV2 = exports.signupToEventV2 = exports.processSignupTask = exports.signupToEvent = exports.enqueueSignupTasks = exports.discoverSchema = exports.ingestEvents = void 0;
const admin = __importStar(require("firebase-admin"));
const ingestEvents_1 = require("./ingestEvents");
const discoverSchema_1 = require("./discoverSchema");
const enqueueSignupTasks_1 = require("./enqueueSignupTasks");
const signup_1 = require("./signup");
const processSignupTask_1 = require("./processSignupTask");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
// Initialize Firebase Admin SDK only once
if (admin.apps.length === 0) {
    admin.initializeApp();
}
// Export v1 functions
exports.ingestEvents = ingestEvents_1.ingestEvents;
exports.discoverSchema = discoverSchema_1.discoverSchema;
exports.enqueueSignupTasks = enqueueSignupTasks_1.enqueueSignupTasks;
exports.signupToEvent = signup_1.signupToEvent;
exports.processSignupTask = processSignupTask_1.processSignupTask;
// Export v2 functions
var signup_2 = require("./signup");
Object.defineProperty(exports, "signupToEventV2", { enumerable: true, get: function () { return signup_2.signupToEvent; } });
var ingestEvents_2 = require("./ingestEvents");
Object.defineProperty(exports, "ingestEventsV2", { enumerable: true, get: function () { return ingestEvents_2.ingestEvents; } });
var enqueueSignupTasks_2 = require("./enqueueSignupTasks");
Object.defineProperty(exports, "enqueueSignupTasksV2", { enumerable: true, get: function () { return enqueueSignupTasks_2.enqueueSignupTasks; } });
var processSignupTask_2 = require("./processSignupTask");
Object.defineProperty(exports, "processSignupTaskV2", { enumerable: true, get: function () { return processSignupTask_2.processSignupTask; } });
var directSignup_1 = require("./directSignup");
Object.defineProperty(exports, "directSignupV2", { enumerable: true, get: function () { return directSignup_1.directSignup; } });
// Create a manual trigger for schema discovery since we're having issues with Firestore triggers in v2
// This function will manually trigger schema discovery for pending events
exports.triggerSchemaDiscovery = (0, https_1.onRequest)({
    timeoutSeconds: 540,
    memory: '2GiB'
}, async (req, res) => {
    try {
        const db = (0, firestore_1.getFirestore)();
        const pendingEvents = await db.collectionGroup('events')
            .where('status', '==', 'pending_schema')
            .limit(10)
            .get();
        console.log(`Found ${pendingEvents.size} events pending schema discovery`);
        const promises = [];
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
    }
    catch (error) {
        console.error('Error triggering schema discovery:', error);
        res.status(500).send({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
//# sourceMappingURL=index.js.map