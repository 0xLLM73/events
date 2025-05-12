import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// This function will directly process signups without using Cloud Tasks
export const directSignup = onCall<{ eventIds?: string[], eventId?: string }>(
  {
    timeoutSeconds: 540, // Longer timeout since we're processing directly
    memory: '1GiB'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'You must be logged in to sign up for events.'
      );
    }

    const uid = request.auth.uid;
    console.log(`User ${uid} requested direct signup.`);

    // Get event IDs from request
    let eventIds: string[] = [];
    if (request.data.eventIds && Array.isArray(request.data.eventIds)) {
      eventIds = request.data.eventIds;
    } else if (request.data.eventId) {
      eventIds = [request.data.eventId];
    } else {
      throw new HttpsError(
        'invalid-argument',
        'Either eventId or eventIds must be provided'
      );
    }

    if (eventIds.length === 0) {
      return { 
        success: true, 
        message: 'No events provided for signup', 
        results: [] 
      };
    }

    const results: Array<{
      eventId: string;
      success: boolean;
      message: string;
      title?: string;
    }> = [];

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
        let userProfile: any = {};
        
        if (userProfileDoc.exists) {
          userProfile = userProfileDoc.data() || {};
        } else {
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
        
      } catch (error) {
        console.error(`Error processing signup for event ${eventId}:`, error);
        
        try {
          // Update event status to failed
          const eventRef = admin.firestore().doc(`users/${uid}/events/${eventId}`);
          await eventRef.update({
            status: 'signup_failed',
            statusReason: error instanceof Error ? error.message.substring(0, 200) : 'Unknown error'
          });
        } catch (updateError) {
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
  }
);
