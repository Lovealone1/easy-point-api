import { GlobalRole } from '@prisma/client';

export class UserEntity {
  readonly id: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phoneNumber: string | null;
  readonly isActive: boolean;
  readonly globalRole: GlobalRole;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: UserEntity) {
    this.id = params.id;
    this.email = params.email;
    this.firstName = params.firstName;
    this.lastName = params.lastName;
    this.phoneNumber = params.phoneNumber;
    this.isActive = params.isActive;
    this.globalRole = params.globalRole;
    this.lastLoginAt = params.lastLoginAt;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  static fromPrisma(raw: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    isActive: boolean;
    globalRole: GlobalRole;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserEntity {
    return new UserEntity({
      id: raw.id,
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      phoneNumber: raw.phoneNumber,
      isActive: raw.isActive,
      globalRole: raw.globalRole,
      lastLoginAt: raw.lastLoginAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
