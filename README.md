# Koutix Server

Retail SaaS backend for supermarkets in UAE and Saudi Arabia.

## Tech Stack

- **Runtime**: Node.js 20 LTS + Express.js
- **Database**: MongoDB Atlas (Mongoose)
- **Auth**: Firebase Admin SDK (tokens + custom claims)
- **Cache/Jobs**: Redis (AWS ElastiCache) + BullMQ
- **Storage**: AWS S3 + CloudFront CDN
- **Payments**: Stripe (platform subscriptions only)
- **Email**: Resend.com (branch invites only)
- **Validation**: Zod
- **Logging**: Winston + Morgan
- **Security**: helmet, cors, hpp, express-rate-limit, express-mongo-sanitize

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all values — see .env.example for descriptions
```

### 3. Required 3rd-party setup

| Service           | Setup                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Firebase**      | Create project → Enable Email/Phone auth → Generate service account key → Add to .env       |
| **MongoDB Atlas** | Create cluster → Create db user → Whitelist IPs → Copy connection string                    |
| **Stripe**        | Get API keys → Create products/prices (AED) → Set up webhook endpoint                       |
| **AWS S3**        | Create bucket `koutix-media-prod` in `me-south-1` → Block public access → Set up CloudFront |
| **Resend**        | Get API key → Verify `koutix.com` domain DNS                                                |

### 4. Generate encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add output to ENCRYPTION_KEY in .env
```

### 5. Run development server

```bash
npm run dev
```

### 6. Verify

```bash
curl http://localhost:8080/health
```

## Project Structure

```
├── app.js                    # Express app with all middleware and routes
├── server.js                 # Entry point — init services and start server
├── src/
│   ├── config/
│   │   ├── env.js            # envalid env validation (crashes on missing vars)
│   │   ├── db.js             # MongoDB connection with retry
│   │   ├── redis.js          # ioredis client with TLS
│   │   └── firebase.js       # Firebase Admin SDK init
│   ├── controllers/
│   │   ├── auth.controller.js     # Chain + standalone signup, sync-user, set-password
│   │   ├── chain.controller.js    # Branch CRUD + Resend invite
│   │   ├── store.controller.js    # Geospatial queries, products
│   │   ├── branch.controller.js   # Orders, inventory, POS management
│   │   ├── admin.controller.js    # Stats, store/user admin
│   │   ├── webhook.controller.js  # Stripe webhook handler
│   │   ├── upload.controller.js   # S3 presigned URL generation
│   │   └── product.controller.js  # Barcode lookup
│   ├── middleware/
│   │   ├── auth.middleware.js          # Firebase token verification
│   │   ├── role.middleware.js          # Role-based access control
│   │   ├── validate.middleware.js      # Zod schema validation
│   │   ├── rateLimiter.middleware.js   # Rate limiting
│   │   └── error.middleware.js         # Global error handler
│   ├── models/
│   │   ├── User.js, Chain.js, Store.js, Product.js, Order.js, PosConfig.js
│   ├── routes/
│   │   ├── auth.routes.js, chain.routes.js, store.routes.js, branch.routes.js
│   │   ├── admin.routes.js, webhook.routes.js, upload.routes.js
│   │   ├── product.routes.js, order.routes.js, pos.routes.js
│   ├── services/
│   │   ├── stripe.service.js      # Stripe customer + subscription
│   │   ├── resend.service.js      # Branch invite emails
│   │   └── pos/                   # Universal POS connectors
│   │       ├── posService.js, cegidConnector.js, openbravoConnector.js
│   │       ├── odooConnector.js, lightspeedConnector.js
│   │       ├── sapConnector.js, oracleConnector.js
│   ├── jobs/
│   │   └── posSyncJob.js         # BullMQ sync every 5 min
│   └── utils/
│       ├── response.js, paginate.js, logger.js, encrypt.js, awsS3Service.js
```

## API Endpoints

### Public (no auth)

| Method | Path                               | Description                    |
| ------ | ---------------------------------- | ------------------------------ |
| GET    | `/health`                          | Health check                   |
| POST   | `/auth/signup/chain`               | Chain manager signup           |
| POST   | `/auth/signup/standalone`          | Standalone store signup        |
| POST   | `/auth/sync-user`                  | Sync Firebase user to MongoDB  |
| POST   | `/auth/set-password`               | Activate branch invite         |
| GET    | `/stores/nearby?lat=&lng=&radius=` | Nearby stores (promoted first) |
| GET    | `/stores/promoted?lat=&lng=`       | Promoted stores (20km)         |
| GET    | `/stores/:id`                      | Store details                  |

### Customer (Firebase auth)

| Method | Path                          | Description        |
| ------ | ----------------------------- | ------------------ |
| GET    | `/stores/:id/products`        | Paginated products |
| GET    | `/products/barcode/:barcode`  | Barcode lookup     |
| GET    | `/stores/:id/operating-hours` | Operating hours    |

### Branch Manager

| Method   | Path                   | Description          |
| -------- | ---------------------- | -------------------- |
| GET      | `/branch/orders`       | List orders          |
| PATCH    | `/orders/:id/status`   | Update order status  |
| GET      | `/branch/inventory`    | List products        |
| PATCH    | `/branch/products/:id` | Update product       |
| GET/POST | `/branch/pos/*`        | POS status/sync/test |

### Chain Manager

| Method | Path                  | Description              |
| ------ | --------------------- | ------------------------ |
| POST   | `/chain/branches`     | Add branch + send invite |
| GET    | `/chain/branches`     | List branches            |
| PATCH  | `/chain/branches/:id` | Update branch            |
| DELETE | `/chain/branches/:id` | Deactivate branch        |

### Super Admin

| Method | Path                             | Description            |
| ------ | -------------------------------- | ---------------------- |
| GET    | `/admin/stats`                   | Platform statistics    |
| GET    | `/admin/stores`                  | All stores (paginated) |
| PATCH  | `/admin/stores/:id/approve`      | Approve store          |
| PATCH  | `/admin/stores/:id/subscription` | Update subscription    |
| GET    | `/admin/users`                   | All users              |
| PATCH  | `/admin/users/:id/role`          | Update user role       |
| GET    | `/admin/promotions`              | Promoted stores        |

### Common

| Method | Path                    | Description    |
| ------ | ----------------------- | -------------- |
| POST   | `/upload/presigned-url` | S3 upload URL  |
| POST   | `/webhooks/stripe`      | Stripe webhook |

## Developers

- **Shuhaib** (Backend 1) — Foundation, auth, chain, store, admin, POS, Stripe
- **Rashid** (Backend 2) — Orders, payments, refunds (see `TODO:RASHID` markers)

## License

ISC
