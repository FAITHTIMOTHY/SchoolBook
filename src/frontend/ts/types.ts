/**
 * SchoolBook SMS - Frontend Type Definitions
 */

export * from '../../shared/types.js';

import type { RecentServiceSummary } from '../../shared/types.js';

export type ActiveTab = 'overview' | 'portal' | 'members' | 'attendance' | 'inventory' | 'financials' | 'broadcast';

export type RecentService = RecentServiceSummary;

export type RecentSession = RecentService;
