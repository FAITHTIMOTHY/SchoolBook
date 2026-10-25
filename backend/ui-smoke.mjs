import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Headless Chrome smoke test for the real UI.
 *
 * Covers login, the seven workspaces, role-based tab visibility, silent token
 * refresh, and logout. Screenshots are written to backend/ui-screenshots.
 */

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3100';
const DEBUG_PORT = 9222;
const DEMO_PASSWORD = 'SchoolBookDemo!2026';
const screenshotDir = path.join(process.cwd(), 'ui-screenshots');

fs.mkdirSync(screenshotDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schoolbook-chrome-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*',
    '--window-size=1440,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let socket;
let nextId = 1;
const pending = new Map();
const events = [];
const allErrors = [];
let currentStep = 'boot';

function recordError(type, text) {
  const entry = { step: currentStep, type, text: String(text || '').trim() };
  events.push(entry);
  allErrors.push(entry);
}

function handleEvent(message) {
  if (message.id) {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
    return;
  }

  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    recordError(
      'exception',
      details?.exception?.description || details?.text || 'Unknown exception',
    );
  }

  if (
    message.method === 'Runtime.consoleAPICalled' &&
    message.params.type === 'error'
  ) {
    recordError(
      'console.error',
      message.params.args
        .map((arg) => arg.value ?? arg.description ?? '')
        .join(' '),
    );
  }

  if (
    message.method === 'Log.entryAdded' &&
    message.params.entry.level === 'error'
  ) {
    recordError('log.error', message.params.entry.text);
  }
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        'Evaluation failed',
    );
  }

  return result.result.value;
}

async function safeEvaluate(expression, fallback = undefined) {
  try {
    return await evaluate(expression);
  } catch {
    return fallback;
  }
}

async function waitFor(predicate, timeoutMs, label) {
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }

  throw new Error(
    `Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`,
  );
}

async function waitForPath(pathname, timeoutMs = 25000) {
  return waitFor(
    async () => (await safeEvaluate('location.pathname')) === pathname,
    timeoutMs,
    `path ${pathname}`,
  );
}

async function waitForSelector(selector, timeoutMs = 20000) {
  return waitFor(
    async () =>
      Boolean(
        await safeEvaluate(
          `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
        ),
      ),
    timeoutMs,
    `selector ${selector}`,
  );
}

async function waitForCount(selector, timeoutMs = 20000) {
  return waitFor(
    async () =>
      (await safeEvaluate(
        `document.querySelectorAll(${JSON.stringify(selector)}).length`,
      )) > 0,
    timeoutMs,
    `rows/cards in ${selector}`,
  );
}

async function navigate(pathname) {
  await send('Page.navigate', { url: `${BASE}${pathname}` });
  await waitFor(
    async () => (await safeEvaluate('document.readyState')) === 'complete',
    20000,
    `load ${pathname}`,
  );
  await sleep(350);
}

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(screenshotDir, name), Buffer.from(data, 'base64'));
}

async function textOf(selector) {
  return safeEvaluate(
    `document.querySelector(${JSON.stringify(selector)})?.textContent?.trim() || ''`,
    '',
  );
}

async function isTabVisible(tab) {
  return safeEvaluate(
    `(() => {
      const button = document.querySelector('.nav-btn[data-tab="${tab}"]');
      return Boolean(button) && getComputedStyle(button).display !== 'none';
    })()`,
    false,
  );
}

async function clickTab(tab) {
  await evaluate(
    `document.querySelector('.nav-btn[data-tab="${tab}"]').click()`,
  );
  await sleep(500);
}

async function login(email) {
  await navigate('/login');
  await waitForSelector('#login-form');

  await evaluate(`(() => {
    const setValue = (id, value) => {
      const element = document.getElementById(id);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };

    setValue('tenant-slug', 'schoolbook');
    setValue('email', ${JSON.stringify(email)});
    setValue('password', ${JSON.stringify(DEMO_PASSWORD)});
    document.getElementById('login-form').requestSubmit();
    return true;
  })()`);

  await waitForPath('/app');
  await waitFor(
    async () => {
      const name = await textOf('#current-user-name');
      return name && !name.includes('Loading');
    },
    25000,
    `signed-in chrome for ${email}`,
  );
  await sleep(600);
}

async function logout() {
  await evaluate(`document.getElementById('btn-logout').click()`);
  await waitForPath('/login');
  await waitForSelector('#login-form');
  await sleep(300);
}

async function clearErrors() {
  events.length = 0;
}

function printErrors(label) {
  const relevant = events.filter((entry) => {
    if (
      entry.text.includes('401 (Unauthorized)') ||
      entry.text.includes('status of 401')
    ) {
      return false;
    }
    if (entry.text.includes('favicon')) return false;
    return true;
  });

  if (relevant.length === 0) {
    console.log(`  ${label}: no JS errors`);
    return;
  }

  console.log(`  ${label}: ${relevant.length} error(s)`);
  for (const entry of relevant.slice(0, 12)) {
    console.log(`    [${entry.step}] ${entry.type}: ${entry.text.slice(0, 300)}`);
  }
}

try {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${DEBUG_PORT}/json/version`,
      );
      if (response.ok) break;
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }

  const targets = await (
    await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
  ).json();
  let target = targets.find((item) => item.type === 'page');

  if (!target) {
    target = await (
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, {
        method: 'PUT',
      })
    ).json();
  }

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  socket.onmessage = (event) => handleEvent(JSON.parse(event.data));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // -------------------------------------------------------------------
  // Login page
  // -------------------------------------------------------------------
  currentStep = 'login-page';
  await navigate('/login');
  await waitForSelector('#login-form');
  const loginTitle = await textOf('h2');
  const googleHidden = await safeEvaluate(
    `document.getElementById('google-section')?.hidden`,
    true,
  );
  const providerText = await safeEvaluate(
    `fetch('/api/auth/providers').then((r) => r.json()).then((d) => JSON.stringify(d))`,
    '',
  );

  console.log(`LOGIN PAGE title="${loginTitle}" googleHidden=${googleHidden}`);
  console.log(`  providers=${providerText}`);
  await screenshot('01-login.png');
  printErrors('login-page');

  // -------------------------------------------------------------------
  // Principal: all workspaces
  // -------------------------------------------------------------------
  currentStep = 'principal';
  clearErrors();
  await login('principal@schoolbook.test');
  const principalName = await textOf('#current-user-name');
  const principalRole = await textOf('#current-user-badge');
  const campus = await textOf('#topbar-tenant-name');
  const visibleTabs = {};
  for (const tab of [
    'overview',
    'portal',
    'members',
    'attendance',
    'inventory',
    'financials',
    'broadcast',
  ]) {
    visibleTabs[tab] = await isTabVisible(tab);
  }
  console.log(
    `PRINCIPAL name="${principalName}" role="${principalRole}" campus="${campus}"`,
  );
  console.log(`  tabs=${JSON.stringify(visibleTabs)}`);

  await waitForCount('#overview-services-tbody tr');
  await screenshot('02-principal-dashboard.png');

  await clickTab('portal');
  await waitForCount('#portal-grades-tbody tr');
  const portalStudent = await textOf('#portal-student-name');
  const portalGrades = await safeEvaluate(
    `document.querySelectorAll('#portal-grades-tbody tr').length`,
    0,
  );
  console.log(`  portal student="${portalStudent}" grades=${portalGrades}`);
  await screenshot('03-principal-portal.png');

  await clickTab('members');
  await waitForCount('#members-list-tbody tr');
  const memberRows = await safeEvaluate(
    `document.querySelectorAll('#members-list-tbody tr').length`,
    0,
  );
  console.log(`  members rows=${memberRows}`);
  await screenshot('04-principal-members.png');

  // -------------------------------------------------------------------
  // Admin onboarding: create a linked student, guardian, and staff login.
  // -------------------------------------------------------------------
  currentStep = 'onboarding';
  clearErrors();
  const onboardingSuffix = Date.now();
  const onboardingStudentEmail = `onboard.ui.student.${onboardingSuffix}@schoolbook.test`;
  const onboardingGuardianEmail = `onboard.ui.guardian.${onboardingSuffix}@schoolbook.test`;
  const onboardingStaffEmail = `onboard.ui.staff.${onboardingSuffix}@schoolbook.test`;

  const onboardingRecords = await evaluate(`(async () => {
    const units = await fetch('/api/units').then((r) => r.json());
    const unitId = Array.isArray(units) && units[0] ? units[0].id : null;
    const create = async (body) => {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || JSON.stringify(payload));
      return payload;
    };

    const student = await create({
      name: 'Onboard UI Student',
      role: 'Student',
      email: ${JSON.stringify(onboardingStudentEmail)},
      guardian_name: 'Onboard UI Guardian',
      guardian_email: ${JSON.stringify(onboardingGuardianEmail)},
      guardian_phone: '+1 555 0199',
      unit_id: unitId,
    });

    const staff = await create({
      name: 'Onboard UI Staff',
      role: 'Teacher',
      email: ${JSON.stringify(onboardingStaffEmail)},
      position: 'Teacher',
      unit_id: unitId,
    });

    return { student, staff };
  })()`);

  if (!onboardingRecords?.student?.id || !onboardingRecords?.staff?.id) {
    throw new Error('Failed to create onboarding test profiles.');
  }

  await evaluate(`window.__smokeAlerts = []; window.alert = (message) => window.__smokeAlerts.push(String(message));`);

  // Student login through the profile access panel.
  await evaluate(`window.viewMemberDetail(${JSON.stringify(onboardingRecords.student.id)})`);
  await waitForSelector('#profile-detail-modal.active');
  await evaluate(`document.querySelector('#det-custom-attributes button[onclick*="openAccessModal"]').click()`);
  await waitForSelector('#access-modal.active');
  const onboardingStudentPrefill = await evaluate(`({
    email: document.getElementById('access-email').value,
    role: document.getElementById('access-role').value,
    passwordLength: document.getElementById('access-password').value.length,
  })`);
  await screenshot('14-onboarding-modal.png');
  await evaluate(`document.getElementById('access-form').requestSubmit()`);
  await waitFor(
    async () => (await safeEvaluate(`window.__smokeAlerts.some((m) => m.includes('Login created'))`, false)),
    20000,
    'student login creation',
  );
  await waitFor(
    async () => !(await safeEvaluate(`document.getElementById('access-modal').classList.contains('active')`, false)),
    20000,
    'access modal close',
  );
  const studentAfterLogin = await evaluate(`fetch('/api/members/${onboardingRecords.student.id}').then((r) => r.json())`);
  if (!studentAfterLogin.user_id) throw new Error('Student login was not linked to the student profile.');

  // Guardian login through the same access flow.
  await evaluate(`window.viewMemberDetail(${JSON.stringify(onboardingRecords.student.id)})`);
  await waitForSelector('#profile-detail-modal.active');
  await evaluate(`window.openAccessModal(${JSON.stringify(onboardingRecords.student.guardian_id)}, 'guardian', ${JSON.stringify(onboardingRecords.student.id)})`);
  await waitForSelector('#access-modal.active');
  const onboardingGuardianPrefill = await evaluate(`({
    email: document.getElementById('access-email').value,
    role: document.getElementById('access-role').value,
  })`);
  await evaluate(`document.getElementById('access-form').requestSubmit()`);
  await waitFor(
    async () => (await safeEvaluate(`window.__smokeAlerts.filter((m) => m.includes('Login created')).length >= 2`, false)),
    20000,
    'guardian login creation',
  );
  await waitFor(
    async () => !(await safeEvaluate(`document.getElementById('access-modal').classList.contains('active')`, false)),
    20000,
    'guardian access modal close',
  );
  const studentAfterGuardian = await evaluate(`fetch('/api/members/${onboardingRecords.student.id}').then((r) => r.json())`);
  if (!studentAfterGuardian.guardian_user_id) throw new Error('Guardian login was not linked to the student profile.');

  // Staff login through the profile access panel.
  await evaluate(`window.viewMemberDetail(${JSON.stringify(onboardingRecords.staff.id)})`);
  await waitForSelector('#profile-detail-modal.active');
  await evaluate(`document.querySelector('#det-custom-attributes button[onclick*="openAccessModal"]').click()`);
  await waitForSelector('#access-modal.active');
  const onboardingStaffPrefill = await evaluate(`({
    email: document.getElementById('access-email').value,
    role: document.getElementById('access-role').value,
    options: Array.from(document.getElementById('access-role').options).map((o) => o.value),
  })`);
  await evaluate(`document.getElementById('access-form').requestSubmit()`);
  await waitFor(
    async () => (await safeEvaluate(`window.__smokeAlerts.filter((m) => m.includes('Login created')).length >= 3`, false)),
    20000,
    'staff login creation',
  );
  await waitFor(
    async () => !(await safeEvaluate(`document.getElementById('access-modal').classList.contains('active')`, false)),
    20000,
    'staff access modal close',
  );
  const staffAfterLogin = await evaluate(`fetch('/api/members/${onboardingRecords.staff.id}').then((r) => r.json())`);
  if (!staffAfterLogin.user_id) throw new Error('Staff login was not linked to the staff profile.');

  fs.writeFileSync(
    path.join(process.cwd(), 'onboarding-ui-test.json'),
    JSON.stringify(
      {
        studentId: onboardingRecords.student.id,
        guardianId: onboardingRecords.student.guardian_id,
        staffId: onboardingRecords.staff.id,
        studentEmail: onboardingStudentEmail,
        guardianEmail: onboardingGuardianEmail,
        staffEmail: onboardingStaffEmail,
      },
      null,
      2,
    ),
  );

  console.log(
    `ONBOARDING student=${onboardingStudentPrefill.email}/${onboardingStudentPrefill.role}/pw${onboardingStudentPrefill.passwordLength} guardian=${onboardingGuardianPrefill.email}/${onboardingGuardianPrefill.role} staff=${onboardingStaffPrefill.email}/${onboardingStaffPrefill.role} options=${onboardingStaffPrefill.options.join(',')}`,
  );
  await evaluate(`document.getElementById('access-modal')?.classList.remove('active'); document.getElementById('profile-detail-modal')?.classList.remove('active');`);
  printErrors('onboarding');

  await clickTab('attendance');
  await waitForCount('#attendance-sheet-tbody tr');
  await waitForCount('#workers-performance-tbody tr');
  const attendanceRows = await safeEvaluate(
    `document.querySelectorAll('#attendance-sheet-tbody tr').length`,
    0,
  );
  const attendanceAvg = await textOf('#kpi-attendance-avg');
  console.log(`  attendance rows=${attendanceRows} avg="${attendanceAvg}"`);
  await screenshot('05-principal-attendance.png');

  await clickTab('inventory');
  await waitForCount('#inventory-items-grid > *');
  const inventoryCards = await safeEvaluate(
    `document.querySelectorAll('#inventory-items-grid > *').length`,
    0,
  );
  console.log(`  inventory cards=${inventoryCards}`);
  await screenshot('06-principal-inventory.png');

  await clickTab('financials');
  await waitForCount('#finance-ledger-tbody tr');
  const financeRows = await safeEvaluate(
    `document.querySelectorAll('#finance-ledger-tbody tr').length`,
    0,
  );
  const financeTotal = await textOf('#kpi-finance-totals');
  console.log(`  finance rows=${financeRows} total="${financeTotal}"`);
  await screenshot('07-principal-financials.png');

  await clickTab('broadcast');
  await waitForCount('#broadcast-feed-container > *');
  const broadcastCards = await safeEvaluate(
    `document.querySelectorAll('#broadcast-feed-container > *').length`,
    0,
  );
  console.log(`  broadcast cards=${broadcastCards}`);
  await screenshot('08-principal-broadcast.png');

  printErrors('principal');

  // -------------------------------------------------------------------
  // Silent refresh: remove only the access cookie, then use a tab.
  // -------------------------------------------------------------------
  currentStep = 'refresh-test';
  clearErrors();
  await clickTab('members');
  await waitForCount('#members-list-tbody tr');

  const cookies = await send('Network.getCookies', {
    urls: [`${BASE}/app`],
  });
  const accessCookie = cookies.cookies.find(
    (cookie) => cookie.name === 'schoolbook_access_token',
  );
  if (accessCookie) {
    await send('Network.deleteCookies', {
      name: 'schoolbook_access_token',
      domain: accessCookie.domain,
      path: accessCookie.path,
    });
  }

  await clickTab('overview');
  await clickTab('members');
  await waitForCount('#members-list-tbody tr');
  const stillOnApp = await safeEvaluate('location.pathname', '');
  console.log(
    `REFRESH TEST accessCookie=${Boolean(accessCookie)} path=${stillOnApp} rows=${await safeEvaluate(
      `document.querySelectorAll('#members-list-tbody tr').length`,
      0,
    )}`,
  );
  printErrors('refresh-test');

  // -------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------
  currentStep = 'logout';
  clearErrors();
  await logout();
  console.log(`LOGOUT path=${await safeEvaluate('location.pathname', '')}`);

  // -------------------------------------------------------------------
  // Bursar: finance, no attendance/portal
  // -------------------------------------------------------------------
  currentStep = 'bursar';
  clearErrors();
  await login('bursar@schoolbook.test');
  const bursarTabs = {};
  for (const tab of [
    'portal',
    'members',
    'attendance',
    'inventory',
    'financials',
    'broadcast',
  ]) {
    bursarTabs[tab] = await isTabVisible(tab);
  }
  console.log(`BURSAR tabs=${JSON.stringify(bursarTabs)}`);
  await clickTab('financials');
  await waitForCount('#finance-ledger-tbody tr');
  await screenshot('09-bursar-financials.png');
  printErrors('bursar');
  await logout();

  // -------------------------------------------------------------------
  // Student: own portal only
  // -------------------------------------------------------------------
  currentStep = 'student';
  clearErrors();
  await login('student001@schoolbook.test');
  const studentTabs = {};
  for (const tab of [
    'portal',
    'members',
    'attendance',
    'inventory',
    'financials',
    'broadcast',
  ]) {
    studentTabs[tab] = await isTabVisible(tab);
  }
  console.log(`STUDENT tabs=${JSON.stringify(studentTabs)}`);
  await clickTab('portal');
  await waitForCount('#portal-grades-tbody tr');
  const studentPortalName = await textOf('#portal-student-name');
  console.log(`  student portal="${studentPortalName}"`);
  await screenshot('10-student-portal.png');
  printErrors('student');
  await logout();

  // -------------------------------------------------------------------
  // Guardian: linked child portal
  // -------------------------------------------------------------------
  currentStep = 'guardian';
  clearErrors();
  await login('guardian001@schoolbook.test');
  const guardianTabs = {};
  for (const tab of ['portal', 'members', 'financials']) {
    guardianTabs[tab] = await isTabVisible(tab);
  }
  console.log(`GUARDIAN tabs=${JSON.stringify(guardianTabs)}`);
  await clickTab('portal');
  await waitForCount('#portal-grades-tbody tr');
  const guardianPortalName = await textOf('#portal-student-name');
  console.log(`  guardian portal="${guardianPortalName}"`);
  await screenshot('11-guardian-portal.png');
  printErrors('guardian');
  await logout();

  // -------------------------------------------------------------------
  // Teacher: teaching workspaces, no finance vault
  // -------------------------------------------------------------------
  currentStep = 'teacher';
  clearErrors();
  await login('teacher@schoolbook.test');
  const teacherTabs = {};
  for (const tab of [
    'portal',
    'members',
    'attendance',
    'inventory',
    'financials',
    'broadcast',
  ]) {
    teacherTabs[tab] = await isTabVisible(tab);
  }
  console.log(`TEACHER tabs=${JSON.stringify(teacherTabs)}`);
  await clickTab('attendance');
  await waitForCount('#attendance-sheet-tbody tr');
  await screenshot('15-teacher-attendance.png');
  await clickTab('inventory');
  await waitForCount('#inventory-items-grid > *');
  printErrors('teacher');
  await logout();

  // -------------------------------------------------------------------
  // Librarian: read-only portal and inventory access
  // -------------------------------------------------------------------
  currentStep = 'librarian';
  clearErrors();
  await login('librarian@schoolbook.test');
  const librarianTabs = {};
  for (const tab of [
    'portal',
    'members',
    'attendance',
    'inventory',
    'financials',
    'broadcast',
  ]) {
    librarianTabs[tab] = await isTabVisible(tab);
  }
  console.log(`LIBRARIAN tabs=${JSON.stringify(librarianTabs)}`);
  await clickTab('portal');
  await waitForCount('#portal-grades-tbody tr');
  const librarianBanner = await safeEvaluate(
    `getComputedStyle(document.getElementById('portal-readonly-banner')).display`,
    '',
  );
  console.log(`  librarian portal read-only banner=${librarianBanner}`);
  await screenshot('16-librarian-portal.png');
  await clickTab('inventory');
  await waitForCount('#inventory-items-grid > *');
  printErrors('librarian');
  await logout();

  // -------------------------------------------------------------------
  // Reset and verification pages without tokens
  // -------------------------------------------------------------------
  currentStep = 'reset-page';
  clearErrors();
  await navigate('/reset-password');
  await waitForSelector('#reset-form');
  const resetAlert = await textOf('#reset-alert-text');
  console.log(`RESET PAGE alert="${resetAlert}"`);
  await screenshot('12-reset-password.png');
  printErrors('reset-page');

  currentStep = 'verify-page';
  clearErrors();
  await navigate('/verify-email');
  await waitForSelector('#status-title');
  await sleep(800);
  const verifyTitle = await textOf('#status-title');
  console.log(`VERIFY PAGE title="${verifyTitle}"`);
  await screenshot('13-verify-email.png');
  printErrors('verify-page');

  const unexpectedErrors = allErrors.filter(
    (entry) =>
      !entry.text.includes('status of 401') &&
      !entry.text.includes('401 (Unauthorized)') &&
      !entry.text.includes('favicon'),
  );

  console.log('');
  if (unexpectedErrors.length === 0) {
    console.log('UI SMOKE PASS — no unexpected JavaScript errors.');
  } else {
    console.log(
      `UI SMOKE ERRORS — ${unexpectedErrors.length} unexpected error(s).`,
    );
    for (const entry of unexpectedErrors.slice(0, 30)) {
      console.log(
        `  [${entry.step}] ${entry.type}: ${entry.text.slice(0, 400)}`,
      );
    }
    process.exitCode = 1;
  }
} catch (error) {
  console.error('');
  console.error('UI SMOKE FAILED:', error.message);
  console.error('Last step:', currentStep);
  const relevant = allErrors.filter(
    (entry) =>
      !entry.text.includes('status of 401') &&
      !entry.text.includes('401 (Unauthorized)'),
  );
  for (const entry of relevant.slice(0, 20)) {
    console.log(`  [${entry.step}] ${entry.type}: ${entry.text.slice(0, 400)}`);
  }
  process.exitCode = 1;
} finally {
  try {
    socket?.close();
  } catch {
    // ignore
  }

  try {
    chrome.kill();
  } catch {
    // ignore
  }

  await sleep(500);

  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
