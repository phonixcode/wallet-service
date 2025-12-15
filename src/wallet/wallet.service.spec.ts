import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from 'prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: PrismaService;
  const testRunId = Date.now().toString();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletService, PrismaService],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prisma = module.get<PrismaService>(PrismaService);

    await prisma.transaction.deleteMany();
    await prisma.wallet.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a wallet', async () => {
    const wallet = await service.createWallet('USD');
    expect(wallet).toHaveProperty('id');
    expect(wallet.balance).toBe(0);
    expect(wallet.currency).toBe('USD');
  });

  it('should fund a wallet', async () => {
    const wallet = await service.createWallet('USD');
    const funded = await service.fundWallet(
      wallet.id,
      1000,
      `fund-${testRunId}`,
    );
    expect(funded.balance).toBe(1000);

    const txs = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
      },
    });
    expect(txs.length).toBe(1);
    expect(txs[0].type).toBe(TransactionType.FUND);
  });

  it('should transfer between wallets', async () => {
    const sender = await service.createWallet('USD');
    const receiver = await service.createWallet('USD');

    // Fund sender
    await service.fundWallet(sender.id, 2000);

    const txRef = `tx-${testRunId}`;
    const result = await service.transfer(sender.id, receiver.id, 1500, txRef);
    expect(result.status).toBe('success');

    const senderUpdated = await service.getWallet(sender.id);
    const receiverUpdated = await service.getWallet(receiver.id);

    expect(senderUpdated.balance).toBe(500);
    expect(receiverUpdated.balance).toBe(1500);

    // Ledger entries
    const txs = await prisma.transaction.findMany({
      where: {
        OR: [{ reference: `${txRef}-out` }, { reference: `${txRef}-in` }],
      },
    });
    expect(txs.length).toBe(2);
    expect(
      txs.find((t) => t.type === TransactionType.TRANSFER_OUT),
    ).toBeDefined();
    expect(
      txs.find((t) => t.type === TransactionType.TRANSFER_IN),
    ).toBeDefined();
  });

  it('should fail transfer with insufficient funds', async () => {
    const sender = await service.createWallet('USD');
    const receiver = await service.createWallet('USD');

    await service.fundWallet(sender.id, 500);

    await expect(
      service.transfer(sender.id, receiver.id, 1000),
    ).rejects.toThrow(ConflictException);
  });

  it('should fail if wallet not found', async () => {
    await expect(service.fundWallet('nonexistent', 100)).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.transfer('nonexistent-1', 'nonexistent-2', 100),
    ).rejects.toThrow(NotFoundException);
  });

  it('should prevent transfer to same wallet', async () => {
    const wallet = await service.createWallet('USD');
    await expect(service.transfer(wallet.id, wallet.id, 100)).rejects.toThrow();
  });
});
