import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from './audit.service';
import { AuditAction } from './enums/audit-action.enum';
import { AuditSeverity } from './enums/audit-severity.enum';
import { AUDIT_LOG_EVENT } from './constants/audit-events.constants';

jest.mock('../../common/context/tenant.context', () => ({
  getAuditContext: jest.fn(() => ({
    organizationId: 'org-123',
    userId: 'user-456',
    sessionId: 'session-789',
    ipAddress: '192.168.1.1',
    userAgent: 'TestAgent/1.0',
    requestId: 'req-abc',
  })),
  patchAuditContext: jest.fn(),
}));

describe('AuditService', () => {
  let service: AuditService;
  let emitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: EventEmitter2,
          useValue: { emitAsync: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    emitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  describe('logSync()', () => {
    it('emits audit event with correct action and resource', async () => {
      await service.logSync({
        action: AuditAction.CREATE,
        resourceType: 'Client',
        resourceId: 'client-001',
      });

      expect(emitter.emitAsync).toHaveBeenCalledWith(
        AUDIT_LOG_EVENT,
        expect.objectContaining({
          action: AuditAction.CREATE,
          resourceType: 'Client',
          resourceId: 'client-001',
        }),
      );
    });

    it('enriches event with AsyncLocalStorage context', async () => {
      await service.logSync({ action: AuditAction.UPDATE, resourceType: 'Sale' });

      expect(emitter.emitAsync).toHaveBeenCalledWith(
        AUDIT_LOG_EVENT,
        expect.objectContaining({
          tenantId: 'org-123',
          userId: 'user-456',
          sessionId: 'session-789',
          ipAddress: '192.168.1.1',
          requestId: 'req-abc',
        }),
      );
    });

    it('sanitizes password fields from before/after', async () => {
      await service.logSync({
        action: AuditAction.UPDATE,
        resourceType: 'User',
        before: { name: 'Alice', password: 'old_secret' },
        after: { name: 'Alice B', password: 'new_secret' },
      });

      const event = (emitter.emitAsync as jest.Mock).mock.calls[0][1];
      expect((event.before as any).password).toBe('[REDACTED]');
      expect((event.after as any).password).toBe('[REDACTED]');
      expect((event.before as any).name).toBe('Alice');
    });

    it('computes changedFields diff automatically', async () => {
      await service.logSync({
        action: AuditAction.UPDATE,
        resourceType: 'Client',
        before: { name: 'Acme', creditLimit: '500.00', phone: '123' },
        after: { name: 'Acme Corp', creditLimit: '1000.00', phone: '123' },
      });

      const event = (emitter.emitAsync as jest.Mock).mock.calls[0][1];
      expect(event.changedFields).toHaveProperty('name');
      expect(event.changedFields).toHaveProperty('creditLimit');
      expect(event.changedFields).not.toHaveProperty('phone');
      expect(event.changedFields.name).toEqual({ before: 'Acme', after: 'Acme Corp' });
    });

    it('does not overwrite manually provided changedFields', async () => {
      const manualDiff = { status: { before: 'ACTIVE', after: 'CANCELLED' } };
      await service.logSync({
        action: AuditAction.CANCEL,
        resourceType: 'Sale',
        changedFields: manualDiff,
        before: { status: 'ACTIVE', note: 'x' },
        after: { status: 'CANCELLED', note: 'y' },
      });

      const event = (emitter.emitAsync as jest.Mock).mock.calls[0][1];
      expect(event.changedFields).toEqual(manualDiff);
    });

    it('infers CRITICAL severity for LOGIN_FAILED', async () => {
      await service.logSync({ action: AuditAction.LOGIN_FAILED, resourceType: 'Session' });
      const event = (emitter.emitAsync as jest.Mock).mock.calls[0][1];
      expect(event.severity).toBe(AuditSeverity.CRITICAL);
    });

    it('infers HIGH severity for DELETE', async () => {
      await service.logSync({ action: AuditAction.DELETE, resourceType: 'Client' });
      const event = (emitter.emitAsync as jest.Mock).mock.calls[0][1];
      expect(event.severity).toBe(AuditSeverity.HIGH);
    });

    it('allows caller to override default severity', async () => {
      await service.logSync({
        action: AuditAction.DELETE,
        resourceType: 'TestResource',
        severity: AuditSeverity.MEDIUM,
      });
      const event = (emitter.emitAsync as jest.Mock).mock.calls[0][1];
      expect(event.severity).toBe(AuditSeverity.MEDIUM);
    });

    it('falls back to "system" tenantId when context has no organizationId', async () => {
      const { getAuditContext } = require('../../common/context/tenant.context');
      (getAuditContext as jest.Mock).mockReturnValueOnce({ organizationId: null });

      await service.logSync({ action: AuditAction.CUSTOM, resourceType: 'System' });

      const event = (emitter.emitAsync as jest.Mock).mock.calls[0][1];
      expect(event.tenantId).toBe('system');
    });
  });

  describe('log()', () => {
    it('emits event asynchronously without throwing', (done) => {
      service.log({ action: AuditAction.LOGIN, resourceType: 'Session' });

      setImmediate(() => {
        expect(emitter.emitAsync).toHaveBeenCalled();
        done();
      });
    });
  });
});
