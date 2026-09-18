import { forwardPremium } from '../../server/forward-premium';
export function POST(request: Request) { return forwardPremium(request, '/api/pronounce'); }
