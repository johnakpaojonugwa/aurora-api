# Aurora E-Commerce Backend

Production-ready NestJS backend for the **Aurora Boutique E-Commerce** platform. Built using modular architecture, secure authentication, role-based controls, transactional safety with Prisma, and high-performance asynchronous workflows.

---

## 🚀 Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database ORM**: [Prisma](https://www.prisma.io/) (PostgreSQL)
- **Caching & Key-Value Store**: [Redis](https://redis.io/) (via `ioredis`)
- **Queue System**: [BullMQ](https://bullmq.io/) (via `@nestjs/bull`)
- **Email Service**: [Resend](https://resend.com/) (using the Resend API Client)
- **Authentication**: JWT access & refresh tokens, MFA (TOTP with [Speakeasy](https://github.com/speakeasyjs/speakeasy) & QR Code)
- **Security & Performance**: [Helmet](https://helmetjs.github.io/), HTTP compression, cookie parser, and class-validator validations
- **Logging**: [Pino](https://github.com/pinojs/pino) (via `nestjs-pino` and `pino-pretty`)

---

## 📁 Project Structure

```text
src/
├── main.ts                          # Application entry point & global configurations
├── app.module.ts                    # Root module configuring global providers & modules
├── common/
│   ├── decorators/
│   │   ├── public.decorator.ts      # Skips JWT authentication
│   │   ├── roles.decorator.ts       # Assigns required roles for RBAC
│   │   └── user.decorator.ts        # Injects authenticated user context into route parameters
│   ├── filters/
│   │   └── http-exception.filter.ts # Maps HTTP exceptions into standard error envelopes
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        # Protects endpoints via JWT verification
│   │   └── roles.guard.ts           # Enforces Role-Based Access Control (RBAC)
│   └── interceptors/
│       └── transform.interceptor.ts # Wraps successful responses in standard envelopes
│
├── modules/
│   ├── auth/                        # Registration, login, MFA, and JWT rotation logic
│   ├── products/                    # Catalog search, filtering, and CRUD operations
│   ├── users/                       # User management skeleton module
│   ├── cart/                        # Shopping cart skeleton module
│   ├── orders/                      # Orders management skeleton module
│   ├── payments/                    # Payments & Stripe integrations skeleton module
│   ├── email/                       # Email service dispatch module using Resend
│   └── analytics/                   # Business analytics skeleton module
│
├── config/
│   ├── configuration.ts            # Environment variables configuration loader
│   ├── validation-schema.ts        # Joi validation schema for environment variables
│   └── constants.ts                # Shared constants (metadata keys, defaults)
│
├── database/
│   ├── prisma/
│   │   └── schema.prisma           # Prisma Database schema models
│   ├── prisma.module.ts
│   └── prisma.service.ts           # Database connection lifecycle controller
│
├── queue/                           # Queue handling module wrapper
└── redis/                           # Redis Client wrapper service
```

---

## ⚙️ Environment Variables Setup

Create a `.env` file in the root directory and define the following variables:

```ini
# Application configuration
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aurora_db?schema=public"

# Authentication Secrets
JWT_SECRET="generate-a-secure-random-jwt-access-key-here"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_SECRET="generate-a-secure-random-jwt-refresh-key-here"
JWT_REFRESH_EXPIRATION="7d"

# Cache & Queues (Redis)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Resend Email Integration
RESEND_API_KEY="re_your_api_key"

# Stripe Payments (Optional skeleton configuration)
STRIPE_SECRET_KEY="sk_test_..."
```

---

## 🛠️ Development & Production Commands

### 1. Database Operations
```bash
# Introspect/generate Prisma client definitions
npx prisma generate

# Create and apply migrations (requires database server running)
npx prisma migrate dev --name init
```

### 2. Run the Application
> **Note**: For development watch mode, run `npm run start:dev` (not `npm run dev`).

```bash
# Development (watch mode)
npm run start:dev

# Development (normal run)
npm run start

# Compile / Build the application
npm run build

# Production mode
npm run start:prod
```

---

## 🔒 Core API Endpoints

All success API routes are encapsulated in a standard `{ success: true, data }` response envelope. All error responses conform to `{ success: false, statusCode, message, errors, timestamp, path }`.

### 🛡️ Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/auth/register` | Public | Register a new user profile & triggers verification email |
| **POST** | `/auth/login` | Public | Verifies credentials; returns JWT tokens or flags MFA requirement |
| **POST** | `/auth/verify-mfa` | Public | Verifies the MFA OTP code to complete login sequence |
| **POST** | `/auth/refresh` | Public | Rotates expired access tokens using valid refresh tokens |
| **POST** | `/auth/logout` | JWT Auth | Invalidates active user session |
| **POST** | `/auth/mfa/setup` | JWT Auth | Initiates MFA registration (returns shared secret & QR code data URI) |
| **POST** | `/auth/mfa/enable`| JWT Auth | Confirms and locks in the MFA secret using a verification code |

### 🛍️ Products Catalog Endpoints (`/api/v1/products`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/products` | Public | Retrieves filterable, paginated products list |
| **GET** | `/products/search`| Public | Case-insensitive product search by name, desc, tags |
| **GET** | `/products/:id` | Public | Retrieves specific product details & increments views |
| **POST** | `/products` | Admin / Manager | Creates a new product catalog item |
| **PUT** | `/products/:id` | Admin / Manager | Updates product details, price, SKU, or variation |
| **DELETE**| `/products/:id` | Admin | Deletes product catalog item |

### 🛒 Shopping Cart Endpoints (`/api/v1/cart`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/cart` | JWT Auth | Retrieves active user cart state mapped to flat JSON schema |
| **POST** | `/cart/add` | JWT Auth | Appends a product variation/quantity to the user shopping cart |

### 💳 Checkout Endpoints (`/api/v1/checkout`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/checkout` | JWT Auth | Submits shipping address and payment token; processes transaction and stock safety |

### 📊 Admin Analytics & Dashboard Overview (`/api/v1/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/dashboard-overview` | Admin / Manager | Consolidated telemetry (total sales, orders, customers count, alerts, recent orders) |
| **GET** | `/admin/analytics/sales` | Admin / Manager | Fetch breakdown of sales trends by day/week/month or region |
| **GET** | `/admin/analytics/products` | Admin | Retrieves product performance analytics |
| **GET** | `/admin/analytics/customers` | Admin | Retrieves customer order and registration analytics |
| **GET** | `/admin/analytics/inventory` | Admin / Manager | Retrieves category stock status analysis |

### 👥 Admin User Management (`/api/v1/admin/users`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/admin/users` | Admin | Lists all manager and admin team accounts |
| **POST** | `/admin/users` | Admin | Provisions a new manager or admin user |
| **PUT** | `/admin/users/role` | Admin | Updates user role assignment by email (Security Hardened) |
| **PUT** | `/admin/users/status` | Admin | Toggles user active/suspension status by email |
| **PUT** | `/admin/users/:id/role` | Admin | *Deprecated*: Updates role assignment by user ID |
| **PUT** | `/admin/users/:id/suspend` | Admin | *Deprecated*: Suspends user account logon by user ID |
| **PUT** | `/admin/users/:id/activate` | Admin | *Deprecated*: Restores user account logon by user ID |

