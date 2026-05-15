import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuditConsumer } from './audit.consumer';
import { AuditRepository } from './audit.repository';
import { AuditAction } from './enums/audit-action.enum';
import { AuditSeverity } from './enums/audit-severity.enum';
import type { AuditLogEvent } from './interfaces/audit-log-event.interface';

const mockEvent: AuditLogEvent = {
  tenantId: 'org-001',
  userId: 'user-001',
  action: AuditAction.UPDATE,
  resourceType: 'Client',
  resourceId: 'client-001',
  before: { name: 'Old Name' },
  after: { name: 'New Name' },
  changedFields: { name: { before: 'Old Name', after: 'New Name' } },
  severity: AuditSeverity.MEDIUM,
  requestId: 'req-001',
  sessionId: 'session-001',
  ipAddress: '10.0.0.1',
  userAgent: 'TestBrowser/1.0',
};

describe('AuditConsumer', () => {
  let consumer: AuditConsumer;
  let repository: { create: jest.Mock };
  let stdoutSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    repository = { create: jest.fn().mockResolvedValue({ id: 'audit-001', ...mockEvent }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditConsumer,
        { provide: AuditRepository, useValue: repository },
      ],
    }).compile();

    consumer = module.get<AuditConsumer>(AuditConsumer);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => { 
    stdoutSpy.mockRestore(); 
    loggerErrorSpy.mockRestore();
    jest.clearAllMocks(); 
  });

  it('persists the audit event via AuditRepository', async () => {
    await consumer.handleAuditEvent(mockEvent);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'org-001',
        userId: 'user-001',
        action: 'UPDATE',
        resourceType: 'Client',
      }),
    );
  });

  it('writes a structured JSON line to stdout', async () => {
    await consumer.handleAuditEvent(mockEvent);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('"type":"audit"'));

    const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
    expect(parsed.type).toBe('audit');
    expect(parsed.tenantId).toBe('org-001');
    expect(parsed.action).toBe(AuditAction.UPDATE);
    expect(parsed.changedFieldKeys).toEqual(['name']);
  });

  it('does NOT propagate errors from the repository', async () => {
    repository.create.mockRejectedValueOnce(new Error('DB connection lost'));
    await expect(consumer.handleAuditEvent(mockEvent)).resolves.not.toThrow();
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('includes all changedFieldKeys in structured log', async () => {
    const event: AuditLogEvent = {
      ...mockEvent,
      changedFields: {
        name: { before: 'A', after: 'B' },
        email: { before: 'a@a.com', after: 'b@b.com' },
        phone: { before: '111', after: '222' },
      },
    };
    await consumer.handleAuditEvent(event);
    const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
    expect(parsed.changedFieldKeys).toEqual(expect.arrayContaining(['name', 'email', 'phone']));
  });

  it('outputs undefined changedFieldKeys when changedFields absent', async () => {
    await consumer.handleAuditEvent({ ...mockEvent, changedFields: undefined });
    const parsed = JSON.parse((stdoutSpy.mock.calls[0][0] as string).trim());
    expect(parsed.changedFieldKeys).toBeUndefined();
  });
});
