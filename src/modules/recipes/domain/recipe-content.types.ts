/**
 * Tipos que describen la estructura del campo `content` (JSON) de una receta.
 *
 * Estos tipos se usan tanto en la entidad de dominio como en los DTOs
 * para garantizar consistencia del JSON almacenado en la base de datos.
 */

export interface RecipeIngredient {
  /** UUID del Supply relacionado */
  supplyId: string;
  /** Nombre del ingrediente (desnormalizado para legibilidad sin JOIN) */
  name: string;
  /** Cantidad numérica del ingrediente */
  quantity: number;
  /** Unidad de medida: gr, ml, und, kg, lt, etc. */
  unit: string;
}

export interface RecipeStep {
  /** Número de orden del paso (1-based, ascendente) */
  order: number;
  /** Instrucción del paso en texto libre */
  instruction: string;
}

export interface RecipeMetadata {
  /** Cantidad de unidades que produce la receta */
  yieldQuantity: number;
  /** Descripción de la unidad de rendimiento, ej. "Bizcocho Grande", "Porciones" */
  yieldUnit: string;
}

/** Forma completa del campo `content` almacenado como JSON en la DB */
export interface RecipeContent {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  metadata: RecipeMetadata;
}
