/**
 * SchoolBook SMS - Reactive Application State
 */

import { Tenant, MemberProfileSummary, ActiveTab } from './types.js';

export const UNIT_LABELS: Record<string, string> = {
  'unit_oak_admin': "Principal's Office & Administration",
  'unit_oak_sciences': 'Faculty of Science & STEM',
  'unit_oak_humanities': 'Faculty of Humanities & Arts',
  'unit_oak_grade10': 'Grade 10 - Class A (Sophomores)',
  'unit_oak_grade11': 'Grade 11 - Class A (Juniors)',
  'unit_oak_counseling': 'Student Affairs & Counseling',
  'unit_oak_bursar': 'Bursar & Finance Office',
  'unit_oak_athletics': 'Athletics & Physical Education',
  'unit_maple_admin': "Headmaster's Office",
  'unit_maple_faculty': 'Teaching Faculty',
  'unit_maple_bursar': 'Accounts & Bursar Department',
};

class ApplicationState {
  public activeTenantId: string = '';
  public activeUserId: string = '';
  public activeUser: MemberProfileSummary | null = null;
  public activeTab: ActiveTab = 'overview';

  public tenantsList: Tenant[] = [];
  public profilesList: MemberProfileSummary[] = [];

  public getUnitLabel(unitId: string | null | undefined): string {
    if (!unitId) return 'No Class / Faculty Assigned';
    return UNIT_LABELS[unitId] || 'Department / Faculty';
  }

  public isPrincipal(): boolean {
    return this.activeUser?.role === 'Principal';
  }

  public isLeader(): boolean {
    return this.isPrincipal();
  }

  public isTeacherOrPrincipal(): boolean {
    const role = this.activeUser?.role;
    return role === 'Teacher' || role === 'Principal';
  }

  public canRegisterMembers(): boolean {
    const role = this.activeUser?.role;
    return role === 'Principal' || role === 'Counselor';
  }

  public canAccessFinance(): boolean {
    if (this.isPrincipal()) return true;
    const unitId = this.activeUser?.unit_id || '';
    return unitId.includes('finance') || unitId.includes('bursar');
  }

  public canEditPortal(): boolean {
    const role = this.activeUser?.role;
    return role === 'Teacher' || role === 'Principal';
  }

  public canBroadcast(): boolean {
    const role = this.activeUser?.role;
    return role === 'Teacher' || role === 'Principal' || role === 'Counselor';
  }

  public isStudent(): boolean {
    return this.activeUser?.role === 'Student';
  }

  public isAuthorizedToEditInventory(): boolean {
    if (this.isPrincipal()) return true;
    const unitId = this.activeUser?.unit_id || '';
    const isLabOrStaff = unitId.includes('science') || 
                         unitId.includes('stem') || 
                         unitId.includes('tech') || 
                         unitId.includes('athletic') || 
                         unitId.includes('library') ||
                         unitId.includes('humanities');
    return isLabOrStaff;
  }
}

export const state = new ApplicationState();
