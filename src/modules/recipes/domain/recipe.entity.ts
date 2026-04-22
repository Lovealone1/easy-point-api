import type {
  RecipeContent,
  RecipeIngredient,
  RecipeStep,
} from './recipe-content.types.js';

export type { RecipeContent, RecipeIngredient, RecipeStep };

/**
 * Entidad de dominio: Recipe
 *
 * Encapsula el estado y las reglas de negocio de una receta.
 * No depende de NestJS ni de Prisma como ORM.
 *
 * Reglas de negocio contenidas aquí:
 *  - Los pasos siempre se almacenan ordenados ascendentemente por `order`.
 *  - No pueden existir dos pasos con el mismo número de orden.
 *  - Los ingredientes deben tener quantity > 0.
 *  - Las notas se acumulan (appendNote).
 */
export class RecipeEntity {
  readonly id: string;
  name: string;
  description: string | null;
  content: RecipeContent;
  category: string | null;
  estimatedTime: number | null;
  isActive: boolean;
  notes: string | null;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(params: {
    id: string;
    name: string;
    description: string | null;
    content: RecipeContent;
    category: string | null;
    estimatedTime: number | null;
    isActive: boolean;
    notes: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.content = params.content;
    this.category = params.category;
    this.estimatedTime = params.estimatedTime;
    this.isActive = params.isActive;
    this.notes = params.notes;
    this.organizationId = params.organizationId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — contenido
  // ---------------------------------------------------------------------------

  /**
   * Reemplaza los ingredientes de la receta, validando que quantity > 0.
   * Lanza un error de dominio si algún ingrediente tiene cantidad inválida.
   */
  setIngredients(ingredients: RecipeIngredient[]): void {
    const invalid = ingredients.find((i) => i.quantity <= 0);
    if (invalid) {
      throw new Error(
        `Ingredient "${invalid.name}" must have quantity > 0`,
      );
    }
    this.content = { ...this.content, ingredients };
  }

  /**
   * Reemplaza los pasos de la receta, validando que:
   *  - Los números de orden sean únicos.
   *  - Se ordenan automáticamente ascendentemente.
   */
  setSteps(steps: RecipeStep[]): void {
    const orders = steps.map((s) => s.order);
    const hasDuplicates = orders.length !== new Set(orders).size;
    if (hasDuplicates) {
      throw new Error('Recipe steps must have unique order numbers');
    }
    const sorted = [...steps].sort((a, b) => a.order - b.order);
    this.content = { ...this.content, steps: sorted };
  }

  /**
   * Calcula el costo total estimado de la receta sumando
   * quantity × pricePerUnit de cada ingrediente.
   *
   * @param priceMap  Mapa supplyId → pricePerUnit (número)
   * @returns         Costo total estimado; null si falta algún precio.
   */
  estimatedCost(priceMap: Record<string, number>): number | null {
    let total = 0;
    for (const ing of this.content.ingredients) {
      const price = priceMap[ing.supplyId];
      if (price === undefined) return null;
      total += ing.quantity * price;
    }
    return total;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio — notas
  // ---------------------------------------------------------------------------

  /**
   * Acumula una nota al historial existente.
   */
  appendNote(note: string): void {
    this.notes = this.notes ? `${this.notes}\n${note}` : note;
  }

  // ---------------------------------------------------------------------------
  // Mapeo desde infraestructura
  // ---------------------------------------------------------------------------

  /**
   * Construye una RecipeEntity desde el modelo raw de Prisma.
   * El campo `content` de Prisma es `JsonValue`; se castea al tipo interno.
   */
  static fromPrisma(raw: {
    id: string;
    name: string;
    description: string | null;
    content: unknown;
    category: string | null;
    estimatedTime: number | null;
    isActive: boolean;
    notes: string | null;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
  }): RecipeEntity {
    return new RecipeEntity({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      content: raw.content as RecipeContent,
      category: raw.category,
      estimatedTime: raw.estimatedTime,
      isActive: raw.isActive,
      notes: raw.notes,
      organizationId: raw.organizationId,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
