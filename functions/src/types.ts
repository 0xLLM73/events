// functions/src/types.ts

// Structure for events extracted by ingestEvents before saving to Firestore
export interface ExtractedEvent {
  title: string;
  url: string;
  date: string; // ISO string format
  source: 'Notion' | 'HTMLCrawler';
}

// User Profile Structure (as saved in /users/{uid})
export interface UserProfile {
  name?: string;
  email: string; // Usually from auth, non-optional
  phone?: string;
  organization?: string;
  dietaryRestrictions?: string;
  otherInfo?: string;
  createdAt?: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
  [key: string]: any; // To allow other dynamic profile fields from the form
}

// Event Data Structure (as saved in /users/{uid}/events/{eventId})
// This can extend ExtractedEvent or share fields if appropriate
export interface EventData {
  url: string;
  title?: string;
  date?: string; // ISO string format
  status?: string; // e.g., pending_schema, pending_mapping, mapped, queued, processing, success, failed, needs_captcha
  statusReason?: string;
  originalIngestionUrl?: string;
  source?: 'Notion' | 'HTMLCrawler';
  createdAt?: any; // Firestore Timestamp
  userId?: string;
  screenshotUrl?: string; 
  lastEnqueuedAt?: any; // Firestore Timestamp
  error?: string;
}

// Schema structures (as saved in /users/{uid}/events/{eventId}/schema/formSchema)
export interface FormFieldSchema {
  name: string;
  id?: string;
  type: string;
  label: string;
  placeholder?: string;
  selector: string;
  options?: { value: string; text: string }[];
}

export interface EventFormSchema {
  id: string;
  action?: string;
  method?: string;
  fields: FormFieldSchema[];
}

export interface EventSchema {
  forms: EventFormSchema[];
  discoveredAt?: any; // Firestore Timestamp or Date
  sourceUrl?: string;
}

// Field Mapping Structure (as saved in /users/{uid}/mappings/{eventId})
export interface FieldMappings {
  [schemaFieldKey: string]: string;
}

export interface MappingDoc {
    eventId: string;
    userId: string;
    fieldMappings: FieldMappings;
    updatedAt: any; // Firestore Timestamp
}
