## Description

This is a simple wallet service built with NestJS, TypeScript, Prisma, and SQLite.  
**It supports:**

- Creating wallets
- Funding wallets (with idempotency)
- Transferring funds between wallets
- Fetching wallet details and transaction history

It is designed with atomic operations, ledger integrity, and basic idempotency, making it a strong foundation for more complex financial applications.

## Tech Stack

- **NestJS** – Framework for building scalable Node.js apps
- **TypeScript** – Strongly typed JavaScript
- **Prisma ORM** – Database access with custom output path
- **SQLite** – Simple relational database for local development/testing
- **Jest & Supertest** – Unit and e2e testing

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/phonixcode/wallet-service.git
cd wallet-service
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
DATABASE_URL="file:./prisma/database.sqlite"
```

> **Note:** The database file will be created automatically when you run migrations.

### 4. Generate Prisma Client

The Prisma client is generated to a custom output path (`generated/prisma`). Generate it with:

```bash
npx prisma generate
```

### 5. Run Database Migrations

```bash
npx prisma migrate deploy
```

Or if you need to create a new migration:

```bash
npx prisma migrate dev
```

### 6. Start the Application

```bash
# Development mode (with watch)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will start on `http://localhost:3000` by default.

## Running Tests

### Unit Tests

```bash
npm run test
```

**Test Results:**
```
PASS src/app.controller.spec.ts
PASS src/wallet/wallet.service.spec.ts
PASS src/wallet/wallet.controller.spec.ts

Test Suites: 3 passed, 3 total
Tests:       8 passed, 8 total
Snapshots:   0 total
Time:        ~2.8s
```

### E2E Tests

```bash
npm run test:e2e
```

**Test Results:**
```
PASS test/app.e2e-spec.ts
PASS test/wallet/wallet.e2e-spec.ts

Test Suites: 2 passed, 2 total
Tests:       7 passed, 7 total
Snapshots:   0 total
Time:        ~2.3s
```

### Test Coverage

```bash
npm run test:cov
```

## API Endpoints

### Base URL
```
http://localhost:3000
```

### 1. Create Wallet

**Endpoint:** `POST /wallets`

**Request Body:**
```json
{
  "currency": "USD"
}
```

**Response (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "currency": "USD",
  "balance": 0,
  "createdAt": "2025-12-15T19:37:45.000Z",
  "updatedAt": "2025-12-15T19:37:45.000Z"
}
```

**Example using cURL:**
```bash
curl -X POST http://localhost:3000/wallets \
  -H "Content-Type: application/json" \
  -d '{"currency": "USD"}'
```

---

### 2. Fund Wallet

**Endpoint:** `POST /wallets/:id/fund`

**Request Body:**
```json
{
  "amount": 2000,
  "reference": "fund-001"
}
```

**Parameters:**
- `amount` (required): Amount in cents (integer, minimum 1)
- `reference` (optional): Idempotency key - prevents duplicate funding if the same reference is used

**Response (201 Created):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "currency": "USD",
  "balance": 2000,
  "createdAt": "2025-12-15T19:37:45.000Z",
  "updatedAt": "2025-12-15T19:40:00.000Z"
}
```

**Example using cURL:**
```bash
curl -X POST http://localhost:3000/wallets/a1b2c3d4-e5f6-7890-abcd-ef1234567890/fund \
  -H "Content-Type: application/json" \
  -d '{"amount": 2000, "reference": "fund-001"}'
```

**Idempotency:** If you call this endpoint again with the same `reference`, it will return the same wallet state without creating a duplicate transaction.

---

### 3. Transfer Between Wallets

**Endpoint:** `POST /wallets/transfer`

**Request Body:**
```json
{
  "fromWalletId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "toWalletId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "amount": 1500,
  "reference": "tx-001"
}
```

**Parameters:**
- `fromWalletId` (required): UUID of the source wallet
- `toWalletId` (required): UUID of the destination wallet
- `amount` (required): Amount in cents (integer, minimum 1)
- `reference` (optional): Idempotency key

**Response (201 Created):**
```json
{
  "status": "success",
  "fromWalletId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "toWalletId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "amount": 1500
}
```

**Example using cURL:**
```bash
curl -X POST http://localhost:3000/wallets/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "fromWalletId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "toWalletId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "amount": 1500,
    "reference": "tx-001"
  }'
```

**Features:**
- Prevents negative balances (returns `409 Conflict` if insufficient funds)
- Prevents transfers to the same wallet (returns `400 Bad Request`)
- Atomic operation - both debit and credit happen in a single transaction
- Creates ledger entries for both wallets (TRANSFER_OUT and TRANSFER_IN)
- Idempotent if `reference` is provided

**Error Responses:**

**Insufficient Balance (409 Conflict):**
```json
{
  "statusCode": 409,
  "message": "Insufficient balance",
  "error": "Conflict"
}
```

**Same Wallet Transfer (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Cannot transfer to same wallet",
  "error": "Bad Request"
}
```

**Wallet Not Found (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Wallet not found",
  "error": "Not Found"
}
```

---

### 4. Fetch Wallet Details

**Endpoint:** `GET /wallets/:id`

**Response (200 OK):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "currency": "USD",
  "balance": 500,
  "createdAt": "2025-12-15T19:37:45.000Z",
  "updatedAt": "2025-12-15T19:45:00.000Z",
  "transactions": [
    {
      "id": "t1x2y3z4-a5b6-7890-cdef-123456789012",
      "walletId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "FUND",
      "amount": 2000,
      "reference": "fund-001",
      "createdAt": "2025-12-15T19:40:00.000Z"
    },
    {
      "id": "t2x3y4z5-b6c7-8901-def0-234567890123",
      "walletId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "type": "TRANSFER_OUT",
      "amount": 1500,
      "reference": "tx-001-out",
      "createdAt": "2025-12-15T19:45:00.000Z"
    }
  ]
}
```

**Transaction Types:**
- `FUND` - Money added to the wallet
- `TRANSFER_IN` - Money received from another wallet
- `TRANSFER_OUT` - Money sent to another wallet

**Example using cURL:**
```bash
curl http://localhost:3000/wallets/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Error Response (404 Not Found):**
```json
{
  "statusCode": 404,
  "message": "Wallet not found",
  "error": "Not Found"
}
```


## Quick Start Example

After setting up the project, here's a quick example of using the API:

```bash
# 1. Create a wallet
WALLET_A=$(curl -s -X POST http://localhost:3000/wallets \
  -H "Content-Type: application/json" \
  -d '{"currency": "USD"}' | jq -r '.id')

echo "Created Wallet A: $WALLET_A"

# 2. Create another wallet
WALLET_B=$(curl -s -X POST http://localhost:3000/wallets \
  -H "Content-Type: application/json" \
  -d '{"currency": "USD"}' | jq -r '.id')

echo "Created Wallet B: $WALLET_B"

# 3. Fund Wallet A
curl -X POST http://localhost:3000/wallets/$WALLET_A/fund \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "reference": "initial-fund"}'

# 4. Transfer from Wallet A to Wallet B
curl -X POST http://localhost:3000/wallets/transfer \
  -H "Content-Type: application/json" \
  -d "{
    \"fromWalletId\": \"$WALLET_A\",
    \"toWalletId\": \"$WALLET_B\",
    \"amount\": 2000,
    \"reference\": \"transfer-001\"
  }"

# 5. Check Wallet A balance
curl http://localhost:3000/wallets/$WALLET_A | jq '.balance'
# Expected: 3000 (5000 - 2000)
```

## Key Features

### Atomic Operations
All wallet operations use database transactions to ensure data consistency. If any part of an operation fails, the entire operation is rolled back.

### Idempotency
Both funding and transfer operations support idempotency through the `reference` field. If you retry an operation with the same reference, it will return the existing result without creating duplicates.

### Ledger Integrity
Every transfer creates two transaction records:
- `TRANSFER_OUT` for the sender
- `TRANSFER_IN` for the receiver

This ensures a complete audit trail of all wallet movements.

### Validation
- Currency must be "USD" (extensible to other currencies)
- Amounts must be positive integers (in cents)
- Wallet IDs must be valid UUIDs
- Prevents negative balances
- Prevents transfers to the same wallet

## Database Management

### View Database Schema

```bash
npx prisma studio
```

This opens Prisma Studio at `http://localhost:5555` where you can view and edit your database.

### Reset Database

```bash
npx prisma migrate reset
```

**Warning:** This will delete all data in your database.

### Create New Migration

After modifying `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name your_migration_name
```

## Troubleshooting

### Prisma Client Not Found
If you see errors about Prisma client, make sure you've generated it:
```bash
npx prisma generate
```

### Database Connection Issues
Ensure your `.env` file has the correct `DATABASE_URL`:
```
DATABASE_URL="file:./prisma/database.sqlite"
```

### Port Already in Use
If port 3000 is already in use, you can change it in `src/main.ts`:
```typescript
await app.listen(3001); // Change to your preferred port
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
