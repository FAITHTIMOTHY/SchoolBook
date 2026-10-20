/**
 * SchoolBook SMS - Frontend Type Definitions
 */

export * from '../../shared/types.js';

export type ActiveTab = 'overview' | 'portal' | 'members' | 'attendance' | 'inventory' | 'financials' | 'broadcast';

export interface RecentService {
  name: string;
  date: string;
  status: 'Closed' | 'Open';
}

export type RecentSession = RecentService;
