import fs from 'fs';
import path from 'path';
export * from '../../shared/types.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, '../../../database.json');
// --- In-Memory State and File Operations ---
let db = {
    tenants: [],
    units: [],
    members: [],
    attendance: [],
    inventory: [],
    financials: [],
    student_portals: [],
    broadcasts: [],
};
// Save to disk atomically
export function saveDB() {
    try {
        // Perform dynamic calculation: tagging members as active/inactive
        // Rules: "Anyone absent for a month is tagged inactive."
        updateMemberStatuses();
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    }
    catch (err) {
        console.error('Error saving database:', err);
    }
}
// Load database or seed initial values
export function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            db = JSON.parse(data);
            if (!db.student_portals || db.student_portals.length < 3 || !db.members.some(m => m.office_location !== undefined)) {
                seedDB();
            }
            else {
                if (!db.student_portals)
                    db.student_portals = [];
                if (!db.broadcasts)
                    db.broadcasts = [];
                updateMemberStatuses();
            }
        }
        catch (err) {
            console.error('Failed to parse database.json, seeding new database...', err);
            seedDB();
        }
    }
    else {
        seedDB();
    }
}
// Accessors for raw collections
export const collections = {
    getTenants: () => db.tenants,
    getUnits: () => db.units,
    getMembers: () => db.members,
    getAttendance: () => db.attendance,
    getInventory: () => db.inventory,
    getFinancials: () => db.financials,
    getPortals: () => {
        if (!db.student_portals)
            db.student_portals = [];
        return db.student_portals;
    },
    getBroadcasts: () => {
        if (!db.broadcasts)
            db.broadcasts = [];
        return db.broadcasts;
    },
};
// Automatic calculation logic for active/inactive student/member status
// Triggered on database load/save
function updateMemberStatuses() {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    // Group attendance records by member_id
    const memberAttendanceMap = {};
    for (const record of db.attendance) {
        if (!memberAttendanceMap[record.member_id]) {
            memberAttendanceMap[record.member_id] = [];
        }
        memberAttendanceMap[record.member_id].push(record);
    }
    for (const member of db.members) {
        // Principals and Deans/Department heads bypass the automatic inactive tagging
        if (member.role === 'Principal' || member.role === 'Dean') {
            member.status = 'Active';
            continue;
        }
        const records = memberAttendanceMap[member.id] || [];
        // Find if the member has ANY 'Present' record within the last 30 days
        const hasPresentRecently = records.some(r => {
            const recDate = new Date(r.service_date);
            return r.status === 'Present' && recDate >= oneMonthAgo;
        });
        // Check if there was any session/class event logged at all in the system within the last 30 days.
        const systemHadServices = db.attendance.some(r => {
            const recDate = new Date(r.service_date);
            return recDate >= oneMonthAgo;
        });
        if (systemHadServices) {
            member.status = hasPresentRecently ? 'Active' : 'Inactive';
        }
        else {
            member.status = member.status || 'Active';
        }
    }
}
// --- Seeding Routine ---
export function seedDB() {
    console.log('Seeding demo data into database.json for SchoolBook SMS...');
    const tenants = [
        { id: 'tenant_oakridge', name: 'Oakridge International Academy', logo_url: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=120&h=120&fit=crop' },
        { id: 'tenant_maplewood', name: 'Maplewood Preparatory School', logo_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=120&h=120&fit=crop' },
    ];
    const units = [
        // Oakridge International Academy Units
        { id: 'unit_oak_admin', tenant_id: 'tenant_oakridge', name: "Principal's Office & Administration", parent_unit_id: null, description: 'Executive academic oversight, governance, and institutional leadership.' },
        { id: 'unit_oak_sciences', tenant_id: 'tenant_oakridge', name: 'Faculty of Science & STEM', parent_unit_id: null, description: 'Physics, chemistry, biology laboratories, and robotics curriculum.' },
        { id: 'unit_oak_humanities', tenant_id: 'tenant_oakridge', name: 'Faculty of Humanities & Arts', parent_unit_id: null, description: 'Literature, history, world languages, music, and creative arts.' },
        { id: 'unit_oak_grade10', tenant_id: 'tenant_oakridge', name: 'Grade 10 - Class A (Sophomores)', parent_unit_id: null, description: 'Homeroom advisory, student rosters, and daily attendance register.' },
        { id: 'unit_oak_grade11', tenant_id: 'tenant_oakridge', name: 'Grade 11 - Class A (Juniors)', parent_unit_id: null, description: 'Advanced placement courses and junior student records.' },
        { id: 'unit_oak_counseling', tenant_id: 'tenant_oakridge', name: 'Student Affairs & Counseling', parent_unit_id: null, description: 'Guidance counseling, student welfare, attendance follow-up, and wellness.' },
        { id: 'unit_oak_bursar', tenant_id: 'tenant_oakridge', name: 'Bursar & Finance Office', parent_unit_id: null, description: 'Tuition billing, student fees registry, lab charges, and ledger audits.' },
        { id: 'unit_oak_athletics', tenant_id: 'tenant_oakridge', name: 'Athletics & Physical Education', parent_unit_id: null, description: 'Sports facilities, athletic equipment, and fitness programmes.' },
        // Maplewood Preparatory Units
        { id: 'unit_maple_admin', tenant_id: 'tenant_maplewood', name: "Headmaster's Office", parent_unit_id: null, description: 'Campus executive governance.' },
        { id: 'unit_maple_faculty', tenant_id: 'tenant_maplewood', name: 'Teaching Faculty', parent_unit_id: null, description: 'Faculty instructors and classroom registrars.' },
        { id: 'unit_maple_bursar', tenant_id: 'tenant_maplewood', name: 'Accounts & Bursar Department', parent_unit_id: null, description: 'Student tuition collection and finance forecasting.' },
    ];
    const members = [
        // Oakridge Academy Core Admin Profiles
        {
            id: 'm_oak_principal',
            tenant_id: 'tenant_oakridge',
            name: 'Dr. Evelyn Vance',
            email: 'evelyn.vance@oakridge.edu',
            phone: '+1 234-567-8901',
            address: '14 Academy Crest Blvd, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop',
            dob_month: 8,
            dob_day: 24,
            role: 'Principal',
            position: 'Head of School / Principal',
            unit_id: 'unit_oak_admin',
            status: 'Active',
            joined_date: '2019-01-15T09:00:00Z',
            office_location: 'Room 101, Executive Quadrangle',
            office_hours: 'Mon-Thu 9:00 AM - 1:00 PM',
            bio: 'Ph.D. in Educational Leadership (Oxford). 15+ years governing international collegiate preparatory schools.',
            specialization: 'Institutional Governance & Accreditation'
        },
        {
            id: 'm_oak_dean_stem',
            tenant_id: 'tenant_oakridge',
            name: 'Prof. Marcus Brody',
            email: 'marcus.brody@oakridge.edu',
            phone: '+1 234-567-8902',
            address: '42 Copernicus Way, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
            dob_month: 3,
            dob_day: 14,
            role: 'Dean',
            position: 'Dean of Science & STEM',
            unit_id: 'unit_oak_sciences',
            status: 'Active',
            joined_date: '2020-05-20T10:30:00Z',
            office_location: 'STEM Complex, Hall 205',
            office_hours: 'Tue & Thu 2:00 PM - 5:00 PM',
            bio: 'Senior STEM curriculum director, robotics mentor, and overseer of experimental physics laboratories.',
            specialization: 'Quantum Mechanics, Robotics & Curricular Rigor'
        },
        {
            id: 'm_oak_bursar',
            tenant_id: 'tenant_oakridge',
            name: 'Mrs. Linda Gable',
            email: 'linda.gable@oakridge.edu',
            phone: '+1 234-567-8910',
            address: '35 Ledger Lane, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop',
            dob_month: 6,
            dob_day: 11,
            role: 'Dean',
            position: 'Bursar & Chief Financial Comptroller',
            unit_id: 'unit_oak_bursar',
            status: 'Active',
            joined_date: '2020-01-10T09:00:00Z',
            office_location: 'Bursar Suite 104',
            office_hours: 'Mon-Fri 8:30 AM - 4:00 PM',
            bio: 'CPA certified campus treasurer overseeing institutional financial auditing and tuition ledger accounts.',
            specialization: 'Campus Accounting, Financial Auditing & Grants'
        },
        // Oakridge Academy Academic Staff Profiles
        {
            id: 'm_oak_teacher',
            tenant_id: 'tenant_oakridge',
            name: 'Ms. Clara Higgins',
            email: 'clara.higgins@oakridge.edu',
            phone: '+1 234-567-8903',
            address: '78 Scholastic Road, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
            dob_month: 12,
            dob_day: 5,
            role: 'Teacher',
            position: 'Lead Teacher & Grade 10 Registrar',
            unit_id: 'unit_oak_grade10',
            status: 'Active',
            joined_date: '2021-09-01T08:00:00Z',
            office_location: 'Classroom 302, Upper Hall',
            office_hours: 'Daily 3:00 PM - 4:30 PM',
            bio: 'M.Ed. in Secondary Mathematics. Lead homeroom advisor, test coordinator, and curriculum developer.',
            specialization: 'AP Calculus, Theoretical Physics, Student Portals'
        },
        {
            id: 'm_oak_counselor',
            tenant_id: 'tenant_oakridge',
            name: 'Mr. David Miller',
            email: 'david.miller@oakridge.edu',
            phone: '+1 234-567-8904',
            address: '23 Wellness Park, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
            dob_month: 5,
            dob_day: 18,
            role: 'Counselor',
            position: 'Guidance Counselor & Welfare Officer',
            unit_id: 'unit_oak_counseling',
            status: 'Active',
            joined_date: '2022-02-12T11:00:00Z',
            office_location: 'Student Counseling Center 115',
            office_hours: 'Mon-Fri 10:00 AM - 3:00 PM',
            bio: 'Licensed Adolescent Psychologist focusing on wellness, academic motivation, and university admissions.',
            specialization: 'College Admissions, Wellness Guidance & Family Mediation'
        },
        {
            id: 'm_oak_teacher2',
            tenant_id: 'tenant_oakridge',
            name: 'Mr. Aaron Wright',
            email: 'aaron.wright@oakridge.edu',
            phone: '+1 234-567-8912',
            address: '54 Library Court, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop',
            dob_month: 9,
            dob_day: 28,
            role: 'Teacher',
            position: 'Senior Humanities Instructor',
            unit_id: 'unit_oak_humanities',
            status: 'Active',
            joined_date: '2022-08-15T09:00:00Z',
            office_location: 'Arts Studio 108',
            office_hours: 'Wed & Fri 1:00 PM - 3:00 PM',
            bio: 'Master of Arts in Comparative Literature. Directs speech & debate, rhetoric, and modern world history.',
            specialization: 'World Literature, Rhetoric & Historical Research'
        },
        // Oakridge Academy Student Profiles with Academic Performance Scores
        // Performance Indicator Circles:
        // Green: > 70%
        // Yellow: 50% - 69%
        // Red: < 50%
        {
            id: 'm_oak_student1',
            tenant_id: 'tenant_oakridge',
            name: 'Sophia Chen',
            email: 'sophia.chen@student.oakridge.edu',
            phone: '+1 234-567-8905',
            address: '88 Meadowbrook Lane, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
            dob_month: 10,
            dob_day: 12,
            role: 'Student',
            position: 'Grade 10 Student',
            unit_id: 'unit_oak_grade10',
            status: 'Active',
            joined_date: '2024-06-01T10:00:00Z',
            academic_score: 88, // > 70 -> GREEN CIRCLE
            guardian_name: 'Mrs. Wei Chen',
            guardian_email: 'wei.chen@family.com',
            guardian_phone: '+1 234-555-0199',
            bio: 'Honors STEM scholar, student council member, and science olympiad medalist.'
        },
        {
            id: 'm_oak_student2_inactive',
            tenant_id: 'tenant_oakridge',
            name: 'Thomas Vance',
            email: 'thomas.vance@student.oakridge.edu',
            phone: '+1 234-567-8906',
            address: '102 Dusty Trail Road, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop',
            dob_month: 1,
            dob_day: 9,
            role: 'Student',
            position: 'Grade 10 Student',
            unit_id: 'unit_oak_grade10',
            status: 'Inactive', // Chronic absenteeism
            joined_date: '2023-11-15T09:30:00Z',
            academic_score: 44, // < 50 -> RED CIRCLE
            guardian_name: 'Mr. John Vance',
            guardian_email: 'john.vance@family.com',
            guardian_phone: '+1 234-555-0188',
            bio: 'Enrolled student currently on academic monitoring program and attendance intervention plan.'
        },
        {
            id: 'm_oak_student3',
            tenant_id: 'tenant_oakridge',
            name: 'Lucas Ramirez',
            email: 'lucas.ramirez@student.oakridge.edu',
            phone: '+1 234-567-8915',
            address: '61 Orchard Drive, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop',
            dob_month: 4,
            dob_day: 16,
            role: 'Student',
            position: 'Grade 10 Student',
            unit_id: 'unit_oak_grade10',
            status: 'Active',
            joined_date: '2024-01-10T10:00:00Z',
            academic_score: 64, // 50-69 -> YELLOW CIRCLE
            guardian_name: 'Mrs. Maria Ramirez',
            guardian_email: 'maria.r@family.com',
            guardian_phone: '+1 234-555-0177',
            bio: 'Active participant in school athletics, making steady progress in algebra and physical chemistry.'
        },
        {
            id: 'm_oak_student4',
            tenant_id: 'tenant_oakridge',
            name: 'Emily Zhang',
            email: 'emily.zhang@student.oakridge.edu',
            phone: '+1 234-567-8916',
            address: '19 Willow Brook Road, Oakridge',
            profile_picture_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop',
            dob_month: 11,
            dob_day: 3,
            role: 'Student',
            position: 'Grade 11 Student (Junior)',
            unit_id: 'unit_oak_grade11',
            status: 'Active',
            joined_date: '2023-09-01T08:30:00Z',
            academic_score: 79, // > 70 -> GREEN CIRCLE
            guardian_name: 'Dr. Kevin Zhang',
            guardian_email: 'kevin.z@family.com',
            guardian_phone: '+1 234-555-0166',
            bio: 'Junior class leader, AP European History enthusiast, and violinist in the campus orchestra.'
        },
        // Maplewood Preparatory Members
        {
            id: 'm_maple_principal',
            tenant_id: 'tenant_maplewood',
            name: 'Dr. Arthur Pendelton',
            email: 'arthur.p@maplewood.edu',
            phone: '+1 987-654-3210',
            address: '1 Maplewood Quad, Cityville',
            profile_picture_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
            dob_month: 4,
            dob_day: 30,
            role: 'Principal',
            position: 'Headmaster',
            unit_id: 'unit_maple_admin',
            status: 'Active',
            joined_date: '2018-06-01T08:00:00Z',
            office_location: 'Headmaster Lodge',
            office_hours: 'Daily 10:00 AM - 12:00 PM',
            bio: 'Distinguished educator with 22 years of preparatory academy leadership.',
            specialization: 'Classics & Academic Tradition'
        },
        {
            id: 'm_maple_teacher',
            tenant_id: 'tenant_maplewood',
            name: 'Mr. Samuel Brooks',
            email: 'samuel.b@maplewood.edu',
            phone: '+1 987-654-3211',
            address: '15 Maple Valley, Cityville',
            profile_picture_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop',
            dob_month: 7,
            dob_day: 19,
            role: 'Teacher',
            position: 'Senior Instructor',
            unit_id: 'unit_maple_faculty',
            status: 'Active',
            joined_date: '2021-03-10T12:00:00Z',
            office_location: 'Faculty Hall A',
            office_hours: 'Tue & Thu 1:00 PM - 3:00 PM',
            bio: 'Veteran sciences educator and laboratory supervisor.',
            specialization: 'Biology & Environmental Science'
        }
    ];
    // Helper date generators relative to today's date
    const today = new Date();
    const getPastDateStr = (daysAgo) => {
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
    };
    // Seeding attendance records
    const attendance = [
        // Sophia's records
        { id: 'att_o_1', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student1', service_date: getPastDateStr(28), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_2', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student1', service_date: getPastDateStr(21), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_3', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student1', service_date: getPastDateStr(14), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_4', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student1', service_date: getPastDateStr(7), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        // Thomas's records (Attended 35 days ago, then absent in past month)
        { id: 'att_o_5', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student2_inactive', service_date: getPastDateStr(35), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_6', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student2_inactive', service_date: getPastDateStr(28), service_name: 'Morning Roll Call', status: 'Absent', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_7', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student2_inactive', service_date: getPastDateStr(21), service_name: 'Morning Roll Call', status: 'Absent', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_8', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student2_inactive', service_date: getPastDateStr(14), service_name: 'Morning Roll Call', status: 'Absent', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_9', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student2_inactive', service_date: getPastDateStr(7), service_name: 'Morning Roll Call', status: 'Absent', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        // Lucas's records
        { id: 'att_o_lucas_1', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student3', service_date: getPastDateStr(21), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_lucas_2', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student3', service_date: getPastDateStr(14), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_lucas_3', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student3', service_date: getPastDateStr(7), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        // Emily's records
        { id: 'att_o_emily_1', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student4', service_date: getPastDateStr(14), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        { id: 'att_o_emily_2', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student4', service_date: getPastDateStr(7), service_name: 'Morning Roll Call', status: 'Present', recorded_by: 'm_oak_teacher', recorded_at: new Date().toISOString() },
        // Faculty & Staff attending preparatory / staff meeting
        { id: 'att_o_10', tenant_id: 'tenant_oakridge', member_id: 'm_oak_teacher', service_date: getPastDateStr(7), service_name: 'Faculty Staff Meeting', status: 'Present', recorded_by: 'm_oak_principal', recorded_at: new Date().toISOString() },
        { id: 'att_o_11', tenant_id: 'tenant_oakridge', member_id: 'm_oak_dean_stem', service_date: getPastDateStr(7), service_name: 'Faculty Staff Meeting', status: 'Present', recorded_by: 'm_oak_principal', recorded_at: new Date().toISOString() },
        { id: 'att_o_12', tenant_id: 'tenant_oakridge', member_id: 'm_oak_counselor', service_date: getPastDateStr(7), service_name: 'Faculty Staff Meeting', status: 'Present', recorded_by: 'm_oak_principal', recorded_at: new Date().toISOString() },
    ];
    const inventory = [
        // Oakridge Academy Inventory
        { id: 'inv_o_1', tenant_id: 'tenant_oakridge', item_name: 'Physics Optics & Laser Kits', description: 'Advanced physics laboratory modular kit sets', status: 'Active', unit_id: 'unit_oak_sciences', updated_at: new Date().toISOString() },
        { id: 'inv_o_2', tenant_id: 'tenant_oakridge', item_name: '4K Interactive Classroom Smartboard', description: 'STEM lecture theater digital touch display', status: 'Active', unit_id: 'unit_oak_sciences', updated_at: new Date().toISOString() },
        { id: 'inv_o_3', tenant_id: 'tenant_oakridge', item_name: 'Shure Wireless Classroom Audio Microphones', description: 'Lecture hall lapel audio set (Needs battery pack replacement)', status: 'Faulty', unit_id: 'unit_oak_sciences', updated_at: new Date().toISOString() },
        { id: 'inv_o_4', tenant_id: 'tenant_oakridge', item_name: 'Yamaha Concert Grand Synthesizer', description: 'Music academy performance keyboard', status: 'Active', unit_id: 'unit_oak_humanities', updated_at: new Date().toISOString() },
        { id: 'inv_o_5', tenant_id: 'tenant_oakridge', item_name: 'Mobile Chromebook Cart (30 Units)', description: 'Secondary grade mobile digital research cart', status: 'Active', unit_id: 'unit_oak_grade10', updated_at: new Date().toISOString() },
        // Maplewood Inventory
        { id: 'inv_m_1', tenant_id: 'tenant_maplewood', item_name: 'Field Athletics Hurdles & Sports Equipment', description: 'Athletic department track gear', status: 'Unavailable', unit_id: 'unit_maple_faculty', updated_at: new Date().toISOString() }
    ];
    const financials = [
        // Oakridge Academy Financials
        { id: 'fin_o_1', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student1', amount: 1500.00, category: 'Tuition', payment_method: 'Card', transaction_date: getPastDateStr(25) + 'T10:00:00Z', recorded_by: 'm_oak_principal' },
        { id: 'fin_o_2', tenant_id: 'tenant_oakridge', member_id: null, amount: 250.00, category: 'Lab & Library Fees', payment_method: 'Cash', transaction_date: getPastDateStr(21) + 'T12:00:00Z', recorded_by: 'm_oak_principal' },
        { id: 'fin_o_3', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student2_inactive', amount: 120.00, category: 'PTA & Extracurricular', payment_method: 'Bank Transfer', transaction_date: getPastDateStr(18) + 'T14:30:00Z', recorded_by: 'm_oak_principal' },
        { id: 'fin_o_4', tenant_id: 'tenant_oakridge', member_id: 'm_oak_student1', amount: 1500.00, category: 'Tuition', payment_method: 'Card', transaction_date: getPastDateStr(11) + 'T10:15:00Z', recorded_by: 'm_oak_principal' },
        { id: 'fin_o_5', tenant_id: 'tenant_oakridge', member_id: null, amount: 300.00, category: 'Lab & Library Fees', payment_method: 'Cash', transaction_date: getPastDateStr(7) + 'T11:45:00Z', recorded_by: 'm_oak_principal' },
        { id: 'fin_o_6', tenant_id: 'tenant_oakridge', member_id: 'm_oak_principal', amount: 1000.00, category: 'Donations', payment_method: 'Bank Transfer', transaction_date: getPastDateStr(2) + 'T16:00:00Z', recorded_by: 'm_oak_principal' },
        // Maplewood Financials
        { id: 'fin_m_1', tenant_id: 'tenant_maplewood', member_id: 'm_maple_teacher', amount: 1200.00, category: 'Tuition', payment_method: 'Card', transaction_date: getPastDateStr(7) + 'T11:00:00Z', recorded_by: 'm_maple_principal' }
    ];
    // Student Portals Seed
    // Created and edited by teachers and management, strictly read-only for students/guardians
    const student_portals = [
        {
            id: 'portal_sophia',
            tenant_id: 'tenant_oakridge',
            student_id: 'm_oak_student1',
            student_name: 'Sophia Chen',
            grade_level: 'Grade 10 - Class A (Sophomores)',
            overall_score: 88, // > 70 -> GREEN CIRCLE
            term: 'Fall Term 2026',
            grades: [
                { id: 'g_1', subject: 'AP Physics & Mechanics', score: 89, teacher: 'Ms. Clara Higgins', term: 'Fall 2026', comments: 'Superb laboratory precision and kinematics problem sets.' },
                { id: 'g_2', subject: 'Honors Calculus BC', score: 92, teacher: 'Ms. Clara Higgins', term: 'Fall 2026', comments: 'Exemplary grasp of derivatives and optimization.' },
                { id: 'g_3', subject: 'World Literature & Rhetoric', score: 85, teacher: 'Mr. Aaron Wright', term: 'Fall 2026', comments: 'Insightful essay contributions during seminar debates.' },
                { id: 'g_4', subject: 'Robotics & STEM Design', score: 86, teacher: 'Prof. Marcus Brody', term: 'Fall 2026', comments: 'Outstanding sensor integration on autonomous rover prototype.' }
            ],
            teacher_remarks: 'Sophia continues to perform at the highest academic standard. Her leadership in classroom discussions and laboratory group experiments sets a benchmark for the cohort. Recommended for the Dean’s Honors List.',
            guardian_name: 'Mrs. Wei Chen',
            guardian_email: 'wei.chen@family.com',
            guardian_phone: '+1 234-555-0199',
            guardian_relation: 'Mother',
            syllabus_attachments: [
                { title: 'Grade 10 STEM Physics Curriculum & Syllabus 2026-2027', filename: 'STEM_Physics_Syllabus_2026.pdf', uploaded_by: 'Ms. Clara Higgins', date: '2026-09-01' },
                { title: 'Honors Calculus Fall Semester Scope & Sequence', filename: 'Calculus_Honors_Syllabus_2026.pdf', uploaded_by: 'Ms. Clara Higgins', date: '2026-09-02' }
            ],
            last_updated_by: 'Ms. Clara Higgins (Lead Teacher)',
            updated_at: new Date().toISOString()
        },
        {
            id: 'portal_thomas',
            tenant_id: 'tenant_oakridge',
            student_id: 'm_oak_student2_inactive',
            student_name: 'Thomas Vance',
            grade_level: 'Grade 10 - Class A (Sophomores)',
            overall_score: 44, // < 50 -> RED CIRCLE
            term: 'Fall Term 2026',
            grades: [
                { id: 'g_5', subject: 'AP Physics & Mechanics', score: 42, teacher: 'Ms. Clara Higgins', term: 'Fall 2026', comments: 'Missed two consecutive unit quizzes; needs remedial tutoring.' },
                { id: 'g_6', subject: 'Honors Calculus BC', score: 45, teacher: 'Ms. Clara Higgins', term: 'Fall 2026', comments: 'Requires fundamental review of trigonometric identities.' },
                { id: 'g_7', subject: 'World Literature & Rhetoric', score: 48, teacher: 'Mr. Aaron Wright', term: 'Fall 2026', comments: 'Draft paper submissions pending revision.' },
                { id: 'g_8', subject: 'Robotics & STEM Design', score: 41, teacher: 'Prof. Marcus Brody', term: 'Fall 2026', comments: 'Attendance in weekly lab workshop required.' }
            ],
            teacher_remarks: 'Thomas requires urgent academic intervention and regular counseling follow-ups. A collaborative conference between guardian, homeroom teacher, and Guidance Counselor Mr. Miller has been scheduled.',
            guardian_name: 'Mr. John Vance',
            guardian_email: 'john.vance@family.com',
            guardian_phone: '+1 234-555-0188',
            guardian_relation: 'Father',
            syllabus_attachments: [
                { title: 'Grade 10 STEM Physics Curriculum & Syllabus 2026-2027', filename: 'STEM_Physics_Syllabus_2026.pdf', uploaded_by: 'Ms. Clara Higgins', date: '2026-09-01' }
            ],
            last_updated_by: 'Ms. Clara Higgins (Lead Teacher)',
            updated_at: new Date().toISOString()
        },
        {
            id: 'portal_lucas',
            tenant_id: 'tenant_oakridge',
            student_id: 'm_oak_student3',
            student_name: 'Lucas Ramirez',
            grade_level: 'Grade 10 - Class A (Sophomores)',
            overall_score: 64, // 50-69 -> YELLOW CIRCLE
            term: 'Fall Term 2026',
            grades: [
                { id: 'g_9', subject: 'AP Physics & Mechanics', score: 62, teacher: 'Ms. Clara Higgins', term: 'Fall 2026', comments: 'Consistent participation in class discussions.' },
                { id: 'g_10', subject: 'Honors Calculus BC', score: 68, teacher: 'Ms. Clara Higgins', term: 'Fall 2026', comments: 'Good work on daily drills; exam review recommended.' },
                { id: 'g_11', subject: 'World Literature & Rhetoric', score: 65, teacher: 'Mr. Aaron Wright', term: 'Fall 2026', comments: 'Active orator during group presentations.' },
                { id: 'g_12', subject: 'Robotics & STEM Design', score: 61, teacher: 'Prof. Marcus Brody', term: 'Fall 2026', comments: 'Solid mechanics assembly work.' }
            ],
            teacher_remarks: 'Lucas demonstrates positive engagement in all core subjects. With targeted support in analytical problem-solving and structured study habits, he is well positioned to enter the honors tier (>70%).',
            guardian_name: 'Mrs. Maria Ramirez',
            guardian_email: 'maria.r@family.com',
            guardian_phone: '+1 234-555-0177',
            guardian_relation: 'Mother',
            syllabus_attachments: [
                { title: 'Grade 10 STEM Physics Curriculum & Syllabus 2026-2027', filename: 'STEM_Physics_Syllabus_2026.pdf', uploaded_by: 'Ms. Clara Higgins', date: '2026-09-01' }
            ],
            last_updated_by: 'Ms. Clara Higgins (Lead Teacher)',
            updated_at: new Date().toISOString()
        }
    ];
    // Broadcast Circulars & Teacher Reminders Seed
    const broadcasts = [
        {
            id: 'bc_1',
            tenant_id: 'tenant_oakridge',
            sender_id: 'm_oak_teacher',
            sender_name: 'Ms. Clara Higgins',
            sender_role: 'Teacher',
            target: 'unit',
            unit_id: 'unit_oak_grade10',
            category: 'assignment',
            title: 'Assignment Reminder: Calculus Problem Set #4',
            message: 'Reminder for Grade 10 Sophomores: Homework Problem Set 4 on Derivatives & Rates of Change is due this Friday by 5:00 PM. Please submit your working sheets via the portal.',
            event_date: getPastDateStr(-3), // Due in 3 days
            bulk_mailed: true,
            recipient_count: 34,
            sent_at: new Date().toISOString()
        },
        {
            id: 'bc_2',
            tenant_id: 'tenant_oakridge',
            sender_id: 'm_oak_dean_stem',
            sender_name: 'Prof. Marcus Brody',
            sender_role: 'Dean',
            target: 'all',
            unit_id: null,
            category: 'test',
            title: 'Test Reminder: Fall Midterm STEM & Laboratory Exam',
            message: 'All students enrolled in Grade 10 & 11 STEM courses: The Midterm Physics and Chemistry examination is scheduled for next Thursday morning in the East Auditorium. Bring approved scientific calculators.',
            event_date: getPastDateStr(-7), // In 7 days
            bulk_mailed: true,
            recipient_count: 52,
            sent_at: new Date().toISOString()
        },
        {
            id: 'bc_3',
            tenant_id: 'tenant_oakridge',
            sender_id: 'm_oak_principal',
            sender_name: 'Dr. Evelyn Vance',
            sender_role: 'Principal',
            target: 'all',
            unit_id: null,
            category: 'impromptu',
            title: 'Impromptu Bulletin: Campus Science Fair Auditorium Venue',
            message: 'Notice to all faculty, students, and guardians: Due to weather forecasts for Friday afternoon, the Annual Student Science & Robotics Expo will take place in the Indoor Gymnasium instead of the Quad.',
            bulk_mailed: true,
            recipient_count: 65,
            sent_at: new Date().toISOString()
        },
        {
            id: 'bc_4',
            tenant_id: 'tenant_oakridge',
            sender_id: 'm_oak_teacher',
            sender_name: 'Ms. Clara Higgins',
            sender_role: 'Teacher',
            target: 'all',
            unit_id: null,
            category: 'curriculum',
            title: 'Official Academic Curriculum & Term Syllabus 2026-2027 Uploaded',
            message: 'The official departmental syllabus covering the Fall and Spring semesters for Secondary STEM and Humanities courses has been uploaded for student and guardian review.',
            attachment: {
                name: 'Oakridge_Comprehensive_Academic_Curriculum_2026-2027.pdf',
                url: '/documents/Oakridge_Comprehensive_Academic_Curriculum_2026-2027.pdf',
                size: '2.4 MB',
                type: 'PDF Curriculum Document'
            },
            bulk_mailed: true,
            recipient_count: 65,
            sent_at: new Date().toISOString()
        }
    ];
    db = { tenants, units, members, attendance, inventory, financials, student_portals, broadcasts };
    saveDB();
}
// Automatically load database on import
loadDB();
