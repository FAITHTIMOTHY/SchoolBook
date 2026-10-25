import { Body, Controller, Get, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { LegacyFinancialCategory } from './compat.types.js';
import { FINANCE_ROLES } from './compat.types.js';
import { FinanceService, type PaymentInput } from './finance.service.js';

export class PaymentDto implements PaymentInput {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(10_000_000)
  amount?: number;

  @IsOptional()
  @IsIn([
    'Tuition',
    'Lab & Library Fees',
    'PTA & Extracurricular',
    'Donations',
  ])
  category?: LegacyFinancialCategory;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  payment_method?: string;

  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;
}

@Controller('financials')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Roles(...FINANCE_ROLES)
  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.financeService.list(actor.tenantId);
  }

  @Post('pay')
  pay(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PaymentDto,
  ) {
    return this.financeService.pay(dto, actor);
  }

  @Roles(...FINANCE_ROLES)
  @Get('projections')
  projections(@CurrentUser() actor: AuthenticatedUser) {
    return this.financeService.projections(actor.tenantId);
  }
}
