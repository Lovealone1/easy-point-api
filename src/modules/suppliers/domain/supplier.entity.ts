export class SupplierEntity {
  readonly id: string;
  readonly organizationId: string;
  name: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  bankAccount: string | null;
  leadTime: number;

  isActive: boolean;
  paymentTerms: string | null;
  notes: string | null;

  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    organizationId: string;
    name: string;
    taxId: string;
    email: string;
    phone: string;
    address: string;
    bankAccount: string | null;
    leadTime: number;
    isActive: boolean;
    paymentTerms: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    Object.assign(this, params);
  }

  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }

  static fromPrisma(raw: {
    id: string;
    organizationId: string;
    name: string;
    taxId: string;
    email: string;
    phone: string;
    address: string;
    bankAccount: string | null;
    leadTime: number;
    isActive: boolean;
    paymentTerms: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SupplierEntity {
    return new SupplierEntity(raw);
  }
}
