import { FC } from 'react';

interface EventItemProps {
  id: string;
  title: string;
  url: string;
  date?: string;
  source?: string;
  status?: string;
}

declare const EventItem: FC<EventItemProps>;

export default EventItem;
