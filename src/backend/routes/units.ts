import { Router, Response } from 'express';
import { collections, saveDB, Unit } from '../db/db.js';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

// 1. Get all departments/faculties for the active campus
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const units = collections.getUnits().filter(u => u.tenant_id === tenantId);
  return res.json(units);
});

// 2. Create new department/class (Principal creates units, Dean can create sub-units)
router.post('/', authMiddleware, requireRole(['Principal', 'Dean']), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const { name, parent_unit_id, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Department / class name is required.' });
  }

  // If Dean is creating a unit, verify it is a subunit under their faculty
  if (currentUser.role === 'Dean') {
    if (!parent_unit_id || parent_unit_id !== currentUser.unit_id) {
      return res.status(403).json({
        error: 'Access Denied: Deans can only create sub-units nested under their own faculty department.'
      });
    }
  }

  const units = collections.getUnits();
  const duplicate = units.some(u => u.tenant_id === tenantId && u.name.toLowerCase() === name.toLowerCase());
  
  if (duplicate) {
    return res.status(400).json({ error: `A department or class named "${name}" already exists on this campus.` });
  }

  const newUnit: Unit = {
    id: `unit_${tenantId}_${Date.now()}`,
    tenant_id: tenantId,
    name,
    parent_unit_id: parent_unit_id || null,
    description: description || '',
  };

  units.push(newUnit);
  saveDB();

  return res.status(201).json(newUnit);
});

// 3. Delete unit (Strictly Principal)
router.delete('/:id', authMiddleware, requireRole(['Principal']), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const unitId = req.params.id;

  const units = collections.getUnits();
  const idx = units.findIndex(u => u.id === unitId && u.tenant_id === tenantId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Department unit not found.' });
  }

  // Remove unit association from members and inventory items
  const members = collections.getMembers();
  members.forEach(m => {
    if (m.unit_id === unitId) m.unit_id = null;
  });

  const inventory = collections.getInventory();
  inventory.forEach(i => {
    if (i.unit_id === unitId) i.unit_id = null;
  });

  units.splice(idx, 1);
  saveDB();

  return res.json({ success: true, message: 'Department and its cascading associations deleted.' });
});

export default router;
