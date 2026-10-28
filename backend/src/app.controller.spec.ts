import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { SupabaseService } from './supabase/supabase.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: SupabaseService,
          useValue: {
            isConfigured: () => false,
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  }, 30000);

  describe('root', () => {
    it('should return service status', () => {
      const result = appController.getStatus();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('schoolbook-backend');
    });
  });
});
