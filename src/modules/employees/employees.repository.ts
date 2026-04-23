import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { EmployeeEntity } from './domain/employee.entity.js';

/**
 * Repository de Employee — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio EmployeeEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.EmployeeUncheckedCreateInput,
  ): Promise<EmployeeEntity> {
    const raw = await this.prisma.employee.create({ data });
    return EmployeeEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.EmployeeWhereInput;
    orderBy?: Prisma.EmployeeOrderByWithRelationInput;
  }): Promise<[EmployeeEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.employee.findMany({ skip, take, where, orderBy }),
      this.prisma.employee.count({ where }),
    ]);
    return [rows.map(EmployeeEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<EmployeeEntity | null> {
    const raw = await this.prisma.employee.findUnique({ where: { id } });
    return raw ? EmployeeEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.EmployeeUncheckedUpdateInput,
  ): Promise<EmployeeEntity> {
    const raw = await this.prisma.employee.update({ where: { id }, data });
    return EmployeeEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<EmployeeEntity> {
    const raw = await this.prisma.employee.delete({ where: { id } });
    return EmployeeEntity.fromPrisma(raw);
  }
}
