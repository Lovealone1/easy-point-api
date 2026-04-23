import { Prisma, EmployeeStatus } from '@prisma/client';

/**
 * Entidad de dominio: Employee
 *
 * Encapsula el estado y las reglas de negocio de un empleado.
 * No depende de NestJS ni de Prisma como ORM.
 *
 * Reglas de negocio contenidas aquí:
 *  - El salario siempre es un Prisma.Decimal (precisión financiera garantizada).
 *  - La fecha de contratación siempre es un Date (nunca un string raw).
 *  - Las notas se acumulan de forma histórica (appendNote).
 *  - El empleado puede vincularse o desvincularse de un User del sistema.
 */
export class EmployeeEntity {
  readonly id: string;
  readonly organizationId: string;
  firstName: string;
  lastName: string;
  taxId: string | null;
  salary: Prisma.Decimal;
  hireDate: Date;
  position: string;
  email: string | null;
  phone: string | null;
  status: EmployeeStatus;
  isActive: boolean;
  notes: string | null;
  userId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    firstName: string;
    lastName: string;
    taxId: string | null;
    salary: Prisma.Decimal;
    hireDate: Date;
    position: string;
    email: string | null;
    phone: string | null;
    status: EmployeeStatus;
    isActive: boolean;
    notes: string | null;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.firstName = params.firstName;
    this.lastName = params.lastName;
    this.taxId = params.taxId;
    this.salary = params.salary;
    this.hireDate = params.hireDate;
    this.position = params.position;
    this.email = params.email;
    this.phone = params.phone;
    this.status = params.status;
    this.isActive = params.isActive;
    this.notes = params.notes;
    this.userId = params.userId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — nombre
  // ---------------------------------------------------------------------------

  /** Nombre completo del empleado. */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — notas
  // ---------------------------------------------------------------------------

  /**
   * Acumula una nota al historial existente.
   * El registro histórico nunca se sobreescribe, solo se extiende.
   */
  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — conversiones de tipo
  // ---------------------------------------------------------------------------

  /**
   * Aplica un nuevo salario convirtiendo el valor numérico al tipo
   * Decimal de precisión financiera requerido por el modelo.
   *
   * @param rawSalary  Número o string numérico del salario.
   */
  applySalaryChange(rawSalary: number | string): void {
    this.salary = new Prisma.Decimal(rawSalary);
  }

  /**
   * Aplica una nueva fecha de contratación convirtiendo el string ISO
   * al tipo Date nativo.
   *
   * @param rawDate  String de fecha ISO (ej. "2024-01-15").
   */
  applyHireDateChange(rawDate: string): void {
    this.hireDate = new Date(rawDate);
  }

  // ---------------------------------------------------------------------------
  // Mapeo desde infraestructura
  // ---------------------------------------------------------------------------

  /**
   * Construye una EmployeeEntity desde el modelo raw de Prisma.
   * Único punto de entrada desde la base de datos.
   */
  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    firstName: string;
    lastName: string;
    taxId: string | null;
    salary: Prisma.Decimal;
    hireDate: Date;
    position: string;
    email: string | null;
    phone: string | null;
    status: EmployeeStatus;
    isActive: boolean;
    notes: string | null;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): EmployeeEntity {
    return new EmployeeEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      firstName: raw.firstName,
      lastName: raw.lastName,
      taxId: raw.taxId,
      salary: raw.salary,
      hireDate: raw.hireDate,
      position: raw.position,
      email: raw.email,
      phone: raw.phone,
      status: raw.status,
      isActive: raw.isActive,
      notes: raw.notes,
      userId: raw.userId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
