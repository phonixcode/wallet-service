import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../prisma/prisma.service';

describe('WalletController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let walletAId: string;
  let walletBId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    prisma = app.get(PrismaService);

    await prisma.transaction.deleteMany();
    await prisma.wallet.deleteMany();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create two wallets', async () => {
    const resA = await request(app.getHttpServer())
      .post('/wallets')
      .send({ currency: 'USD' })
      .expect(201);

    const resB = await request(app.getHttpServer())
      .post('/wallets')
      .send({ currency: 'USD' })
      .expect(201);

    expect(resA.body).toHaveProperty('id');
    expect(resB.body).toHaveProperty('id');
    walletAId = resA.body.id;
    walletBId = resB.body.id;
  });

  it('should fund wallet A', async () => {
    const res = await request(app.getHttpServer())
      .post(`/wallets/${walletAId}/fund`)
      .send({ amount: 2000, reference: 'fund-001' })
      .expect(201);

    expect(res.body.balance).toBe(2000);

    // Idempotency test
    const resDuplicate = await request(app.getHttpServer())
      .post(`/wallets/${walletAId}/fund`)
      .send({ amount: 2000, reference: 'fund-001' })
      .expect(201);

    expect(resDuplicate.body.balance).toBe(2000); // balance unchanged
  });

  it('should transfer from wallet A to wallet B', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromWalletId: walletAId,
        toWalletId: walletBId,
        amount: 1500,
        reference: 'tx-001',
      })
      .expect(201);

    expect(res.body.status).toBe('success');

    // Check balances
    const walletA = await request(app.getHttpServer())
      .get(`/wallets/${walletAId}`)
      .expect(200);

    const walletB = await request(app.getHttpServer())
      .get(`/wallets/${walletBId}`)
      .expect(200);

    expect(walletA.body.balance).toBe(500);
    expect(walletB.body.balance).toBe(1500);
  });

  it('should prevent transfer with insufficient funds', async () => {
    await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromWalletId: walletAId,
        toWalletId: walletBId,
        amount: 1000,
      })
      .expect(409); // ConflictException
  });

  it('should prevent transfer to same wallet', async () => {
    await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromWalletId: walletAId,
        toWalletId: walletAId,
        amount: 100,
      })
      .expect(400); // BadRequestException
  });

  it('should return 404 for nonexistent wallet', async () => {
    const nonexistentUuid = '00000000-0000-0000-0000-000000000000';

    await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromWalletId: nonexistentUuid,
        toWalletId: walletBId,
        amount: 100,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/wallets/${nonexistentUuid}/fund`)
      .send({ amount: 100 })
      .expect(404);
  });
});
