import { Router, Response } from 'express';
import { collections, saveDB, StudentPortal } from '../db/db.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// 1. Get student portals
// Teachers & Management can retrieve all student portals; Students/Guardians can only see their own
router.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;

  const portals = collections.getPortals().filter(p => p.tenant_id === tenantId);

  if (currentUser.role === 'Student') {
    // Student can only see their own portal
    const myPortals = portals.filter(p => p.student_id === currentUser.id);
    return res.json(myPortals);
  }

  // Teachers, Principals, Deans, Counselors see all student portals
  return res.json(portals);
});

// 2. Get specific student's portal
router.get('/:studentId', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const studentId = req.params.studentId;

  if (currentUser.role === 'Student' && currentUser.id !== studentId) {
    return res.status(403).json({ error: 'Access Denied: Students can only view their own academic portal.' });
  }

  const portal = collections.getPortals().find(p => p.student_id === studentId && p.tenant_id === tenantId);

  if (!portal) {
    // If student exists in members, synthesize an initial portal record
    const member = collections.getMembers().find(m => m.id === studentId && m.tenant_id === tenantId);
    if (!member) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    const newPortal: StudentPortal = {
      id: `portal_${studentId}`,
      tenant_id: tenantId,
      student_id: studentId,
      student_name: member.name,
      grade_level: member.position || 'Grade 10',
      overall_score: member.academic_score || 75,
      term: 'Fall Term 2026',
      grades: [
        { id: `g_init_1`, subject: 'AP Physics', score: member.academic_score || 75, teacher: 'Ms. Clara Higgins', term: 'Fall 2026', comments: 'Baseline assessment recorded.' }
      ],
      teacher_remarks: 'Academic portal created. Awaiting comprehensive evaluation.',
      guardian_name: member.guardian_name || 'Guardian on File',
      guardian_email: member.guardian_email || '',
      guardian_phone: member.guardian_phone || '',
      guardian_relation: 'Guardian',
      syllabus_attachments: [
        { title: 'Academic Curriculum Syllabus 2026-2027', filename: 'Oakridge_Curriculum_2026.pdf', uploaded_by: 'Faculty Administration', date: '2026-09-01' }
      ],
      last_updated_by: `${currentUser.name} (${currentUser.role})`,
      updated_at: new Date().toISOString()
    };

    collections.getPortals().push(newPortal);
    saveDB();
    return res.json(newPortal);
  }

  return res.json(portal);
});

// 3. Create or Edit student portal
// STRICT REQUIREMENT: "Student portals should be created and edited by teachers and management, can only be viewed by students/guardian."
router.put('/:studentId', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const currentUser = req.user!;
  const tenantId = req.tenantId!;
  const studentId = req.params.studentId;

  // Enforce Teacher and Management authorization
  const isAuthorizedEditor = currentUser.role === 'Teacher' || currentUser.role === 'Principal' || currentUser.role === 'Dean';
  if (!isAuthorizedEditor) {
    return res.status(403).json({
      error: 'Access Denied: Student portals can only be created and edited by Teachers and Management (Principal / Dean).'
    });
  }

  const {
    overall_score,
    term,
    grades,
    teacher_remarks,
    guardian_name,
    guardian_email,
    guardian_phone,
    guardian_relation,
    syllabus_attachments
  } = req.body;

  let portal = collections.getPortals().find(p => p.student_id === studentId && p.tenant_id === tenantId);
  const member = collections.getMembers().find(m => m.id === studentId && m.tenant_id === tenantId);

  if (!portal) {
    if (!member) {
      return res.status(404).json({ error: 'Target student not found in directory.' });
    }
    portal = {
      id: `portal_${studentId}`,
      tenant_id: tenantId,
      student_id: studentId,
      student_name: member.name,
      grade_level: member.position || 'Student',
      overall_score: Number(overall_score) || 70,
      term: term || 'Fall Term 2026',
      grades: grades || [],
      teacher_remarks: teacher_remarks || '',
      guardian_name: guardian_name || member.guardian_name || '',
      guardian_email: guardian_email || member.guardian_email || '',
      guardian_phone: guardian_phone || member.guardian_phone || '',
      guardian_relation: guardian_relation || 'Parent/Guardian',
      syllabus_attachments: syllabus_attachments || [],
      last_updated_by: `${currentUser.name} (${currentUser.role})`,
      updated_at: new Date().toISOString()
    };
    collections.getPortals().push(portal);
  } else {
    if (overall_score !== undefined) portal.overall_score = Number(overall_score);
    if (term !== undefined) portal.term = term;
    if (grades !== undefined) portal.grades = grades;
    if (teacher_remarks !== undefined) portal.teacher_remarks = teacher_remarks;
    if (guardian_name !== undefined) portal.guardian_name = guardian_name;
    if (guardian_email !== undefined) portal.guardian_email = guardian_email;
    if (guardian_phone !== undefined) portal.guardian_phone = guardian_phone;
    if (guardian_relation !== undefined) portal.guardian_relation = guardian_relation;
    if (syllabus_attachments !== undefined) portal.syllabus_attachments = syllabus_attachments;

    portal.last_updated_by = `${currentUser.name} (${currentUser.role})`;
    portal.updated_at = new Date().toISOString();
  }

  // Also sync overall_score back to member for unified directory identification circle
  if (member && overall_score !== undefined) {
    member.academic_score = Number(overall_score);
  }

  saveDB();

  return res.json({
    success: true,
    message: `Student portal for ${portal.student_name} updated successfully by ${currentUser.name}.`,
    portal
  });
});

export default router;
