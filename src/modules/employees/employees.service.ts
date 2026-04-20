import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeesRepository } from './employees.repository.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { FindEmployeesDto } from './dto/find-employees.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { EmployeeStatus, Prisma } from '@prisma/client';

@Injectable()
export class EmployeesService {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    return this.employeesRepository.create({
      ...createEmployeeDto,
      salary: new Prisma.Decimal(createEmployeeDto.salary),
      hireDate: new Date(createEmployeeDto.hireDate),
    });
  }

  async findAll(query: FindEmployeesDto) {
    const where: Prisma.EmployeeWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.name) {
      where.OR = [
        { firstName: { contains: query.name, mode: 'insensitive' } },
        { lastName: { contains: query.name, mode: 'insensitive' } },
      ];
    }

    if (query.position) {
      where.position = { contains: query.position, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, count] = await this.employeesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string) {
    const employee = await this.employeesRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    await this.findOne(id);

    const updateData: Prisma.EmployeeUncheckedUpdateInput = { ...updateEmployeeDto };
    if (updateEmployeeDto.salary !== undefined) {
      updateData.salary = new Prisma.Decimal(updateEmployeeDto.salary);
    }
    if (updateEmployeeDto.hireDate !== undefined) {
      updateData.hireDate = new Date(updateEmployeeDto.hireDate);
    }

    return this.employeesRepository.update(id, updateData);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.employeesRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.employeesRepository.update(id, { isActive });
  }

  async addNote(id: string, notes: string) {
    const employee = await this.findOne(id);
    const newNotes = employee.notes ? `${employee.notes}\n${notes}` : notes;
    return this.employeesRepository.update(id, { notes: newNotes });
  }

  async updateStatus(id: string, status: EmployeeStatus) {
    await this.findOne(id);
    return this.employeesRepository.update(id, { status });
  }

  async assignUser(id: string, userId: string | null) {
    await this.findOne(id);
    return this.employeesRepository.update(id, { userId });
  }
}
