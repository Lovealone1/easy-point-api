import { Prisma, ClientType } from '@prisma/client';

/**
 * Entidad de dominio: Client
 *
 * Encapsula el estado y las reglas de negocio de un cliente.
 * No depende de NestJS ni de Prisma como ORM.
 *
 * Reglas de negocio contenidas aquí:
 *  - El límite de crédito siempre es un Prisma.Decimal (precisión financiera garantizada).
 *  - Las notas se acumulan de forma histórica (appendNote).
 *  - El crédito disponible se calcula como creditLimit - usedCredit (si aplica).
 */
export class ClientEntity {
  readonly id: string;
  readonly organizationId: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  creditLimit: Prisma.Decimal;
  isActive: boolean;
  clientType: ClientType;
  notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    name: string;
    taxId: string | null;
    email: string | null;
    phone: string;
    address: string | null;
    creditLimit: Prisma.Decimal;
    isActive: boolean;
    clientType: ClientType;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.organizationId = params.organizationId;
    this.name = params.name;
    this.taxId = params.taxId;
    this.email = params.email;
    this.phone = params.phone;
    this.address = params.address;
    this.creditLimit = params.creditLimit;
    this.isActive = params.isActive;
    this.clientType = params.clientType;
    this.notes = params.notes;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — crédito
  // ---------------------------------------------------------------------------

  /**
   * Aplica un nuevo límite de crédito convirtiendo el valor numérico al tipo
   * Decimal de precisión financiera requerido por el modelo.
   *
   * @param rawLimit  Número o string numérico del límite de crédito.
   */
  applyCreditLimitChange(rawLimit: number | string): void {
    this.creditLimit = new Prisma.Decimal(rawLimit);
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
  // Mapeo desde infraestructura
  // ---------------------------------------------------------------------------

  /**
   * Construye una ClientEntity desde el modelo raw de Prisma.
   * Único punto de entrada desde la base de datos.
   */
  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    name: string;
    taxId: string | null;
    email: string | null;
    phone: string;
    address: string | null;
    creditLimit: Prisma.Decimal;
    isActive: boolean;
    clientType: ClientType;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ClientEntity {
    return new ClientEntity({
      id: raw.id,
      organizationId: raw.organizationId,
      name: raw.name,
      taxId: raw.taxId,
      email: raw.email,
      phone: raw.phone,
      address: raw.address,
      creditLimit: raw.creditLimit,
      isActive: raw.isActive,
      clientType: raw.clientType,
      notes: raw.notes,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
