import { container } from 'tsyringe';

import { UserEventsService } from '@~/features/user/user-events.service';

export default async function eventsLoader() {
  container.resolve(UserEventsService);
}
