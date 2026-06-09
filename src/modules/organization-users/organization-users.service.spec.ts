import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationUsersService } from './organization-users.service.js';
import { OrganizationUsersRepository } from './organization-users.repository.js';
import { OrganizationUserEntity } from './domain/organization-user.entity.js';
import { Role } from '../../common/enums/role.enum.js';

// ── Tenant context mock ────────────────────────────────────────────────────────
jest.mock('../../common/context/tenant.context.js', () => ({
  getTenantId: jest.fn().mockReturnValue('org-001'),
}));

// ── Helpers de factory ─────────────────────────────────────────────────────────
function makeEntity(overrides: Partial<{
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
}>): OrganizationUserEntity {
  return new OrganizationUserEntity({
    id:             overrides.id             ?? 'member-001',
    userId:         overrides.userId         ?? 'user-001',
    organizationId: overrides.organizationId ?? 'org-001',
    role:           overrides.role           ?? Role.USER,
    joinedAt:       new Date('2024-01-01'),
  });
}

// ── Mock del repository ────────────────────────────────────────────────────────
const mockRepo = {
  findById:                          jest.fn(),
  findByUserIdAndOrganizationId:     jest.fn(),
  countOwners:                       jest.fn(),
  create:                            jest.fn(),
  findManyWithCount:                 jest.fn(),
  update:                            jest.fn(),
  delete:                            jest.fn(),
};

describe('OrganizationUsersService', () => {
  let service: OrganizationUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationUsersService,
        { provide: OrganizationUsersRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<OrganizationUsersService>(OrganizationUsersService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Bloque 1: Protección del OWNER en update
  // ─────────────────────────────────────────────────────────────────────────────
  describe('update — protección OWNER', () => {
    it('lanza ForbiddenException si se intenta degradar al OWNER', async () => {
      const ownerMember = makeEntity({ id: 'member-owner', role: Role.OWNER });
      mockRepo.findById.mockResolvedValue(ownerMember);

      await expect(
        service.update('member-owner', { role: Role.ADMINISTRATOR }, 'actor-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('incluye el mensaje correcto al intentar degradar al OWNER', async () => {
      const ownerMember = makeEntity({ id: 'member-owner', role: Role.OWNER });
      mockRepo.findById.mockResolvedValue(ownerMember);

      await expect(
        service.update('member-owner', { role: Role.USER }, 'actor-001'),
      ).rejects.toThrow(/OWNER.*no puede ser degradado/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Bloque 2: Protección del OWNER en remove
  // ─────────────────────────────────────────────────────────────────────────────
  describe('remove — protección OWNER', () => {
    it('lanza ForbiddenException si se intenta eliminar al OWNER', async () => {
      const ownerMember = makeEntity({ id: 'member-owner', role: Role.OWNER });
      mockRepo.findById.mockResolvedValue(ownerMember);

      await expect(
        service.remove('member-owner', 'actor-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('incluye el mensaje correcto al intentar eliminar al OWNER', async () => {
      const ownerMember = makeEntity({ id: 'member-owner', role: Role.OWNER });
      mockRepo.findById.mockResolvedValue(ownerMember);

      await expect(
        service.remove('member-owner', 'actor-001'),
      ).rejects.toThrow(/OWNER.*no puede ser eliminado/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Bloque 3: Jerarquía de roles en update
  // ─────────────────────────────────────────────────────────────────────────────
  describe('update — jerarquía de roles', () => {
    it('lanza ForbiddenException si ADMINISTRATOR intenta modificar a otro ADMINISTRATOR', async () => {
      const targetMember = makeEntity({ id: 'member-002', role: Role.ADMINISTRATOR, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: Role.ADMINISTRATOR, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);

      await expect(
        service.update('member-002', { role: 'CAJERO' }, 'actor-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException si ADMINISTRATOR intenta ascender a alguien a OWNER', async () => {
      // Target tiene rol custom 'CAJERO' (rango 1)
      const targetMember = makeEntity({ id: 'member-002', role: 'CAJERO' as any, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: Role.ADMINISTRATOR, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);

      await expect(
        service.update('member-002', { role: Role.OWNER }, 'actor-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a OWNER (rango 3) modificar a un ADMINISTRATOR (rango 2)', async () => {
      const targetMember = makeEntity({ id: 'member-002', role: Role.ADMINISTRATOR, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: Role.OWNER, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);
      mockRepo.countOwners.mockResolvedValue(1);
      mockRepo.update.mockResolvedValue({ ...targetMember, role: 'CAJERO' });

      await expect(
        service.update('member-002', { role: 'CAJERO' }, 'actor-001'),
      ).resolves.not.toThrow();
    });

    it('permite a ADMINISTRATOR (rango 2) modificar a un rol custom (rango 1)', async () => {
      // Target tiene rol custom 'VENDEDOR'
      const targetMember = makeEntity({ id: 'member-002', role: 'VENDEDOR' as any, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: Role.ADMINISTRATOR, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);
      mockRepo.countOwners.mockResolvedValue(1);
      mockRepo.update.mockResolvedValue({ ...targetMember, role: 'CAJERO' });

      await expect(
        service.update('member-002', { role: 'CAJERO' }, 'actor-001'),
      ).resolves.not.toThrow();
    });

    it('lanza ForbiddenException si un rol custom intenta modificar a otro rol custom del mismo rango', async () => {
      const targetMember = makeEntity({ id: 'member-002', role: 'VENDEDOR' as any, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: 'CAJERO' as any, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);

      await expect(
        service.update('member-002', { role: 'OTRO' }, 'actor-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite la operación si el actor no tiene membresía en la org (GlobalRole.ADMIN global)', async () => {
      const targetMember = makeEntity({ id: 'member-002', role: Role.ADMINISTRATOR, userId: 'user-002' });

      mockRepo.findById.mockResolvedValue(targetMember);
      // Actor sin membresía en la org → GlobalRole.ADMIN global (bypass del guard)
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(null);
      mockRepo.countOwners.mockResolvedValue(1);
      mockRepo.update.mockResolvedValue({ ...targetMember, role: Role.USER });

      await expect(
        service.update('member-002', { role: Role.USER }, 'global-admin-001'),
      ).resolves.not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Bloque 4: Jerarquía de roles en remove
  // ─────────────────────────────────────────────────────────────────────────────
  describe('remove — jerarquía de roles', () => {
    it('lanza ForbiddenException si COLLABORATOR intenta eliminar a un ADMINISTRATOR', async () => {
      // Un rol custom 'CAJERO' (rango 1) no puede eliminar a un ADMINISTRATOR (rango 2)
      const targetMember = makeEntity({ id: 'member-002', role: Role.ADMINISTRATOR, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: 'CAJERO' as any, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);

      await expect(
        service.remove('member-002', 'actor-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite a OWNER eliminar a un rol custom', async () => {
      const targetMember = makeEntity({ id: 'member-002', role: 'CAJERO' as any, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: Role.OWNER, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);
      mockRepo.delete.mockResolvedValue(targetMember);

      await expect(
        service.remove('member-002', 'actor-001'),
      ).resolves.not.toThrow();
    });

    it('permite a ADMINISTRATOR eliminar a un rol custom', async () => {
      const targetMember = makeEntity({ id: 'member-002', role: 'VENDEDOR' as any, userId: 'user-002' });
      const actorMember  = makeEntity({ id: 'member-actor', role: Role.ADMINISTRATOR, userId: 'actor-001' });

      mockRepo.findById.mockResolvedValue(targetMember);
      mockRepo.findByUserIdAndOrganizationId.mockResolvedValue(actorMember);
      mockRepo.delete.mockResolvedValue(targetMember);

      await expect(
        service.remove('member-002', 'actor-001'),
      ).resolves.not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Bloque 5: NotFoundException cuando el miembro no existe
  // ─────────────────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('lanza NotFoundException si el miembro no existe', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
