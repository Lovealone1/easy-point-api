import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountBillingController } from './account-billing.controller.js';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';
import { UsersService } from '../users/users.service.js';
import { UserInfoService } from '../user-info/user-info.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

describe('Account settings', () => {
  let account: AccountController;
  let billing: AccountBillingController;
  let usersService: jest.Mocked<UsersService>;
  let userInfoService: jest.Mocked<UserInfoService>;

  const CALLER = 'user-signed-in';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountController, AccountBillingController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            requestEmailOtp: jest.fn(),
            verifyEmailOtp: jest.fn(),
          },
        },
        {
          provide: UserInfoService,
          useValue: {
            getBillingProfile: jest.fn(),
            createPersonaNatural: jest.fn(),
            createPersonaJuridica: jest.fn(),
            deleteBillingProfile: jest.fn(),
          },
        },
      ],
    })
      // These call the controller methods directly; the guard is what puts the
      // caller id on the request in production and has its own spec.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    account = module.get(AccountController);
    billing = module.get(AccountBillingController);
    usersService = module.get(UsersService);
    userInfoService = module.get(UserInfoService);
  });

  // The entire authorisation model of these routes: there is no id in the
  // path, so every call is pinned to whoever the token says is calling. A
  // regression here would turn account settings into "edit any user".
  describe('acts only on the caller', () => {
    it('reads the caller profile', async () => {
      await account.getProfile(CALLER);
      expect(usersService.findOne).toHaveBeenCalledWith(CALLER);
    });

    it('updates the caller profile', async () => {
      await account.updateProfile(CALLER, { firstName: 'Ana' });
      expect(usersService.update).toHaveBeenCalledWith(CALLER, { firstName: 'Ana' });
    });

    it('starts the email change on the caller account', async () => {
      await account.requestEmailChange(CALLER, { newEmail: 'nuevo@easypoint.app' });
      expect(usersService.requestEmailOtp).toHaveBeenCalledWith(CALLER, {
        newEmail: 'nuevo@easypoint.app',
      });
    });

    it('confirms the email change on the caller account', async () => {
      await account.confirmEmailChange(CALLER, { newEmail: 'nuevo@easypoint.app', otp: '123456' });
      expect(usersService.verifyEmailOtp).toHaveBeenCalledWith(CALLER, {
        newEmail: 'nuevo@easypoint.app',
        otp: '123456',
      });
    });

    it('reads and removes the caller billing profile', async () => {
      await billing.get(CALLER);
      await billing.remove(CALLER);
      expect(userInfoService.getBillingProfile).toHaveBeenCalledWith(CALLER);
      expect(userInfoService.deleteBillingProfile).toHaveBeenCalledWith(CALLER);
    });

    it('creates the caller billing profile, in either shape', async () => {
      await billing.createPersonaNatural(CALLER, { numeroDocumento: '123' } as never);
      await billing.createPersonaJuridica(CALLER, { nit: '900' } as never);
      expect(userInfoService.createPersonaNatural).toHaveBeenCalledWith(CALLER, {
        numeroDocumento: '123',
      });
      expect(userInfoService.createPersonaJuridica).toHaveBeenCalledWith(CALLER, { nit: '900' });
    });
  });

  describe('UpdateMyProfileDto', () => {
    // Driven through the same pipe main.ts installs. Validating the DTO
    // directly would prove nothing about the extra field: it is the pipe's
    // `forbidNonWhitelisted` that rejects it, not the class.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });

    const asBody = { type: 'body' as const, metatype: UpdateMyProfileDto };

    it('accepts the three fields a person owns', async () => {
      const body = { firstName: 'Ana', lastName: 'Ruiz', phoneNumber: '+573001234567' };

      await expect(pipe.transform(body, asBody)).resolves.toEqual(body);
    });

    it('rejects isActive, so nobody can suspend themselves through the profile form', async () => {
      // Reusing UsersService's UpdateUserDto — which does carry isActive —
      // would have let a user lock themselves out of their own account
      // through the profile form, with no way back in.
      await expect(pipe.transform({ isActive: false }, asBody)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an email, so the address cannot skip its verification', async () => {
      await expect(
        pipe.transform({ email: 'otro@easypoint.app' }, asBody),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
