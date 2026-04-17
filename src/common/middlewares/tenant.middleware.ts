import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { tenantContextStorage, TenantContext } from '../context/tenant.context.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) { }

  async use(req: Request, res: Response, next: NextFunction) {
    let organizationId =
      (req.headers['x-organization-id'] as string) ||
      (req.params?.organizationId as string) ||
      (req.params?.orgId as string) ||
      (req.query?.organizationId as string) ||
      (req.body?.organizationId as string) ||
      null;

    if (!organizationId && req.params?.id) {
      const paramId = req.params.id as string;
      if (req.originalUrl?.includes('/organization-users')) {
        const orgUserRecord = await this.prisma.organizationUser.findUnique({
          where: { id: paramId },
          select: { organizationId: true }
        });
        if (orgUserRecord) {
          organizationId = orgUserRecord.organizationId;
        } else {
          // If we can't resolve the associated organization, we might allow the request to fail down-stream
          // but logging or tracking could occur here.
        }
      } else {
        organizationId = paramId; // Fallback if they are directly querying the ORG endpoint
      }
    }

    const bypassTenant = req.headers['x-bypass-tenant'] === 'true';

    const state: TenantContext = {
      organizationId,
      bypassTenant,
    };

    tenantContextStorage.run(state, () => {
      next();
    });
  }
}
