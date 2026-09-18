import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';
const crons = cronJobs();
crons.interval('Review premium contribution', { hours: 12 }, internal.costs.review, {});
export default crons;
