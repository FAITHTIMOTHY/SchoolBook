import express from 'express';
// SchoolBook SMS server
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDB, collections } from './db/db.js';
import { tenantMiddleware } from './middleware/tenant.js';

// Route imports
import membersRouter from './routes/members.js';
import attendanceRouter from './routes/attendance.js';
import inventoryRouter from './routes/inventory.js';
import financialsRouter from './routes/financials.js';
import messagingRouter from './routes/messaging.js';
import unitsRouter from './routes/units.js';
import portalRouter from './routes/portal.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Resolve ES modules file paths for static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

// Load database from file
loadDB();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Serve landing page at / and /landing
app.get(['/', '/landing'], (req, res) => {
  res.sendFile(path.join(projectRoot, 'src/frontend/landing.html'));
});

// Serve main workspace SIS at /app and /dashboard
app.get(['/app', '/dashboard'], (req, res) => {
  res.sendFile(path.join(projectRoot, 'src/frontend/index.html'));
});

// Serve static frontend assets (css, js, images) without defaulting index
app.use(express.static(path.join(projectRoot, 'src/frontend'), { index: false }));

// Helper API: Endpoint to fetch available tenants (used by frontend client-switcher)
app.get('/api/tenants', (req, res) => {
  const tenants = collections.getTenants();
  return res.json(tenants);
});

// Helper API: Endpoint to fetch all members globally (so the dashboard switcher can load user profiles easily)
app.get('/api/auth/profiles', (req, res) => {
  const { tenantId } = req.query;
  let members = collections.getMembers();
  if (tenantId) {
    members = members.filter(m => m.tenant_id === tenantId);
  }
  return res.json(members.map(m => ({
    id: m.id,
    name: m.name,
    role: m.role,
    position: m.position,
    tenant_id: m.tenant_id,
    profile_picture_url: m.profile_picture_url,
    unit_id: m.unit_id,
    academic_score: m.academic_score,
  })));
});

// Mount modular routers under multi-tenancy enforcement middleware
app.use('/api/members', tenantMiddleware, membersRouter);
app.use('/api/attendance', tenantMiddleware, attendanceRouter);
app.use('/api/inventory', tenantMiddleware, inventoryRouter);
app.use('/api/financials', tenantMiddleware, financialsRouter);
app.use('/api/messaging', tenantMiddleware, messagingRouter);
app.use('/api/units', tenantMiddleware, unitsRouter);
app.use('/api/portal', tenantMiddleware, portalRouter);

// Fallback path: route /app/* to workspace dashboard, others to landing page
app.get('*', (req, res) => {
  if (req.path.startsWith('/app') || req.path.startsWith('/dashboard')) {
    return res.sendFile(path.join(projectRoot, 'src/frontend/index.html'));
  }
  return res.sendFile(path.join(projectRoot, 'src/frontend/landing.html'));
});

app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(` SCHOOLBOOK SMS FRAMEWORK IS RUNNING ON PORT ${PORT} `);
  console.log(` URL: http://localhost:${PORT} `);
  console.log(` Mode: Development (Multi-Tenant TypeScript Express API) `);
  console.log(`===========================================================`);
});
