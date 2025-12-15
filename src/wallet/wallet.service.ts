import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { TransactionType } from '../../generated/prisma';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async createWallet(currency: string) {
    return this.prisma.wallet.create({
      data: {
        currency,
        balance: 0,
      },
    });
  }

  async getWallet(id: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
      include: { transactions: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async fundWallet(walletId: string, amount: number, reference?: string) {
    return this.prisma.$transaction(async (tx) => {
      // Idempotency check
      if (reference) {
        const existing = await tx.transaction.findUnique({
          where: { reference },
        });

        if (existing) {
          return tx.wallet.findUnique({
            where: { id: walletId },
            include: { transactions: true },
          });
        }
      }

      // Fetch wallet
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Update balance
      const updatedWallet = await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: wallet.balance + amount,
        },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          walletId,
          amount,
          type: TransactionType.FUND,
          reference,
        },
      });

      return updatedWallet;
    });
  }

  async transfer(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    reference?: string,
  ) {
    if (fromWalletId === toWalletId) {
      throw new BadRequestException('Cannot transfer to same wallet');
    }

    return this.prisma.$transaction(async (tx) => {
      // Idempotency check
      if (reference) {
        const existing = await tx.transaction.findUnique({
          where: { reference: `${reference}-out` },
        });

        if (existing) {
          return { status: 'duplicate', reference };
        }
      }

      // Fetch wallets WITHIN transaction
      const [sender, receiver] = await Promise.all([
        tx.wallet.findUnique({ where: { id: fromWalletId } }),
        tx.wallet.findUnique({ where: { id: toWalletId } }),
      ]);

      if (!sender || !receiver) {
        throw new NotFoundException('Wallet not found');
      }

      // Balance check (inside tx)
      if (sender.balance < amount) {
        throw new ConflictException('Insufficient balance');
      }

      // Update balances
      await tx.wallet.update({
        where: { id: sender.id },
        data: { balance: sender.balance - amount },
      });

      await tx.wallet.update({
        where: { id: receiver.id },
        data: { balance: receiver.balance + amount },
      });

      // Record Ledger entries
      await tx.transaction.createMany({
        data: [
          {
            walletId: sender.id,
            amount,
            type: TransactionType.TRANSFER_OUT,
            reference: reference ? `${reference}-out` : undefined,
          },
          {
            walletId: receiver.id,
            amount,
            type: TransactionType.TRANSFER_IN,
            reference: reference ? `${reference}-in` : undefined,
          },
        ],
      });

      return {
        status: 'success',
        fromWalletId,
        toWalletId,
        amount,
      };
    });
  }
}
