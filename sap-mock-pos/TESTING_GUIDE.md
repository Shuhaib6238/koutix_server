# Testing Guide for Mock SAP POS Server

This guide explains how to start and test the mock server locally.

## 1. Start the Server

Open a terminal, navigate to the `sap-mock-pos` folder, and run:

```powershell
cd "c:\Users\shuha\OneDrive\Desktop\koutix server\sap-mock-pos"
npm start
```

You should see: `SAP Mock POS running on 3000`

---

## 2. Test Endpoints
kj
You can test these using **Postman** or **cURL** in another terminal.

### Health Check

**URL:** `GET http://localhost:3000/health`

```bash
curl http://localhost:3000/health
```

**Expected Response:** `{"status": "SAP POS Mock Running"}`

### Get Products

**URL:** `GET http://localhost:3000/api/products`

```bash
curl http://localhost:3000/api/products
```

### Get Stock

**URL:** `GET http://localhost:3000/api/stock`

```bash
curl http://localhost:3000/api/stock
```

### Create Bill (POST)

**URL:** `POST http://localhost:3000/api/bill`
**Body (JSON):**

```json
{
  "items": [
    { "id": "P1001", "quantity": 2 },
    { "id": "P1002", "quantity": 1 }
  ],
  "total": 685
}
```

**cURL Command:**

```bash
curl -X POST http://localhost:3000/api/bill \
     -H "Content-Type: application/json" \
     -d '{"items": [{"id": "P1001", "quantity": 2}], "total": 640}'
```

---

## 3. Verify in Terminal

When you send a POST request to `/api/bill`, check the terminal where the server is running. You should see:
`Incoming Bill: { items: [ ... ], total: ... }`
