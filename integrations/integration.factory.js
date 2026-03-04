const SAPAdapter = require('./adapters/sap.adapter');
const OdooAdapter = require('./adapters/odoo.adapter');
const GenericAdapter = require('./adapters/generic.adapter');
const ManualAdapter = require('./adapters/manual.adapter');

/**
 * IntegrationFactory — returns the correct POS adapter based on integrationType
 */
class IntegrationFactory {
    static getAdapter(integration) {
        switch (integration.integrationType) {
            case 'SAP':
                return new SAPAdapter(integration);
            case 'ODOO':
                return new OdooAdapter(integration);
            case 'GENERIC_API':
                return new GenericAdapter(integration);
            case 'MANUAL':
                return new ManualAdapter(integration);
            default:
                throw new Error(`Unknown integration type: ${integration.integrationType}`);
        }
    }
}

module.exports = IntegrationFactory;
