import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FindAdminDashboardDto, AdminDashboardGranularity } from './dto/find-admin-dashboard.dto.js';

export interface TrendItem {
  label: string;
  organizations: number;
  salesCount: number;
  salesVolume: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async getStats(dto: FindAdminDashboardDto) {
    const { startDate, endDate } = this.getPeriodRange(dto);

    // 1. All-time / Cumulative metrics (totals)
    const totalOrganizations = await this.prismaService.organization.count();
    const totalUsers = await this.prismaService.user.count();
    
    const allTimeSalesAgg = await this.prismaService.sale.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
    const totalSalesVolume = Number(allTimeSalesAgg._sum.totalAmount || 0);
    const totalSalesCount = allTimeSalesAgg._count.id || 0;

    const totalPendingInvitations = await this.prismaService.invitation.count({
      where: { status: 'PENDING', expiresAt: { gte: new Date() } },
    });

    // 2. Period-specific metrics
    const periodOrganizationsCreated = await this.prismaService.organization.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    const periodUsersRegistered = await this.prismaService.user.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    const periodSalesAgg = await this.prismaService.sale.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
    const periodSalesVolume = Number(periodSalesAgg._sum.totalAmount || 0);
    const periodSalesCount = periodSalesAgg._count.id || 0;

    const periodInvitationsSent = await this.prismaService.invitation.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    // 3. Trends data (registrations & sales)
    const orgsForTrend = await this.prismaService.organization.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const salesForTrend = await this.prismaService.sale.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true, totalAmount: true },
      orderBy: { createdAt: 'asc' },
    });

    const trends = this.buildTrendData(
      startDate,
      endDate,
      dto.granularity || AdminDashboardGranularity.MONTH,
      orgsForTrend,
      salesForTrend,
    );

    // 4. Plan distribution
    const planCounts = await this.prismaService.organization.groupBy({
      by: ['plan'],
      _count: { id: true },
    });
    const planDistribution = planCounts.map(item => ({
      plan: item.plan,
      count: item._count.id,
    }));

    // Ensure all standard plans exist in response
    ['FREE', 'BASIC', 'PREMIUM'].forEach(planName => {
      if (!planDistribution.some(p => p.plan === planName)) {
        planDistribution.push({ plan: planName as any, count: 0 });
      }
    });

    // 5. Module usage distribution
    const moduleCounts = await this.prismaService.organizationModule.groupBy({
      by: ['moduleId'],
      _count: { organizationId: true },
    });
    
    const moduleIds = moduleCounts.map(m => m.moduleId);
    const modulesInfo = await this.prismaService.module.findMany({
      where: { id: { in: moduleIds } },
      select: { id: true, name: true, key: true },
    });

    const moduleDistribution = modulesInfo.map(mod => {
      const usage = moduleCounts.find(c => c.moduleId === mod.id);
      return {
        key: mod.key,
        name: mod.name,
        count: usage ? usage._count.organizationId : 0,
      };
    }).sort((a, b) => b.count - a.count);

    // 6. Recent activities (top 5 organizations)
    const recentOrganizations = await this.prismaService.organization.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    });

    // Recent activities (top 5 users)
    const recentUsers = await this.prismaService.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        globalRole: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      kpis: {
        period: {
          organizationsCreated: periodOrganizationsCreated,
          usersRegistered: periodUsersRegistered,
          salesCount: periodSalesCount,
          salesVolume: Number(periodSalesVolume.toFixed(2)),
          invitationsSent: periodInvitationsSent,
        },
        total: {
          organizations: totalOrganizations,
          users: totalUsers,
          salesCount: totalSalesCount,
          salesVolume: Number(totalSalesVolume.toFixed(2)),
          pendingInvitations: totalPendingInvitations,
        },
      },
      trends,
      planDistribution,
      moduleDistribution,
      recentOrganizations,
      recentUsers,
    };
  }

  private getPeriodRange(dto: FindAdminDashboardDto) {
    const now = new Date();
    const currentYear = dto.year ?? now.getFullYear();

    let startDate: Date;
    let endDate: Date;

    switch (dto.granularity) {
      case AdminDashboardGranularity.TODAY: {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      }
      case AdminDashboardGranularity.MONTH: {
        const month = dto.month !== undefined ? dto.month - 1 : now.getMonth();
        startDate = new Date(currentYear, month, 1, 0, 0, 0, 0);
        endDate = new Date(currentYear, month + 1, 0, 23, 59, 59, 999);
        break;
      }
      case AdminDashboardGranularity.YEAR: {
        startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0);
        endDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);
        break;
      }
      case AdminDashboardGranularity.RANGE: {
        startDate = dto.startDate ? new Date(dto.startDate) : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = dto.endDate ? new Date(dto.endDate) : new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      default: {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
    }

    return { startDate, endDate };
  }

  private buildTrendData(
    startDate: Date,
    endDate: Date,
    granularity: AdminDashboardGranularity,
    orgs: { createdAt: Date }[],
    sales: { createdAt: Date; totalAmount: any }[],
  ): TrendItem[] {
    let grouping: 'hour' | 'day' | 'month' = 'day';

    if (granularity === AdminDashboardGranularity.TODAY) {
      grouping = 'hour';
    } else if (granularity === AdminDashboardGranularity.YEAR) {
      grouping = 'month';
    } else if (granularity === AdminDashboardGranularity.MONTH) {
      grouping = 'day';
    } else if (granularity === AdminDashboardGranularity.RANGE) {
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) {
        grouping = 'hour';
      } else if (diffDays <= 90) {
        grouping = 'day';
      } else {
        grouping = 'month';
      }
    }

    const trendMap = new Map<string, { orgs: number; salesCount: number; salesVolume: number }>();
    const trendList: TrendItem[] = [];
    const spanishMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    if (grouping === 'hour') {
      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, '0')}:00`;
        trendMap.set(label, { orgs: 0, salesCount: 0, salesVolume: 0 });
        trendList.push({ label, organizations: 0, salesCount: 0, salesVolume: 0 });
      }

      orgs.forEach(o => {
        const h = o.createdAt.getHours();
        const label = `${String(h).padStart(2, '0')}:00`;
        const val = trendMap.get(label);
        if (val) val.orgs++;
      });

      sales.forEach(s => {
        const h = s.createdAt.getHours();
        const label = `${String(h).padStart(2, '0')}:00`;
        const val = trendMap.get(label);
        if (val) {
          val.salesCount++;
          val.salesVolume += Number(s.totalAmount);
        }
      });
    } else if (grouping === 'day') {
      const temp = new Date(startDate.getTime());
      while (temp <= endDate) {
        const label = `${temp.getDate()}/${temp.getMonth() + 1}`;
        trendMap.set(label, { orgs: 0, salesCount: 0, salesVolume: 0 });
        trendList.push({ label, organizations: 0, salesCount: 0, salesVolume: 0 });
        temp.setDate(temp.getDate() + 1);
      }

      orgs.forEach(o => {
        const label = `${o.createdAt.getDate()}/${o.createdAt.getMonth() + 1}`;
        const val = trendMap.get(label);
        if (val) val.orgs++;
      });

      sales.forEach(s => {
        const label = `${s.createdAt.getDate()}/${s.createdAt.getMonth() + 1}`;
        const val = trendMap.get(label);
        if (val) {
          val.salesCount++;
          val.salesVolume += Number(s.totalAmount);
        }
      });
    } else {
      const startY = startDate.getFullYear();
      const startM = startDate.getMonth();
      const endY = endDate.getFullYear();
      const endM = endDate.getMonth();

      let currY = startY;
      let currM = startM;

      while (currY < endY || (currY === endY && currM <= endM)) {
        const label = `${spanishMonths[currM]} ${currY}`;
        trendMap.set(label, { orgs: 0, salesCount: 0, salesVolume: 0 });
        trendList.push({ label, organizations: 0, salesCount: 0, salesVolume: 0 });

        currM++;
        if (currM > 11) {
          currM = 0;
          currY++;
        }
      }

      orgs.forEach(o => {
        const label = `${spanishMonths[o.createdAt.getMonth()]} ${o.createdAt.getFullYear()}`;
        const val = trendMap.get(label);
        if (val) val.orgs++;
      });

      sales.forEach(s => {
        const label = `${spanishMonths[s.createdAt.getMonth()]} ${s.createdAt.getFullYear()}`;
        const val = trendMap.get(label);
        if (val) {
          val.salesCount++;
          val.salesVolume += Number(s.totalAmount);
        }
      });
    }

    return trendList.map(item => {
      const val = trendMap.get(item.label);
      return {
        label: item.label,
        organizations: val ? val.orgs : 0,
        salesCount: val ? val.salesCount : 0,
        salesVolume: val ? Number(val.salesVolume.toFixed(2)) : 0,
      };
    });
  }
}
