import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  LegacyFinancialCategory,
  LegacyFinancialLedgerItem,
  LegacyFinancialProjections,
  MemberActor,
} from './compat.types.js';
import { MemberMapperService } from './member-mapper.service.js';

export interface PaymentInput {
  amount?: number;
  category?: LegacyFinancialCategory;
  payment_method?: string;
  anonymous?: boolean;
  note?: string;
  reference?: string;
}

const CATEGORY_TO_DB = {
  Tuition: 'TUITION',
  'Lab & Library Fees': 'LAB_LIBRARY',
  'PTA & Extracurricular': 'PTA_EXTRACURRICULAR',
  Donations: 'DONATIONS',
} as const;

const CATEGORY_FROM_DB: Record<string, LegacyFinancialCategory> = {
  TUITION: 'Tuition',
  LAB_LIBRARY: 'Lab & Library Fees',
  PTA_EXTRACURRICULAR: 'PTA & Extracurricular',
  DONATIONS: 'Donations',
};

const CATEGORIES: LegacyFinancialCategory[] = [
  'Tuition',
  'Lab & Library Fees',
  'PTA & Extracurricular',
  'Donations',
];

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: MemberMapperService,
  ) {}

  async list(tenantId: string): Promise<LegacyFinancialLedgerItem[]> {
    const transactions = await this.prisma.financeTransaction.findMany({
      where: { tenantId },
      orderBy: { transactionDate: 'desc' },
      take: 2000,
    });

    const names = await this.contributorNames(
      tenantId,
      transactions
        .map((transaction) => transaction.memberId)
        .filter((value): value is string => Boolean(value)),
    );

    return transactions.map((transaction) => ({
      id: transaction.id,
      tenant_id: transaction.tenantId,
      member_id: transaction.memberId,
      amount: Number(transaction.amount),
      category:
        CATEGORY_FROM_DB[transaction.category] ?? 'Donations',
      payment_method: transaction.paymentMethod,
      reference: transaction.reference,
      transaction_date: transaction.transactionDate.toISOString(),
      recorded_by: transaction.recordedById,
      contributorName: transaction.memberId
        ? (names.get(transaction.memberId) ?? 'Anonymous')
        : 'Anonymous',
    }));
  }

  async pay(
    input: PaymentInput,
    actor: MemberActor,
  ): Promise<{
    success: true;
    message: string;
    receipt: LegacyFinancialLedgerItem;
  }> {
    if (input.amount === undefined || input.amount === null) {
      throw new BadRequestException('Payment amount is required.');
    }

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Payment amount must be a positive number.',
      );
    }

    if (amount > 10_000_000) {
      throw new BadRequestException('Payment amount exceeds the allowed limit.');
    }

    const category = input.category;
    if (!category || !CATEGORIES.includes(category)) {
      throw new BadRequestException('Invalid payment category.');
    }

    const paymentMethod = input.payment_method?.trim();
    if (!paymentMethod) {
      throw new BadRequestException('Payment method is required.');
    }

    // Never accept raw card data. A card payment must carry a gateway
    // reference created by the payment provider.
    if (
      paymentMethod.toLowerCase() === 'card' &&
      !input.reference?.trim()
    ) {
      throw new BadRequestException(
        'Card payments require a payment-gateway reference. Raw card numbers are never accepted or stored.',
      );
    }

    const selfIds = await this.mapper.getSelfIds(actor.id, actor.tenantId);
    const memberId = input.anonymous
      ? null
      : (selfIds.studentId ?? selfIds.staffId ?? null);

    const created = await this.prisma.financeTransaction.create({
      data: {
        tenantId: actor.tenantId,
        memberId,
        amount,
        category: CATEGORY_TO_DB[category],
        paymentMethod,
        reference: input.reference?.trim() || null,
        recordedById: actor.id,
        note: input.note?.trim() || null,
      },
    });

    const names = await this.contributorNames(
      actor.tenantId,
      memberId ? [memberId] : [],
    );

    return {
      success: true,
      message: `Payment of $${amount.toFixed(2)} recorded successfully.`,
      receipt: {
        id: created.id,
        tenant_id: created.tenantId,
        member_id: created.memberId,
        amount: Number(created.amount),
        category:
          CATEGORY_FROM_DB[created.category] ?? 'Donations',
        payment_method: created.paymentMethod,
        reference: created.reference,
        transaction_date: created.transactionDate.toISOString(),
        recorded_by: created.recordedById,
        contributorName: memberId
          ? (names.get(memberId) ?? 'Anonymous')
          : 'Anonymous',
      },
    };
  }

  async projections(tenantId: string): Promise<LegacyFinancialProjections> {
    const transactions = await this.prisma.financeTransaction.findMany({
      where: { tenantId },
      select: { amount: true, category: true, transactionDate: true },
    });

    const summary: LegacyFinancialProjections['summary'] = {
      Tuition: 0,
      'Lab & Library Fees': 0,
      'PTA & Extracurricular': 0,
      Donations: 0,
      Total: 0,
    };

    for (const transaction of transactions) {
      const label =
        CATEGORY_FROM_DB[transaction.category] ?? 'Donations';
      const amount = Number(transaction.amount);
      summary[label] += amount;
      summary.Total += amount;
    }

    const weeks = buildWeekBuckets(transactions, 6);
    const last = weeks[weeks.length - 1]?.amount ?? 0;
    const previous = weeks[weeks.length - 2]?.amount ?? 0;
    const growthRatePercent =
      previous > 0
        ? Math.round(((last - previous) / previous) * 10000) / 100
        : last > 0
          ? 100
          : 0;
    const projectedNextWeek = Math.max(
      0,
      Math.round(last * (1 + growthRatePercent / 100) * 100) / 100,
    );

    return {
      summary,
      weeklyHistorical: weeks,
      transactionCount: transactions.length,
      growthRatePercent,
      projectedNextWeek,
    };
  }

  private async contributorNames(
    tenantId: string,
    memberIds: string[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(memberIds)];
    if (ids.length === 0) {
      return new Map();
    }

    const [students, staff, users] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.staff.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.user.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    const names = new Map<string, string>();
    for (const row of [...students, ...staff, ...users]) {
      names.set(
        row.id,
        [row.firstName, row.lastName].filter(Boolean).join(' ').trim(),
      );
    }

    return names;
  }
}

function buildWeekBuckets(
  transactions: Array<{ amount: unknown; transactionDate: Date }>,
  count: number,
): Array<{ name: string; amount: number }> {
  const now = new Date();
  const startOfCurrentWeek = startOfWeekUtc(now);
  const buckets: Array<{ name: string; amount: number }> = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const start = new Date(startOfCurrentWeek);
    start.setUTCDate(start.getUTCDate() - index * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const amount = transactions
      .filter(
        (transaction) =>
          transaction.transactionDate >= start &&
          transaction.transactionDate < end,
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    buckets.push({
      name: `Week of ${start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })}`,
      amount: Math.round(amount * 100) / 100,
    });
  }

  return buckets;
}

function startOfWeekUtc(date: Date): Date {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = result.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setUTCDate(result.getUTCDate() - diff);
  return result;
}
