import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../common/email/email.service.js';
import type {
  LegacyBroadcast,
  LegacyBroadcastCategory,
  MemberActor,
} from './compat.types.js';
import { MemberMapperService, toLegacyRole } from './member-mapper.service.js';

export interface BroadcastInput {
  target?: 'all' | 'unit' | 'first-timers';
  unitId?: string | null;
  category?: LegacyBroadcastCategory;
  title?: string;
  message?: string;
  event_date?: string;
  attachment?: Record<string, unknown> | null;
  bulk_mail?: boolean;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: MemberMapperService,
    private readonly emailService: EmailService,
  ) {}

  async list(
    tenantId: string,
    actor: MemberActor,
  ): Promise<LegacyBroadcast[]> {
    const broadcasts = await this.prisma.broadcast.findMany({
      where: { tenantId },
      orderBy: { sentAt: 'desc' },
      take: 500,
      include: {
        sender: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    const unitIds = await this.visibleUnitIds(tenantId, actor);
    const visible =
      unitIds === null
        ? broadcasts
        : broadcasts.filter(
            (broadcast) =>
              broadcast.target === 'all' ||
              broadcast.target === 'first-timers' ||
              (broadcast.target === 'unit' &&
                broadcast.unitId !== null &&
                unitIds.includes(broadcast.unitId)),
          );

    return visible.map((broadcast) => this.mapBroadcast(broadcast));
  }

  async send(
    input: BroadcastInput,
    actor: MemberActor,
  ): Promise<{
    success: true;
    recipientCount: number;
    recipients: string[];
    broadcast: LegacyBroadcast;
    message: string;
  }> {
    const title = input.title?.trim();
    const message = input.message?.trim();
    const target = input.target ?? 'all';
    const category = input.category ?? 'impromptu';

    if (!title || !message) {
      throw new BadRequestException(
        'Broadcast title and message body are required.',
      );
    }

    if (!['all', 'unit', 'first-timers'].includes(target)) {
      throw new BadRequestException('Invalid broadcast target.');
    }

    if (
      !['assignment', 'test', 'impromptu', 'curriculum'].includes(category)
    ) {
      throw new BadRequestException('Invalid broadcast category.');
    }

    const unitId = await this.resolveTargetUnit(input.unitId, actor);
    if (target === 'unit' && !unitId) {
      throw new BadRequestException(
        'A target unit is required for unit broadcasts.',
      );
    }

    const members = await this.mapper.listRawMembers(actor.tenantId, {
      status: 'Active',
    });

    const recipients = members.filter((member) => {
      if (target === 'all') {
        return true;
      }
      if (target === 'unit') {
        return member.unit_id === unitId;
      }
      const joined = new Date(member.joined_date).getTime();
      return (
        Number.isFinite(joined) &&
        joined >= Date.now() - 30 * 24 * 60 * 60 * 1000
      );
    });

    const recipientEmails = new Set<string>();
    if (input.bulk_mail) {
      for (const member of recipients) {
        if (member.email) recipientEmails.add(member.email);
        if (member.guardian_email) recipientEmails.add(member.guardian_email);
      }
    }

    const eventDate = input.event_date
      ? parseDateOnly(input.event_date)
      : null;

    const emailConfigured = this.emailService.isConfigured();
    const shouldEmail =
      Boolean(input.bulk_mail) &&
      emailConfigured &&
      recipientEmails.size > 0;

    if (shouldEmail && recipientEmails.size > 10_000) {
      throw new BadRequestException(
        'Bulk email is limited to 10,000 recipients per broadcast.',
      );
    }

    const created = await this.prisma.broadcast.create({
      data: {
        tenantId: actor.tenantId,
        senderId: actor.id,
        target,
        unitId: target === 'unit' ? unitId : null,
        category,
        title,
        message,
        eventDate,
        attachment: (input.attachment ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        bulkMailed: shouldEmail,
        recipientCount: shouldEmail
          ? recipientEmails.size
          : recipients.length,
      },
      include: {
        sender: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    if (shouldEmail) {
      const school = await this.prisma.school.findUnique({
        where: { id: actor.tenantId },
        select: { name: true },
      });

      // Delivery runs after the response so a large recipient list cannot hold
      // the HTTP request open. The broadcast row records that email delivery
      // was queued; failures are logged for the operator.
      void this.deliverBroadcastEmails(
        [...recipientEmails],
        title,
        message,
        school?.name ?? 'SchoolBook',
      ).catch((error) => {
        this.logger.error(
          `Broadcast email delivery failed for broadcast ${created.id}: ${String(error)}`,
        );
      });
    }

    if (category === 'curriculum' && input.attachment) {
      await this.appendPortalAttachment(
        actor.tenantId,
        target === 'unit' ? unitId : null,
        input.attachment,
        actor,
      );
    }

    const recipientCount = shouldEmail
      ? recipientEmails.size
      : recipients.length;

    return {
      success: true,
      recipientCount,
      recipients: recipients.slice(0, 10).map((member) => member.name),
      broadcast: this.mapBroadcast(created),
      message: input.bulk_mail
        ? shouldEmail
          ? `Broadcast sent to ${recipientCount} members and queued for email delivery.`
          : `Broadcast posted to ${recipientCount} members. Email delivery is not configured on this deployment.`
        : `Broadcast sent to ${recipientCount} members.`,
    };
  }

  private async deliverBroadcastEmails(
    emails: string[],
    title: string,
    message: string,
    schoolName: string,
  ): Promise<void> {
    const queue = [...emails];
    const workerCount = Math.min(10, queue.length);
    let failed = 0;

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          const email = queue.shift();
          if (!email) break;

          try {
            await this.emailService.sendBroadcastEmail(
              email,
              title,
              message,
              schoolName,
            );
          } catch {
            failed += 1;
          }
        }
      }),
    );

    if (failed > 0) {
      this.logger.error(
        `Broadcast email delivery failed for ${failed} of ${emails.length} recipients.`,
      );
    } else {
      this.logger.log(
        `Broadcast email delivered to ${emails.length} recipients.`,
      );
    }
  }

  private async resolveTargetUnit(
    requestedUnitId: string | null | undefined,
    actor: MemberActor,
  ): Promise<string | null> {
    if (requestedUnitId) {
      return requestedUnitId;
    }

    const staff = await this.prisma.staff.findFirst({
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { departmentId: true },
    });

    return staff?.departmentId ?? null;
  }

  private async visibleUnitIds(
    tenantId: string,
    actor: MemberActor,
  ): Promise<string[] | null> {
    if (actor.role === 'STUDENT') {
      const student = await this.prisma.student.findFirst({
        where: { userId: actor.id, tenantId },
        select: { unitId: true },
      });
      return student?.unitId ? [student.unitId] : [];
    }

    if (actor.role === 'PARENT' || actor.role === 'GUARDIAN') {
      const guardian = await this.prisma.guardian.findFirst({
        where: { userId: actor.id, tenantId },
        select: {
          students: {
            select: {
              student: { select: { unitId: true } },
            },
          },
        },
      });

      return (
        guardian?.students
          .map((link) => link.student.unitId)
          .filter((value): value is string => Boolean(value)) ?? []
      );
    }

    return null;
  }

  private mapBroadcast(broadcast: any): LegacyBroadcast {
    return {
      id: broadcast.id,
      tenant_id: broadcast.tenantId,
      sender_id: broadcast.senderId,
      sender_name: [
        broadcast.sender?.firstName,
        broadcast.sender?.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim(),
      sender_role: toLegacyRole(broadcast.sender?.role, null),
      target: broadcast.target,
      unit_id: broadcast.unitId,
      category: broadcast.category,
      title: broadcast.title,
      message: broadcast.message,
      event_date: broadcast.eventDate
        ? new Date(broadcast.eventDate).toISOString().slice(0, 10)
        : undefined,
      attachment: broadcast.attachment ?? undefined,
      bulk_mailed: broadcast.bulkMailed,
      recipient_count: broadcast.recipientCount,
      sent_at: new Date(broadcast.sentAt).toISOString(),
    };
  }

  private async appendPortalAttachment(
    tenantId: string,
    unitId: string | null,
    attachment: Record<string, unknown>,
    actor: MemberActor,
  ): Promise<void> {
    const title =
      typeof attachment.name === 'string' && attachment.name.trim()
        ? attachment.name.trim()
        : 'Curriculum Syllabus Document';

    const portalAttachment = JSON.stringify([
      {
        title,
        filename: title,
        uploaded_by: `${actor.firstName} ${actor.lastName}`.trim(),
        date: new Date().toISOString(),
      },
    ]);

    if (unitId) {
      await this.prisma.$executeRaw`
        UPDATE "StudentPortal"
        SET "syllabusAttachments" = COALESCE("syllabusAttachments", '[]'::jsonb) || ${portalAttachment}::jsonb,
            "updatedAt" = NOW()
        WHERE "tenantId" = ${tenantId}
          AND "studentId" IN (
            SELECT "id" FROM "Student"
            WHERE "tenantId" = ${tenantId} AND "unitId" = ${unitId}
          )
      `;
      return;
    }

    await this.prisma.$executeRaw`
      UPDATE "StudentPortal"
      SET "syllabusAttachments" = COALESCE("syllabusAttachments", '[]'::jsonb) || ${portalAttachment}::jsonb,
          "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}
    `;
  }
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('event_date must use YYYY-MM-DD.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid event date.');
  }

  return date;
}
