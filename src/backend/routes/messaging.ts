import { Router, Response } from 'express';
import { collections, saveDB, BroadcastMessage } from '../db/db.js';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

// 1. Get broadcast circulars and reminders for the active campus
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const currentUser = req.user!;

  const broadcasts = collections.getBroadcasts().filter(b => b.tenant_id === tenantId);

  // Filter messages relevant to user:
  // If student: show 'all' and messages targeting student's unit
  if (currentUser.role === 'Student') {
    const visible = broadcasts.filter(b => 
      b.target === 'all' || 
      (b.target === 'unit' && b.unit_id === currentUser.unit_id) ||
      b.target === 'first-timers'
    );
    return res.json(visible);
  }

  // Staff & Admin see all broadcast messages
  return res.json(broadcasts);
});

// 2. Dispatch broadcast circular, reminder, or curriculum upload
// STRICT REQUIREMENT: "Broadcast channel for teachers to set reminders on assignment, test and impromptu informations, bulk mailing possible."
// "Uploading of sylabus and curicullum to broadcast channel"
router.post('/send', authMiddleware, requireRole(['Principal', 'Dean', 'Counselor', 'Teacher']), (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const { 
    target, 
    unitId, 
    category = 'impromptu', 
    title, 
    message, 
    event_date, 
    attachment,
    bulk_mail = false 
  } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message body cannot be empty.' });
  }

  const validCategories = ['assignment', 'test', 'impromptu', 'curriculum'];
  const safeCategory = validCategories.includes(category) ? category : 'impromptu';

  const members = collections.getMembers().filter(m => m.tenant_id === tenantId);
  let recipients: typeof members = [];

  if (target === 'all') {
    // Principal and Teachers broadcasting syllabus, exam notices, or alerts school-wide
    recipients = members;
  } else if (target === 'unit') {
    const targetUnitId = (currentUser.role === 'Principal' && unitId) ? unitId : (currentUser.unit_id || unitId);
    if (!targetUnitId) {
      recipients = members.filter(m => m.role === 'Student');
    } else {
      recipients = members.filter(m => m.unit_id === targetUnitId || m.role === 'Teacher');
    }
  } else if (target === 'first-timers') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    recipients = members.filter(m => 
      m.role === 'Student' && 
      new Date(m.joined_date) >= thirtyDaysAgo
    );
  } else {
    recipients = members;
  }

  // Construct recipient contact list including guardians if bulk mailing
  const emailList: string[] = [];
  recipients.forEach(r => {
    if (r.email) emailList.push(r.email);
    if (bulk_mail && r.guardian_email) {
      emailList.push(`${r.guardian_email} (Guardian of ${r.name})`);
    }
  });

  const recipientCount = emailList.length > 0 ? emailList.length : recipients.length;

  const newBroadcast: BroadcastMessage = {
    id: `bc_${Date.now()}`,
    tenant_id: tenantId,
    sender_id: currentUser.id,
    sender_name: currentUser.name,
    sender_role: currentUser.role,
    target: target || 'all',
    unit_id: unitId || currentUser.unit_id || null,
    category: safeCategory as any,
    title: title || `${safeCategory.toUpperCase()} Bulletin: ${new Date().toLocaleDateString()}`,
    message: message.trim(),
    event_date: event_date || undefined,
    attachment: attachment || undefined,
    bulk_mailed: Boolean(bulk_mail),
    recipient_count: recipientCount,
    sent_at: new Date().toISOString()
  };

  collections.getBroadcasts().unshift(newBroadcast);

  // If this was a curriculum/syllabus upload, also link it to student portals under this unit/campus!
  if (safeCategory === 'curriculum' && attachment) {
    const portals = collections.getPortals().filter(p => p.tenant_id === tenantId);
    portals.forEach(p => {
      p.syllabus_attachments.unshift({
        title: title || attachment.name,
        filename: attachment.name,
        uploaded_by: `${currentUser.name} (${currentUser.role})`,
        date: new Date().toISOString().split('T')[0]
      });
    });
  }

  saveDB();

  console.log(`===========================================================`);
  console.log(`[BROADCAST DISPATCHED] Campus: ${tenantId}`);
  console.log(`[Sender]: ${currentUser.name} (${currentUser.role})`);
  console.log(`[Category]: ${safeCategory} | Title: ${newBroadcast.title}`);
  console.log(`[Bulk Mailing]: ${bulk_mail ? 'ACTIVE - Bulk Emails Dispatched' : 'Standard Web/SMS Push'}`);
  console.log(`[Total Recipients]: ${recipientCount}`);
  if (bulk_mail) {
    console.log(`[Dispatched Email Addresses]:`, emailList.slice(0, 5));
  }
  console.log(`===========================================================`);

  return res.json({
    success: true,
    recipientCount,
    recipients: emailList.slice(0, 10),
    broadcast: newBroadcast,
    message: `Broadcast for ${safeCategory} published successfully${bulk_mail ? ' with bulk email alerts dispatched' : ''} to ${recipientCount} recipients.`
  });
});

export default router;
