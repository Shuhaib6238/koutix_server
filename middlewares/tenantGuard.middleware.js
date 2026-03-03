/**
 * tenantGuard — Step 5 of middleware stack
 * 
 * Ensures that PARTNER users can only access resources
 * belonging to their own tenant (organization).
 * SuperAdmin can access any tenant's resources.
 * Customers are not tenant-bound.
 */
const tenantGuard = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // SuperAdmin bypasses tenant check
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'SuperAdmin') {
        return next();
    }

    // Customers are not tenant-bound
    if (req.user.type === 'CUSTOMER' || req.user.role === 'CUSTOMER') {
        return next();
    }

    // PARTNER users — ensure they have a tenant
    const userTenantId = req.user.tenantId?._id || req.user.tenantId || req.user.org_id;

    if (!userTenantId) {
        return res.status(403).json({ message: 'Forbidden: No tenant association found' });
    }

    // If a specific tenant resource is being accessed (via params or body),
    // verify it matches the user's tenant
    const requestedTenantId = req.params.tenantId || req.body?.tenantId || req.params.orgId;

    if (requestedTenantId && requestedTenantId.toString() !== userTenantId.toString()) {
        return res.status(403).json({ message: 'Forbidden: Cross-tenant access denied' });
    }

    // Attach tenantId for downstream use
    req.tenantId = userTenantId;

    next();
};

module.exports = tenantGuard;
