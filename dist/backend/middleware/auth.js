import { collections } from '../db/db.js';
// Authenticates the request user and ensures they belong to the current active tenant
export function authMiddleware(req, res, next) {
    const userId = req.headers['x-user-id'] || req.query.userId;
    const tenantId = req.tenantId;
    if (!userId || typeof userId !== 'string') {
        return res.status(401).json({
            error: 'Authentication required. Please set the "X-User-ID" header.'
        });
    }
    const members = collections.getMembers();
    const matchedUser = members.find(m => m.id === userId && m.tenant_id === tenantId);
    if (!matchedUser) {
        return res.status(401).json({
            error: 'Invalid session. User does not exist under the active tenant.'
        });
    }
    req.user = matchedUser;
    next();
}
// Restricts routes to specific roles (e.g. Principal, Dean, Teacher)
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Access Denied: Role "${req.user.role}" does not have privileges for this action.`
            });
        }
        next();
    };
}
// Restricts route to a set of department/faculty names, but permits the Principal to bypass
export function requireUnitOrPrincipal(allowedUnitKeywords) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }
        // Principal has absolute administrative control over all areas of the school
        if (req.user.role === 'Principal') {
            return next();
        }
        // Check if the user has an associated unit/faculty
        if (!req.user.unit_id) {
            return res.status(403).json({
                error: 'Access Denied: You do not belong to a department or faculty responsible for this operation.'
            });
        }
        // Load unit details
        const units = collections.getUnits();
        const userUnit = units.find(u => u.id === req.user?.unit_id);
        if (!userUnit) {
            return res.status(403).json({ error: 'Access Denied: Associated department not found.' });
        }
        // Verify if unit name contains any of the allowed keywords (e.g. "science", "bursar", "admin", "athletic")
        const unitNameLower = userUnit.name.toLowerCase();
        const isAuthorized = allowedUnitKeywords.some(keyword => unitNameLower.includes(keyword.toLowerCase()));
        if (!isAuthorized) {
            return res.status(403).json({
                error: `Access Denied: Members of faculty/unit "${userUnit.name}" do not have permissions for this action.`
            });
        }
        next();
    };
}
