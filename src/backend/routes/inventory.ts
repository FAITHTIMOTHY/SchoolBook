import { Router, Response } from 'express';
import { collections, saveDB, InventoryItem } from '../db/db.js';
import { AuthenticatedRequest, authMiddleware, requireUnitOrPrincipal } from '../middleware/auth.js';

const router = Router();

// 1. Get all inventory items for the active campus
// Accessible by any authenticated student or staff to view school facilities and equipment
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const inventory = collections.getInventory().filter(i => i.tenant_id === tenantId);
  return res.json(inventory);
});

// 2. Create new inventory item
// Restricted to members of STEM/Science, Arts/Humanities, Athletics, and the Principal
router.post('/', authMiddleware, requireUnitOrPrincipal(['science', 'stem', 'tech', 'library', 'athletic', 'art', 'lab', 'humanities', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const { item_name, description, status, unit_id } = req.body;

  if (!item_name || !status) {
    return res.status(400).json({ error: 'Item name and status are required.' });
  }

  const newItem: InventoryItem = {
    id: `inv_${tenantId}_${Date.now()}`,
    tenant_id: tenantId,
    item_name,
    description: description || '',
    status: status || 'Active',
    unit_id: unit_id || null,
    updated_at: new Date().toISOString(),
  };

  collections.getInventory().push(newItem);
  saveDB();

  return res.status(201).json(newItem);
});

// 3. Update inventory item status or details
// Restricted to faculty departments and the Principal
router.put('/:id', authMiddleware, requireUnitOrPrincipal(['science', 'stem', 'tech', 'library', 'athletic', 'art', 'lab', 'humanities', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const itemId = req.params.id;
  const { item_name, description, status, unit_id } = req.body;

  const inventory = collections.getInventory();
  const itemIdx = inventory.findIndex(i => i.id === itemId && i.tenant_id === tenantId);

  if (itemIdx === -1) {
    return res.status(404).json({ error: 'Equipment item not found.' });
  }

  const item = inventory[itemIdx];

  if (item_name !== undefined) item.item_name = item_name;
  if (description !== undefined) item.description = description;
  if (status !== undefined) {
    if (!['Active', 'Faulty', 'Unavailable'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be Active, Faulty, or Unavailable.' });
    }
    item.status = status;
  }
  if (unit_id !== undefined) item.unit_id = unit_id || null;
  item.updated_at = new Date().toISOString();

  saveDB();
  return res.json(item);
});

// 4. Delete inventory item
// Restricted to Principal only for safety
router.delete('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const itemId = req.params.id;

  if (currentUser.role !== 'Principal') {
    return res.status(403).json({ error: 'Access Denied: Only the Principal / Headmaster can delete items from the registry.' });
  }

  const inventory = collections.getInventory();
  const idx = inventory.findIndex(i => i.id === itemId && i.tenant_id === tenantId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Equipment item not found.' });
  }

  inventory.splice(idx, 1);
  saveDB();

  return res.json({ success: true, message: 'Campus asset deleted successfully.' });
});

export default router;
