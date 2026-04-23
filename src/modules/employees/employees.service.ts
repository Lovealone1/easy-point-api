import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeesRepository } from './employees.repository.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { FindEmployeesDto } from './dto/find-employees.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { EmployeeStatus, Prisma } from '@prisma/client';
import { EmployeeEntity } from './domain/employee.entity.js';

/**
 * Service de Employee — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Resolver el contexto de tenant (organizationId viene del DTO en este módulo).
 *  - Construir la entidad con los datos del DTO y aplicar las conversiones
 *    de tipo (salary, hireDate) delegando en la entidad.
 *  - Delegar la concatenación de notas a EmployeeEntity.appendNote().
 *  - Coordinar el flujo entre el repositorio y la entidad.
 *  - Lanzar NotFoundException cuando un recurso no existe.
 *
 * NO contiene lógica de negocio. Las conversiones de tipo, el getter fullName
 * y appendNote viven en EmployeeEntity.
 */
@Injectable()
export class EmployeesService {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async create(
    createEmployeeDto: CreateEmployeeDto,
  ): Promise<EmployeeEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    // Construir la entidad temporal para aplicar las conversiones de tipo
    const entity = new EmployeeEntity({
      id: '',
      organizationId,
      firstName: createEmployeeDto.firstName,
      lastName: createEmployeeDto.lastName,
      taxId: createEmployeeDto.taxId ?? null,
      salary: new Prisma.Decimal(0), // placeholder; se aplicará abajo
      hireDate: new Date(),          // placeholder; se aplicará abajo
      position: createEmployeeDto.position,
      email: createEmployeeDto.email ?? null,
      phone: createEmployeeDto.phone ?? null,
      status: EmployeeStatus.ACTIVE,
      isActive: true,
      notes: null,
      userId: createEmployeeDto.userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // La entidad aplica las conversiones de tipo con sus invariantes
    entity.applySalaryChange(createEmployeeDto.salary);
    entity.applyHireDateChange(createEmployeeDto.hireDate);

    return this.employeesRepository.create({
      organizationId: entity.organizationId,
      firstName: entity.firstName,
      lastName: entity.lastName,
      taxId: entity.taxId,
      salary: entity.salary,
      hireDate: entity.hireDate,
      position: entity.position,
      email: entity.email,
      phone: entity.phone,
      status: entity.status,
      isActive: entity.isActive,
      notes: entity.notes,
      userId: entity.userId,
    });
  }

  async findAll(query: FindEmployeesDto): Promise<PageDto<EmployeeEntity>> {
    const where: Prisma.EmployeeWhereInput = {};

    if (query.organizationId) where.organizationId = query.organizationId;

    if (query.name) {
      where.OR = [
        { firstName: { contains: query.name, mode: 'insensitive' } },
        { lastName: { contains: query.name, mode: 'insensitive' } },
      ];
    }

    if (query.position) {
      where.position = { contains: query.position, mode: 'insensitive' };
    }

    if (query.status) where.status = query.status;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.employeesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<EmployeeEntity> {
    const employee = await this.employeesRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }
    return employee;
  }

  async update(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeEntity> {
    const employee = await this.findOne(id);

    // La entidad aplica las conversiones de tipo si los campos cambian
    if (updateEmployeeDto.salary !== undefined) {
      employee.applySalaryChange(updateEmployeeDto.salary);
    }
    if (updateEmployeeDto.hireDate !== undefined) {
      employee.applyHireDateChange(updateEmployeeDto.hireDate);
    }

    return this.employeesRepository.update(id, {
      firstName: updateEmployeeDto.firstName,
      lastName: updateEmployeeDto.lastName,
      taxId: updateEmployeeDto.taxId,
      salary: employee.salary,
      hireDate: employee.hireDate,
      position: updateEmployeeDto.position,
      email: updateEmployeeDto.email,
      phone: updateEmployeeDto.phone,
      userId: updateEmployeeDto.userId,
    });
  }

  async remove(id: string): Promise<EmployeeEntity> {
    await this.findOne(id);
    return this.employeesRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<EmployeeEntity> {
    await this.findOne(id);
    return this.employeesRepository.update(id, { isActive });
  }

  async addNote(id: string, note: string): Promise<EmployeeEntity> {
    const employee = await this.findOne(id);

    // La entidad aplica la lógica de concatenación
    employee.appendNote(note);

    return this.employeesRepository.update(id, { notes: employee.notes });
  }

  async updateStatus(id: string, status: EmployeeStatus): Promise<EmployeeEntity> {
    await this.findOne(id);
    return this.employeesRepository.update(id, { status });
  }

  async assignUser(id: string, userId: string | null): Promise<EmployeeEntity> {
    await this.findOne(id);
    return this.employeesRepository.update(id, { userId });
  }
}
