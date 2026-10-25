/**
 * SchoolBook SMS - Reactive Application State
 */

import { Tenant, MemberProfileSummary, Unit, ActiveTab } from './types.js';

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
  public unitsList: Unit[] = [];
  public unitLabels: Record<string, string> = {};

  public setUnits(units: Unit[]): void {
    this.unitsList = units;
    this.unitLabels = {};

    for (const unit of units) {
      this.unitLabels[unit.id] = unit.name;
    }
  }

  public getUnitLabel(unitId: string | null | undefined): string {
    if (!unitId) return 'No Class / Faculty Assigned';
    return this.unitLabels[unitId] || UNIT_LABELS[unitId] || 'Department / Faculty';
  }

  public isPrincipal(): boolean {
    return this.activeUser?.role === 'Principal';
  }

  public isLeader(): boolean {
    return this.isPrincipal();
  }

  public isFinanceStaff(): boolean {
    const position = (this.activeUser?.position || '').toLowerCase();
    const unit = this.getUnitLabel(this.activeUser?.unit_id).toLowerCase();

    return (
      position.includes('account') ||
      position.includes('bursar') ||
      position.includes('finance') ||
      unit.includes('finance') ||
      unit.includes('bursar') ||
      unit.includes('account')
    );
  }

  public isLibrarian(): boolean {
    const position = (this.activeUser?.position || '').toLowerCase();
    const unit = this.getUnitLabel(this.activeUser?.unit_id).toLowerCase();

    return (
      position.includes('librarian') ||
      position.includes('library') ||
      unit.includes('library') ||
      unit.includes('librarian')
    );
  }

  public isTeacherOrPrincipal(): boolean {
    if (this.isFinanceStaff() || this.isLibrarian()) return false;
    const role = this.activeUser?.role;
    return role === 'Teacher' || role === 'Principal' || role === 'Counselor';
  }

  public canViewPortal(): boolean {
    return !this.isFinanceStaff();
  }

  public canRegisterMembers(): boolean {
    // The API allows only administrators to create members.
    return this.isPrincipal();
  }

  public canAccessFinance(): boolean {
    return this.isPrincipal() || this.isFinanceStaff();
  }

  public canEditPortal(): boolean {
    return this.isTeacherOrPrincipal();
  }

  public canBrowsePortals(): boolean {
    return this.canEditPortal() || this.isLibrarian();
  }

  public canBroadcast(): boolean {
    return this.isTeacherOrPrincipal();
  }

  public isStudent(): boolean {
    return this.activeUser?.role === 'Student';
  }

  public isAuthorizedToEditInventory(): boolean {
    if (this.isFinanceStaff()) return false;
    return this.isTeacherOrPrincipal() || this.isLibrarian();
  }
}

export const state = new ApplicationState();
