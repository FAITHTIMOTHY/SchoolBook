import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  LegacyInventoryItem,
  LegacyInventoryStatus,
  MemberActor,
} from './compat.types.js';

export interface InventoryInput {
  item_name?: string;
  description?: string;
  status?: LegacyInventoryStatus;
  unit_id?: string | null;
}

const STATUS_TO_DB = {
  Active: 'ACTIVE',
  Faulty: 'FAULTY',
  Unavailable: 'UNAVAILABLE',
} as const;

const STATUS_FROM_DB: Record<string, LegacyInventoryStatus> = {
  ACTIVE: 'Active',
  FAULTY: 'Faulty',
  UNAVAILABLE: 'Unavailable',
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<LegacyInventoryItem[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => this.mapItem(item));
  }

  async create(
    input: InventoryInput,
    actor: MemberActor,
  ): Promise<LegacyInventoryItem> {
    const itemName = input.item_name?.trim();
    const status = input.status ?? 'Active';

    if (!itemName) {
      throw new BadRequestException('Item name is required.');
    }

    if (!STATUS_TO_DB[status]) {
      throw new BadRequestException(
        'Invalid status value. Must be Active, Faulty, or Unavailable.',
      );
    }

    const unit = await this.resolveUnit(actor.tenantId, input.unit_id);

    const created = await this.prisma.inventoryItem.create({
      data: {
        tenantId: actor.tenantId,
        itemName,
        description: input.description?.trim() || '',
        status: STATUS_TO_DB[status],
        unitId: unit?.unitId ?? null,
        unitKind: unit?.unitKind ?? null,
      },
    });

    return this.mapItem(created);
  }

  async update(
    id: string,
    input: InventoryInput,
    actor: MemberActor,
  ): Promise<LegacyInventoryItem> {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Equipment item not found.');
    }

    if (input.status && !STATUS_TO_DB[input.status]) {
      throw new BadRequestException(
        'Invalid status value. Must be Active, Faulty, or Unavailable.',
      );
    }

    const unit =
      input.unit_id !== undefined
        ? await this.resolveUnit(actor.tenantId, input.unit_id)
        : undefined;

    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(input.item_name !== undefined
          ? { itemName: input.item_name.trim() }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() }
          : {}),
        ...(input.status !== undefined
          ? { status: STATUS_TO_DB[input.status] }
          : {}),
        ...(unit !== undefined
          ? { unitId: unit?.unitId ?? null, unitKind: unit?.unitKind ?? null }
          : {}),
      },
    });

    return this.mapItem(updated);
  }

  async remove(
    id: string,
    tenantId: string,
  ): Promise<{ success: true; message: string }> {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Equipment item not found.');
    }

    await this.prisma.inventoryItem.delete({ where: { id } });

    return {
      success: true,
      message: 'Campus asset deleted successfully.',
    };
  }

  private async resolveUnit(
    tenantId: string,
    unitId?: string | null,
  ): Promise<{ unitId: string; unitKind: string } | null> {
    if (!unitId) {
      return null;
    }

    const department = await this.prisma.department.findFirst({
      where: { id: unitId, tenantId },
      select: { id: true },
    });
    if (department) {
      return { unitId: department.id, unitKind: 'DEPARTMENT' };
    }

    const classroom = await this.prisma.classroom.findFirst({
      where: { id: unitId, tenantId },
      select: { id: true },
    });
    if (classroom) {
      return { unitId: classroom.id, unitKind: 'CLASSROOM' };
    }

    throw new BadRequestException('Selected unit does not exist on this campus.');
  }

  private mapItem(item: {
    id: string;
    tenantId: string;
    itemName: string;
    description: string;
    status: string;
    unitId: string | null;
    updatedAt: Date;
  }): LegacyInventoryItem {
    return {
      id: item.id,
      tenant_id: item.tenantId,
      item_name: item.itemName,
      description: item.description,
      status: STATUS_FROM_DB[item.status] ?? 'Active',
      unit_id: item.unitId,
      updated_at: item.updatedAt.toISOString(),
    };
  }
}
