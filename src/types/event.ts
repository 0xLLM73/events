export type EventStatus = 'pending_mapping' | 'mapped' | 'schema_failed' | 'enqueue_failed' | 'signup_failed' | 'processing_schema' | 'processing_signup' | 'completed';

export interface EventData {
  id: string;
  title: string;
  url: string;
  date: string;
  source: string;
  status: EventStatus;
  statusReason?: string;
}

export interface EventItemProps {
  event?: EventData;
  id?: string;
  title?: string;
  url?: string;
  date?: string;
  source?: string;
  status?: EventStatus;
  statusReason?: string;
  onUpdate?: () => void;
}
