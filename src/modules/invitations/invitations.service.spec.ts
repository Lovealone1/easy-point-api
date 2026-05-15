import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsService } from './invitations.service.js';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InvitationsRepository } from './invitations.repository.js';
import { OrganizationUsersRepository } from '../organization-users/organization-users.repository.js';
import appConfig from '../../common/config/config.js';
import { Role } from '../../common/enums/role.enum.js';
import { InvitationStatus } from '@prisma/client';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { MailService } from '../../infraestructure/mail/mail.service.js';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let invitationsRepository: jest.Mocked<InvitationsRepository>;
  let orgUsersRepository: jest.Mocked<OrganizationUsersRepository>;
  let prismaService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        {
          provide: appConfig.KEY,
          useValue: { jwt: { secret: 'secret' }, app: { frontendUrl: 'http://localhost:3000' } },
        },
        {
          provide: InvitationsRepository,
          useValue: {
            findByEmailAndOrg: jest.fn(),
            create: jest.fn(),
            findByToken: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: OrganizationUsersRepository,
          useValue: { findByUserIdAndOrganizationId: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            organization: { findUnique: jest.fn() },
            role: { findUnique: jest.fn() },
            organizationUser: { create: jest.fn() },
            invitation: { update: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { sendMail: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
    invitationsRepository = module.get(InvitationsRepository);
    orgUsersRepository = module.get(OrganizationUsersRepository);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvitation', () => {
    it('should throw if role is OWNER', async () => {
      await expect(service.createInvitation('org-id', { email: 'test@test.com', role: Role.OWNER }))
        .rejects.toThrow(BadRequestException);
    });

    it('should create invitation successfully', async () => {
      invitationsRepository.findByEmailAndOrg.mockResolvedValueOnce(null);
      invitationsRepository.create.mockResolvedValueOnce({ id: 'inv-id', token: 'token' } as any);
      prismaService.organization.findUnique.mockResolvedValueOnce({ name: 'Test Org' });
      prismaService.role.findUnique.mockResolvedValueOnce({ id: 'role-id', name: 'ADMINISTRATOR' });

      const result = await service.createInvitation('org-id', { email: 'test@test.com', role: Role.ADMINISTRATOR });
      expect(result.invitationId).toBe('inv-id');
      expect(invitationsRepository.create).toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return base response and no temp token', async () => {
      invitationsRepository.findByToken.mockResolvedValueOnce({
        id: 'inv-id',
        email: 'test@test.com',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        role: { name: Role.USER },
        organization: { name: 'Org Name' }
      } as any);

      const result = await service.verifyToken('valid-token');
      expect(result.email).toBe('test@test.com');
      expect((result as any).tempInviteToken).toBeUndefined();
    });

    it('should throw if invitation expired', async () => {
      invitationsRepository.findByToken.mockResolvedValueOnce({
        id: 'inv-id',
        email: 'test@test.com',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 100000),
      } as any);

      await expect(service.verifyToken('expired-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptInvitation', () => {
    it('should throw if email mismatch', async () => {
      invitationsRepository.findByToken.mockResolvedValueOnce({
        id: 'inv-id',
        email: 'invited@test.com',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
      } as any);

      await expect(service.acceptInvitation('user-id', 'wrong@test.com', 'token'))
        .rejects.toThrow(BadRequestException);
    });

    it('should accept invitation successfully', async () => {
      invitationsRepository.findByToken.mockResolvedValueOnce({
        id: 'inv-id',
        email: 'invited@test.com',
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 100000),
        organizationId: 'org-id',
        roleId: 'role-id'
      } as any);

      orgUsersRepository.findByUserIdAndOrganizationId.mockResolvedValueOnce(null);

      await service.acceptInvitation('user-id', 'invited@test.com', 'token');
      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });
});
