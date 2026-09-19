import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, SessionScope } from '@prisma/client';
import { RolesGuard } from './roles.guard.js';

/**
 * RolesGuard carries the session split across the whole codebase: every
 * global-admin endpoint already declares @Roles(GlobalRole.ADMIN), so making
 * this guard demand a console session puts all of them behind the console
 * sign-in without editing a single controller.
 */
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector);
  });

  const contextFor = (user: unknown): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as any;

  it('lets an unguarded route through', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('rejects a caller without the required global role', () => {
    reflector.getAllAndOverride.mockReturnValue([GlobalRole.ADMIN]);

    expect(() =>
      guard.canActivate(contextFor({ role: GlobalRole.USER, scope: SessionScope.ADMIN })),
    ).toThrow(ForbiddenException);
  });

  it('rejects a global admin who is only on a dashboard session', () => {
    // The regression this guards against: before the split, this call
    // succeeded, which is why typing /admin while signed into an organization
    // opened the console with no further questions.
    reflector.getAllAndOverride.mockReturnValue([GlobalRole.ADMIN]);

    expect(() =>
      guard.canActivate(contextFor({ role: GlobalRole.ADMIN, scope: SessionScope.TENANT })),
    ).toThrow(ForbiddenException);
  });

  it('admits a global admin on a console session', () => {
    reflector.getAllAndOverride.mockReturnValue([GlobalRole.ADMIN]);

    expect(
      guard.canActivate(contextFor({ role: GlobalRole.ADMIN, scope: SessionScope.ADMIN })),
    ).toBe(true);
  });

  it('does not demand a console session for routes that ask for a non-admin role', () => {
    // The extra requirement is tied to GlobalRole.ADMIN specifically, so an
    // ordinary role check keeps working on a dashboard session.
    reflector.getAllAndOverride.mockReturnValue([GlobalRole.USER]);

    expect(
      guard.canActivate(contextFor({ role: GlobalRole.USER, scope: SessionScope.TENANT })),
    ).toBe(true);
  });
});
