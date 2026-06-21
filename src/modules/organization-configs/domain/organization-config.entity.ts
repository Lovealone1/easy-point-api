import { Theme } from '@prisma/client';

export class OrganizationConfigEntity {
  readonly id: string;
  readonly organizationId: string;
  
  logoUrl: string | null;
  logoShortUrl: string | null;
  primaryColor: string | null;
  defaultTheme: Theme;
  
  timezone: string;
  currency: string;
  language: string;
  dateFormat: string;
  
  taxId: string | null;
  address: string | null;
  phone: string | null;
  receiptFooter: string | null;

  readonly organizationName: string;
  readonly organizationEmail: string | null;
  readonly plan: string;
  readonly planActiveUntil: Date | null;
  readonly organizationIsActive: boolean;
  readonly organizationCreatedAt?: Date;

  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    logoUrl: string | null;
    logoShortUrl: string | null;
    primaryColor: string | null;
    defaultTheme: Theme;
    timezone: string;
    currency: string;
    language: string;
    dateFormat: string;
    taxId: string | null;
    address: string | null;
    phone: string | null;
    receiptFooter: string | null;
    createdAt: Date;
    updatedAt: Date;
    organizationName: string;
    organizationEmail: string | null;
    plan: string;
    planActiveUntil: Date | null;
    organizationIsActive: boolean;
    organizationCreatedAt?: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.logoUrl = params.logoUrl;
    this.logoShortUrl = params.logoShortUrl;
    this.primaryColor = params.primaryColor;
    this.defaultTheme = params.defaultTheme;
    this.timezone = params.timezone;
    this.currency = params.currency;
    this.language = params.language;
    this.dateFormat = params.dateFormat;
    this.taxId = params.taxId;
    this.address = params.address;
    this.phone = params.phone;
    this.receiptFooter = params.receiptFooter;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
    this.organizationName = params.organizationName;
    this.organizationEmail = params.organizationEmail;
    this.plan = params.plan;
    this.planActiveUntil = params.planActiveUntil;
    this.organizationIsActive = params.organizationIsActive;
    this.organizationCreatedAt = params.organizationCreatedAt;
  }

  static fromPrisma(raw: any): OrganizationConfigEntity {
    const activeSub = raw.organization?.subscriptions?.[0];
    const planName = activeSub?.plan?.name?.toUpperCase() ?? 'FREE';
    const planActiveUntil = activeSub?.currentPeriodEnd ?? null;
    return new OrganizationConfigEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      logoUrl: raw.logoUrl,
      logoShortUrl: raw.logoShortUrl,
      primaryColor: raw.primaryColor,
      defaultTheme: raw.defaultTheme,
      timezone: raw.timezone,
      currency: raw.currency,
      language: raw.language,
      dateFormat: raw.dateFormat,
      taxId: raw.taxId,
      address: raw.address,
      phone: raw.phone,
      receiptFooter: raw.receiptFooter,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      organizationName: raw.organization?.name || '',
      organizationEmail: raw.organization?.email || null,
      plan: planName,
      planActiveUntil: planActiveUntil,
      organizationIsActive: raw.organization?.isActive ?? true,
      organizationCreatedAt: raw.organization?.createdAt,
    });
  }
}
