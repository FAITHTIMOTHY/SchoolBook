import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SupabaseService } from './supabase/supabase.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    const supabaseService = {
      isConfigured: () => false,
    } as unknown as SupabaseService;

    const appService = new AppService(supabaseService);
    appController = new AppController(appService);
  });

  describe('root', () => {
    it('should return service status', () => {
      const result = appController.getStatus();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('schoolbook-backend');
    });
  });
});
