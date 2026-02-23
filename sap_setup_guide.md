# SAP BTP Trial Integration Guide

This guide covers how to set up an SAP BTP Trial account and integrate it with the Koutix server for inventory synchronization and billing.

## 1. SAP BTP Trial Setup

1.  **Register**: Go to [SAP BTP Trial](https://account.hanatrial.ondemand.com/) and create an account.
2.  **Create Subaccount**: Once in the cockpit, create a trial subaccount (usually in the US East or Europe region).
3.  **Enable Entitlements**:
    - Go to **Entitlements** -> **Configure Entitlements**.
    - Add **Integration Suite** (Trial plan).
    - Add **Process Integration Runtime** (api plan).
4.  **Subscribe to Integration Suite**:
    - Go to **Services** -> **Service Marketplace**.
    - Find **Integration Suite** and click **Create**.
5.  **Assign Roles**:
    - Go to **Security** -> **Users**.
    - Assign the `Integration_Provisioner` role to yourself to set up the suite.

## 2. Configure Cloud Integration (iFlows)

1.  **Launch Integration Suite**: Open the Integration Suite dashboard.
2.  **Activate Capability**: Click "Manage Capabilities" and activate **Cloud Integration**.
3.  **Create Integration Package**: Go to **Design** -> **Create**.
4.  **Create iFlow (Inventory Sync)**:
    - **Sender**: HTTPS adapter (Endpoint: `/InventorySync`).
    - **Logic**: Map SAP Material data to Koutix JSON format.
    - **Receiver**: HTTPS adapter (Endpoint: `https://your-server.com/api/sap/sync-inventory`).
5.  **Deploy**: Once configured, click **Deploy**.

## 3. Create Service Instance (API Access)

1.  **Create Instance**: Go to **Services** -> **Instances and Subscriptions**.
2.  **Create**:
    - Service: **Process Integration Runtime**.
    - Plan: **api**.
    - Create a Service Key.
3.  **Get Credentials**: The Service Key will provide:
    - `clientid`
    - `clientsecret`
    - `url` (Management API URL)
    - `tokenurl` (XSUAA Token URL)

## 4. Server Configuration

Update your `.env` file with the credentials from the Service Key:

```text
# SAP BTP Integration
SAP_IT_RT_URL=https://[your-subdomain].it-cpitrial03-rt.cfapps.ap21.hana.ondemand.com
SAP_TOKEN_URL=https://[your-subdomain].authentication.ap21.hana.ondemand.com/oauth/token
SAP_CLIENT_ID=[your-client-id]
SAP_CLIENT_SECRET=[your-client-secret]
SAP_API_BASE=/http/koutix
SAP_WEBHOOK_SECRET=your-chosen-secret-for-validation
```

## 5. Testing the Integration

### Outgoing (Server -> SAP)

Use the existing test script to verify the server can get an access token and call SAP:

```bash
node -e "require('./services/sap.service').getAccessToken().then(console.log).catch(console.error)"
```

### Incoming (SAP -> Webhook)

Simulate SAP calling your backend:

```bash
node scripts/testSapSync.js
```

---

### Key Endpoints for SAP

- **Inventory Webhook**: `POST /api/sap/sync-inventory`
- **Bill Webhook**: `POST /api/sap/bill-update`
