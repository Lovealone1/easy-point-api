import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, Employee } from '@prisma/client';

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.EmployeeUncheckedCreateInput): Promise<Employee> {
    return this.prisma.employee.create({ data });
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.EmployeeWhereInput;
    orderBy?: Prisma.EmployeeOrderByWithRelationInput;
  }): Promise<[any[], number]> {
    const { skip, take, where, orderBy } = params;
    return Promise.all([
      this.prisma.employee.findMany({ skip, take, where, orderBy }),
      this.prisma.employee.count({ where }),
    ]);
  }

  async findById(id: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.EmployeeUncheckedUpdateInput): Promise<Employee> {
    return this.prisma.employee.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Employee> {
    return this.prisma.employee.delete({ where: { id } });
  }
}
