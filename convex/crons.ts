import { cronJobs, makeFunctionReference } from 'convex/server';

const cleanupRef = makeFunctionReference<'mutation'>('visitor:cleanup');
const crons = cronJobs();
// 21:30 UTC is 03:00 IST, the quietest hour for Indian visitors.
crons.daily('expire visitor sessions', { hourUTC: 21, minuteUTC: 30 }, cleanupRef);
export default crons;
