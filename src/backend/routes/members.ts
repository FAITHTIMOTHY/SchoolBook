import { Router, Response } from 'express';
import { collections, saveDB, Member } from '../db/db.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// Helper to prune sensitive member/student data based on logged-in user's role
function pruneMemberData(member: Member, currentUser: Member): Partial<Member> {
  const isPrincipal = currentUser.role === 'Principal';
  const isCounselor = currentUser.role === 'Counselor';
  const isSelf = currentUser.id === member.id;

  if (isPrincipal || isCounselor || isSelf) {
    return member; // Full access
  }

  // Restricted access (e.g. Teachers, other Students)
  return {
    id: member.id,
    tenant_id: member.tenant_id,
    name: member.name,
    role: member.role,
    position: member.position,
    unit_id: member.unit_id,
    status: member.status,
    profile_picture_url: member.profile_picture_url,
    academic_score: member.academic_score,
    office_location: member.office_location,
    office_hours: member.office_hours,
    bio: member.bio,
    specialization: member.specialization,
    // Pruned fields: email, phone, address, dob_month, dob_day, joined_date
  };
}

// 1. Get all students and staff members for the active school campus
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const { search, role, status } = req.query;

  let members = collections.getMembers().filter(m => m.tenant_id === tenantId);

  // Apply search filtering
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    members = members.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.email.toLowerCase().includes(q) ||
      m.position.toLowerCase().includes(q)
    );
  }

  // Apply role filtering
  if (role && typeof role === 'string') {
    members = members.filter(m => m.role === role);
  }

  // Apply status filtering
  if (status && typeof status === 'string') {
    members = members.filter(m => m.status === status);
  }

  // Prune sensitive data based on role
  const prunedMembers = members.map(m => pruneMemberData(m, currentUser));

  return res.json(prunedMembers);
});

// 2. Get details of a single student or faculty member
router.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const memberId = req.params.id;

  const member = collections.getMembers().find(m => m.id === memberId && m.tenant_id === tenantId);

  if (!member) {
    return res.status(404).json({ error: 'Student or faculty profile not found.' });
  }

  return res.json(pruneMemberData(member, currentUser));
});

// 3. Register a new student or staff profile
// Restricted to Principal or Guidance Counselors
router.post('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;

  if (currentUser.role !== 'Principal' && currentUser.role !== 'Counselor') {
    return res.status(403).json({ error: 'Access Denied: You do not have permissions to register student/staff profiles.' });
  }

  const { 
    name, 
    email, 
    phone, 
    address, 
    profile_picture_url, 
    dob_month, 
    dob_day, 
    role, 
    position, 
    unit_id,
    academic_score,
    guardian_name,
    guardian_email,
    guardian_phone,
    office_location,
    office_hours,
    bio,
    specialization
  } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: 'Name and Role are required fields.' });
  }

  // Build unique ID
  const newId = `m_${tenantId}_${Date.now()}`;
  const newMember: Member = {
    id: newId,
    tenant_id: tenantId,
    name,
    email: email || '',
    phone: phone || '',
    address: address || '',
    profile_picture_url: profile_picture_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
    dob_month: Number(dob_month) || 1,
    dob_day: Number(dob_day) || 1,
    role: role,
    position: position || (role === 'Student' ? 'Student' : 'Faculty Staff'),
    unit_id: unit_id || null,
    status: 'Active',
    joined_date: new Date().toISOString(),
    academic_score: academic_score !== undefined ? Number(academic_score) : (role === 'Student' ? 75 : undefined),
    guardian_name: guardian_name || undefined,
    guardian_email: guardian_email || undefined,
    guardian_phone: guardian_phone || undefined,
    office_location: office_location || undefined,
    office_hours: office_hours || undefined,
    bio: bio || undefined,
    specialization: specialization || undefined
  };

  collections.getMembers().push(newMember);
  saveDB();

  return res.status(201).json(newMember);
});

// 4. Update a profile
router.put('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const memberId = req.params.id;

  const members = collections.getMembers();
  const memberIdx = members.findIndex(m => m.id === memberId && m.tenant_id === tenantId);

  if (memberIdx === -1) {
    return res.status(404).json({ error: 'Profile not found.' });
  }

  const targetMember = members[memberIdx];

  // Access check: Principal, or the user updating themselves
  const isPrincipal = currentUser.role === 'Principal';
  const isSelf = currentUser.id === memberId;

  if (!isPrincipal && !isSelf) {
    return res.status(403).json({ error: 'Access Denied: Insufficient permissions to update this profile.' });
  }

  const { 
    name, 
    email, 
    phone, 
    address, 
    profile_picture_url, 
    dob_month, 
    dob_day, 
    role, 
    position, 
    unit_id, 
    status,
    academic_score,
    guardian_name,
    guardian_email,
    guardian_phone,
    office_location,
    office_hours,
    bio,
    specialization
  } = req.body;

  // Standard student cannot modify their own role, position, faculty, or status
  if (!isPrincipal) {
    if (role !== undefined && role !== targetMember.role) {
      return res.status(403).json({ error: 'Access Denied: Students cannot modify roles.' });
    }
    if (position !== undefined && position !== targetMember.position) {
      return res.status(403).json({ error: 'Access Denied: Students cannot change academic positions.' });
    }
    if (unit_id !== undefined && unit_id !== targetMember.unit_id) {
      return res.status(403).json({ error: 'Access Denied: Students cannot change classes or faculties.' });
    }
    if (status !== undefined && status !== targetMember.status) {
      return res.status(403).json({ error: 'Access Denied: Students cannot modify enrollment status.' });
    }
  }

  // Apply updates
  if (name !== undefined) targetMember.name = name;
  if (email !== undefined) targetMember.email = email;
  if (phone !== undefined) targetMember.phone = phone;
  if (address !== undefined) targetMember.address = address;
  if (profile_picture_url !== undefined) targetMember.profile_picture_url = profile_picture_url;
  if (dob_month !== undefined) targetMember.dob_month = Number(dob_month);
  if (dob_day !== undefined) targetMember.dob_day = Number(dob_day);
  if (role !== undefined) targetMember.role = role;
  if (position !== undefined) targetMember.position = position;
  if (unit_id !== undefined) targetMember.unit_id = unit_id || null;
  if (status !== undefined) targetMember.status = status;
  if (academic_score !== undefined) targetMember.academic_score = Number(academic_score);
  if (guardian_name !== undefined) targetMember.guardian_name = guardian_name;
  if (guardian_email !== undefined) targetMember.guardian_email = guardian_email;
  if (guardian_phone !== undefined) targetMember.guardian_phone = guardian_phone;
  if (office_location !== undefined) targetMember.office_location = office_location;
  if (office_hours !== undefined) targetMember.office_hours = office_hours;
  if (bio !== undefined) targetMember.bio = bio;
  if (specialization !== undefined) targetMember.specialization = specialization;

  saveDB();
  return res.json(targetMember);
});

// 5. Delete a profile (Strictly Principal)
router.delete('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const memberId = req.params.id;

  if (currentUser.role !== 'Principal') {
    return res.status(403).json({ error: 'Access Denied: Only the Principal / Headmaster can delete profiles.' });
  }

  const members = collections.getMembers();
  const idx = members.findIndex(m => m.id === memberId && m.tenant_id === tenantId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Profile not found.' });
  }

  members.splice(idx, 1);
  saveDB();

  return res.json({ success: true, message: 'Profile deleted successfully.' });
});

export default router;
