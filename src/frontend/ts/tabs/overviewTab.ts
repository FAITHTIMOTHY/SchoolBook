/**
 * SchoolBook SMS - Overview Dashboard & Visual Statistics Controller
 * STRICT REQUIREMENT:
 * "Statistics: Performance, Attendance, Financial, using graphs, charts and bars."
 * "-For Identification, academic performances will have a green, yellow and red circle, green for performamces greater than 70, yellow for between 69-50, and red for the rest."
 */

import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { escapeHtml } from '../html.js';
import {
  Member,
  FinancialProjections,
  AttendanceStatsResponse,
  RecentService,
  StudentPortal,
} from '../types.js';

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatMoney(value: number): string {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function loadOverviewData(): Promise<void> {
  const welcome = document.getElementById('overview-welcome');
  if (welcome) {
    welcome.textContent = `Active academic context: ${state.activeUser?.name || 'Loading'} (${state.activeUser?.position || ''})`;
  }

  // 1. Campus membership is the one dataset every signed-in account can read.
  let members: Member[] = [];
  try {
    members = await apiFetch<Member[]>('/api/members');
  } catch (error) {
    console.error('Failed loading member overview:', error);
    setText('overview-welcome', 'Campus overview is temporarily unavailable.');
    return;
  }

  const students = members.filter((member) => member.role === 'Student');
  const total = students.length;
  const active = students.filter(
    (student) => student.status === 'Active',
  ).length;
  const activeRatio = total > 0 ? Math.round((active / total) * 100) : 0;

  setText('kpi-total-members', String(total));
  setText('kpi-active-members', String(active));
  setText('overview-active-ratio', `${activeRatio}%`);

  // 2. Each card degrades independently. A restricted or temporarily failing
  // endpoint must not blank the whole dashboard.
  await Promise.allSettled([loadFinanceCard(), loadAttendanceCard()]);

  // 3. Subject averages come from published portal grades, never from a
  // hard-coded demo list.
  const subjectResult = await loadSubjectAverages();
  renderPerformanceStatistics(
    members,
    subjectResult.averages,
    subjectResult.message,
  );
}

async function loadFinanceCard(): Promise<void> {
  if (!state.canAccessFinance()) {
    setText('kpi-finance-totals', 'Restricted');
    setText('overview-finance-forecast', 'Restricted');
    setText(
      'overview-projection-status',
      'Vault Locked (Principal/Bursar Only)',
    );
    renderFinancialBars(null);
    return;
  }

  try {
    const financeData = await apiFetch<FinancialProjections>(
      '/api/financials/projections',
    );

    setText('kpi-finance-totals', formatMoney(financeData.summary.Total));
    setText(
      'overview-finance-forecast',
      formatMoney(financeData.projectedNextWeek),
    );
    setText(
      'overview-projection-status',
      `Avg Weekly Fee Flow: ${financeData.growthRatePercent}%`,
    );

    renderFinancialBars(financeData.summary);
  } catch (error) {
    console.error('Failed loading finance overview:', error);
    setText('kpi-finance-totals', 'Unavailable');
    setText('overview-finance-forecast', 'Unavailable');
    setText(
      'overview-projection-status',
      'Finance data temporarily unavailable',
    );
    renderFinancialBars(
      null,
      'Finance data is temporarily unavailable. Try again shortly.',
    );
  }
}

async function loadAttendanceCard(): Promise<void> {
  if (!state.isTeacherOrPrincipal()) {
    setText('kpi-attendance-avg', 'Restricted');
    renderAttendanceTrendChart(
      [],
      'Attendance insights are restricted to academic staff.',
    );
    renderRecentServices(
      [],
      'Attendance registers are restricted to academic staff.',
    );
    return;
  }

  try {
    const stats = await apiFetch<AttendanceStatsResponse>(
      '/api/attendance/stats',
    );

    setText('kpi-attendance-avg', `${stats.avgAttendanceRate}%`);
    renderAttendanceTrendChart(stats.recentServices);
    renderRecentServices(stats.recentServices);
  } catch (error) {
    console.error('Failed loading attendance overview:', error);
    setText('kpi-attendance-avg', 'Unavailable');
    renderAttendanceTrendChart(
      [],
      'Attendance data is temporarily unavailable.',
    );
    renderRecentServices([], 'Attendance data is temporarily unavailable.');
  }
}

async function loadSubjectAverages(): Promise<{
  averages: Array<{ name: string; score: number }>;
  message: string;
}> {
  if (state.isFinanceStaff()) {
    return {
      averages: [],
      message: 'Subject breakdown is available to academic staff.',
    };
  }

  try {
    const portals = await apiFetch<StudentPortal[]>('/api/portal');

    if (!Array.isArray(portals) || portals.length === 0) {
      return { averages: [], message: 'No published grades yet.' };
    }

    const totals = new Map<string, { total: number; count: number }>();

    for (const portal of portals) {
      const grades = Array.isArray(portal.grades) ? portal.grades : [];

      for (const grade of grades) {
        if (
          !grade ||
          typeof grade.subject !== 'string' ||
          typeof grade.score !== 'number' ||
          !Number.isFinite(grade.score)
        ) {
          continue;
        }

        const current = totals.get(grade.subject) ?? { total: 0, count: 0 };
        current.total += grade.score;
        current.count += 1;
        totals.set(grade.subject, current);
      }
    }

    const averages = [...totals.entries()]
      .map(([name, value]) => ({
        name,
        score:
          value.count > 0 ? Math.round(value.total / value.count) : 0,
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    return {
      averages,
      message: averages.length > 0 ? '' : 'No published grades yet.',
    };
  } catch (error) {
    console.error('Failed loading subject overview:', error);
    return {
      averages: [],
      message: 'Subject breakdown is temporarily unavailable.',
    };
  }
}

/**
 * 1. Render Academic Performance Statistics using Graphs, Charts, and Bars
 * Identification Rules:
 * Green circle: > 70%
 * Yellow circle: 50% - 69%
 * Red circle: < 50%
 */
function renderPerformanceStatistics(
  members: Member[],
  subjectAverages: Array<{ name: string; score: number }>,
  subjectMessage: string,
): void {
  const students = members.filter((member) => member.role === 'Student');
  const scored = students.filter(
    (student) =>
      typeof student.academic_score === 'number' &&
      Number.isFinite(student.academic_score),
  );
  const total = scored.length;

  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;

  for (const student of scored) {
    const score = student.academic_score as number;
    if (score > 70) greenCount += 1;
    else if (score >= 50) yellowCount += 1;
    else redCount += 1;
  }

  const greenPct = total > 0 ? Math.round((greenCount / total) * 100) : 0;
  const yellowPct = total > 0 ? Math.round((yellowCount / total) * 100) : 0;
  const redPct = total > 0 ? Math.max(0, 100 - greenPct - yellowPct) : 0;

  // Update Stacked Distribution Bar
  const elBarGreen = document.getElementById('stat-bar-green');
  const elBarYellow = document.getElementById('stat-bar-yellow');
  const elBarRed = document.getElementById('stat-bar-red');

  if (elBarGreen) {
    elBarGreen.style.width = `${greenPct}%`;
    elBarGreen.title = `Green Tier (>70%): ${greenCount} Students (${greenPct}%)`;
  }
  if (elBarYellow) {
    elBarYellow.style.width = `${yellowPct}%`;
    elBarYellow.title = `Yellow Tier (50-69%): ${yellowCount} Students (${yellowPct}%)`;
  }
  if (elBarRed) {
    elBarRed.style.width = `${redPct}%`;
    elBarRed.title = `Red Tier (<50%): ${redCount} Students (${redPct}%)`;
  }

  // Update Count Labels
  const elGreenCount = document.getElementById('stat-count-green');
  const elYellowCount = document.getElementById('stat-count-yellow');
  const elRedCount = document.getElementById('stat-count-red');

  if (elGreenCount) {
    elGreenCount.innerHTML = `<span class="perf-circle perf-green"></span> <strong>${greenCount}</strong> (${greenPct}%)`;
  }
  if (elYellowCount) {
    elYellowCount.innerHTML = `<span class="perf-circle perf-yellow"></span> <strong>${yellowCount}</strong> (${yellowPct}%)`;
  }
  if (elRedCount) {
    elRedCount.innerHTML = `<span class="perf-circle perf-red"></span> <strong>${redCount}</strong> (${redPct}%)`;
  }

  // Render Subject Average Bars from published portal grades.
  const subjectBarsContainer = document.getElementById('stat-subject-bars');
  if (subjectBarsContainer) {
    if (subjectAverages.length === 0) {
      subjectBarsContainer.innerHTML = `
        <div class="p-2 text-center text-muted" style="font-size:0.85rem">
          ${escapeHtml(subjectMessage || 'No published grades yet.')}
        </div>
      `;
    } else {
      subjectBarsContainer.innerHTML = subjectAverages
        .map((subject) => {
          const score = Math.max(0, Math.min(100, subject.score));
          const color =
            score > 70
              ? '#2f9e44'
              : score >= 50
                ? '#f08c00'
                : '#e03131';

          return `
            <div class="subject-bar-row">
              <div class="subject-bar-meta">
                <span class="subject-title">${escapeHtml(subject.name)}</span>
                <span class="subject-val"><strong>${score}%</strong></span>
              </div>
              <div class="stat-progress-track">
                <div class="stat-progress-fill" style="width: ${score}%; background: ${color};"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }
}

/**
 * 2. Render Attendance Statistics using a 5-day trend bar chart.
 */
function renderAttendanceTrendChart(
  services: RecentService[],
  emptyMessage = 'No attendance sessions recorded yet.',
): void {
  const chartContainer = document.getElementById('stat-attendance-chart');
  if (!chartContainer) return;

  if (!services || services.length === 0) {
    chartContainer.innerHTML = `
      <div class="p-2 text-center text-muted" style="font-size:0.85rem">
        ${escapeHtml(emptyMessage)}
      </div>
    `;
    return;
  }

  const chronological = [...services].slice(0, 5).reverse();

  chartContainer.innerHTML = chronological
    .map((service) => {
      const rate = Math.max(0, Math.min(100, Number(service.rate) || 0));
      const date = new Date(`${service.date}T00:00:00.000Z`);
      const day = Number.isNaN(date.getTime())
        ? service.date
        : date.toLocaleDateString(undefined, { weekday: 'short' });

      return `
        <div class="chart-vertical-col" title="${escapeHtml(service.date)} · ${escapeHtml(service.name)}: ${service.present}/${service.total} present">
          <span class="chart-bar-val">${rate}%</span>
          <div class="chart-bar-pillar-wrap">
            <div class="chart-bar-pillar" style="height: ${Math.max(2, rate)}%; background: var(--notion-blue);"></div>
          </div>
          <span class="chart-bar-day">${escapeHtml(day)}</span>
        </div>
      `;
    })
    .join('');
}

function renderRecentServices(
  services: RecentService[],
  emptyMessage = 'No attendance sessions recorded yet.',
): void {
  const tbody = document.getElementById('overview-services-tbody');
  if (!tbody) return;

  if (!services || services.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted">${escapeHtml(emptyMessage)}</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = services
    .map((service) => {
      const isOpen = service.status === 'Open';

      return `
        <tr>
          <td><strong>${escapeHtml(service.name)}</strong></td>
          <td>${escapeHtml(service.date)}</td>
          <td>${service.present}/${service.total} <span class="text-muted">(${service.rate}%)</span></td>
          <td><span class="notion-tag ${isOpen ? 'tag-blue' : 'tag-green'}">${isOpen ? '● Open' : '✓ Closed'}</span></td>
        </tr>
      `;
    })
    .join('');
}

/**
 * 3. Render Financial Fee Statistics using Category Progress Bars.
 *
 * Bars are scaled to the share of total collected revenue. There are no
 * invented budget targets: every number comes from the ledger.
 */
function renderFinancialBars(
  summary: FinancialProjections['summary'] | null,
  emptyMessage = 'Financial fee breakdown is restricted to the Principal and Bursar.',
): void {
  const container = document.getElementById('stat-financial-bars');
  if (!container) return;

  if (!summary) {
    container.innerHTML = `
      <div class="p-2 text-center text-muted" style="font-size:0.85rem">
        ${escapeHtml(emptyMessage)}
      </div>
    `;
    return;
  }

  const total = Number(summary.Total) || 0;

  if (total <= 0) {
    container.innerHTML = `
      <div class="p-2 text-center text-muted" style="font-size:0.85rem">
        No payments have been recorded for this campus yet.
      </div>
    `;
    return;
  }

  const categories = [
    { name: 'Tuition Fees', collected: summary.Tuition },
    { name: 'Lab & Library Fees', collected: summary['Lab & Library Fees'] },
    {
      name: 'PTA & Extracurricular',
      collected: summary['PTA & Extracurricular'],
    },
    { name: 'Alumni Endowment / Gifts', collected: summary.Donations },
  ];

  container.innerHTML = categories
    .map((category) => {
      const share = Math.max(
        0,
        Math.min(100, Math.round((category.collected / total) * 100)),
      );

      return `
        <div class="financial-bar-row">
          <div class="financial-bar-meta">
            <span class="fin-cat-name">${escapeHtml(category.name)}</span>
            <span class="fin-cat-amt">$${category.collected.toLocaleString()} <span class="text-muted">(${share}% of collected)</span></span>
          </div>
          <div class="stat-progress-track">
            <div class="stat-progress-fill" style="width: ${share}%; background: var(--notion-blue);"></div>
          </div>
        </div>
      `;
    })
    .join('');
}
