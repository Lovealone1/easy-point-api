import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RecipesRepository } from './recipes.repository.js';
import { SuppliesRepository } from '../supplies/supplies.repository.js';
import { ProductsRepository } from '../products/products.repository.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { FindRecipesDto } from './dto/find-recipes.dto.js';
import { PageMetaDto } from '../../common/pagination/page-meta.dto.js';
import { PageDto } from '../../common/pagination/page.dto.js';
import { getTenantId } from '../../common/context/tenant.context.js';
import { RecipeEntity } from './domain/recipe.entity.js';
import type { RecipeIngredient } from './domain/recipe-content.types.js';
import { Prisma } from '@prisma/client';

/**
 * Service de Recipe — capa de aplicación (orquestación).
 *
 * Responsabilidades:
 *  - Resolver el contexto de tenant (organizationId).
 *  - Auto-poblar el nombre de los ingredientes desde los Supplies cuando no se proveen.
 *  - Validar que todos los supplyIds existen antes de guardar.
 *  - Aplicar las reglas de dominio de la entidad (setIngredients, setSteps).
 *  - Vincular el producto al recipeId si se envía productId en el create.
 *  - Lanzar excepciones HTTP apropiadas.
 *
 * NO contiene lógica de negocio. Las reglas de ordenamiento, unicidad de
 * pasos y validación de cantidades viven en RecipeEntity.
 */
@Injectable()
export class RecipesService {
  constructor(
    private readonly recipesRepository: RecipesRepository,
    private readonly suppliesRepository: SuppliesRepository,
    private readonly productsRepository: ProductsRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  /**
   * Resuelve los nombres de los ingredientes que no los traigan explícitamente.
   * Hace una sola query batch a la DB para obtener todos los supplies necesarios.
   * Lanza BadRequestException si algún supplyId no existe.
   */
  private async resolveIngredientNames(
    ingredients: Array<{ supplyId: string; name?: string; quantity: number; unit: string }>,
    organizationId: string,
  ): Promise<RecipeIngredient[]> {
    // IDs que necesitan resolución (los que no traen nombre)
    const idsToResolve = ingredients
      .filter((i) => !i.name)
      .map((i) => i.supplyId);

    const supplyMap = new Map<string, string>();

    if (idsToResolve.length > 0) {
      const supplies = await this.suppliesRepository.findByIds(idsToResolve);

      // Validar que todos los supplies existen y pertenecen a la organización
      for (const id of idsToResolve) {
        const supply = supplies.find(
          (s) => s.id === id && s.organizationId === organizationId,
        );
        if (!supply) {
          throw new BadRequestException(
            `Supply with ID "${id}" not found in this organization`,
          );
        }
        supplyMap.set(id, supply.name);
      }
    }

    return ingredients.map((ing) => ({
      supplyId: ing.supplyId,
      name: ing.name ?? supplyMap.get(ing.supplyId) ?? '',
      quantity: ing.quantity,
      unit: ing.unit,
    }));
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(createRecipeDto: CreateRecipeDto): Promise<RecipeEntity> {
    const organizationId = getTenantId();
    if (!organizationId) {
      throw new BadRequestException('Missing x-organization-id header');
    }

    // Categoría resuelta: se usará el valor explícito del DTO, o el nombre de la categoría del producto
    let resolvedCategory = createRecipeDto.category ?? null;

    // Validar productId si se provee — y aprovechar el JOIN para obtener la categoría
    if (createRecipeDto.productId) {
      const result = await this.productsRepository.findByIdWithCategory(
        createRecipeDto.productId,
      );

      if (!result || result.entity.organizationId !== organizationId) {
        throw new BadRequestException(
          `Product with ID "${createRecipeDto.productId}" not found in this organization`,
        );
      }
      if (result.entity.recipeId) {
        throw new BadRequestException(
          `Product "${result.entity.name}" already has a recipe linked (recipeId: ${result.entity.recipeId})`,
        );
      }

      // Auto-poblar la categoría desde el producto si no se proporcionó explícitamente.
      // Sin costo adicional: el categoryName viene del mismo SELECT (JOIN con category).
      if (!resolvedCategory && result.categoryName) {
        resolvedCategory = result.categoryName;
      }
    }

    // Resolver nombres de ingredientes desde Supplies (batch, sin redundancia)
    const resolvedIngredients = await this.resolveIngredientNames(
      createRecipeDto.content.ingredients,
      organizationId,
    );

    // Construir entidad y aplicar reglas de dominio
    const entity = new RecipeEntity({
      id: '',
      name: createRecipeDto.name,
      description: createRecipeDto.description ?? null,
      content: {
        ingredients: [],
        steps: [],
        metadata: createRecipeDto.content.metadata,
      },
      category: resolvedCategory,
      estimatedTime: createRecipeDto.estimatedTime ?? null,
      isActive: true,
      notes: createRecipeDto.notes ?? null,
      organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      entity.setIngredients(resolvedIngredients);
      entity.setSteps(createRecipeDto.content.steps);
    } catch (err: unknown) {
      throw new BadRequestException((err as Error).message);
    }

    // Persistir la receta
    const created = await this.recipesRepository.create({
      name: entity.name,
      description: entity.description,
      content: entity.content as unknown as Prisma.InputJsonValue,
      category: entity.category,
      estimatedTime: entity.estimatedTime,
      isActive: entity.isActive,
      notes: entity.notes,
      organizationId: entity.organizationId,
    });

    // Vincular el producto a la receta si se envió productId
    if (createRecipeDto.productId) {
      await this.productsRepository.linkRecipe(createRecipeDto.productId, created.id);
    }

    return created;
  }

  async findAll(query: FindRecipesDto): Promise<PageDto<RecipeEntity>> {
    const where: Prisma.RecipeWhereInput = {};

    const tenantId = getTenantId();
    if (tenantId) where.organizationId = tenantId;

    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.category) where.category = { contains: query.category, mode: 'insensitive' };
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [items, count] = await this.recipesRepository.findManyWithCount({
      where,
      skip: query.skip,
      take: query.limit,
      orderBy: { [query.orderBy]: query.order.toLowerCase() as Prisma.SortOrder },
    });

    const pageMetaDto = new PageMetaDto({ itemCount: count, pageOptionsDto: query });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<RecipeEntity> {
    const recipe = await this.recipesRepository.findById(id);
    if (!recipe) {
      throw new NotFoundException(`Recipe with ID ${id} not found`);
    }
    return recipe;
  }

  async update(
    id: string,
    updateRecipeDto: UpdateRecipeDto,
  ): Promise<RecipeEntity> {
    const current = await this.findOne(id);
    const organizationId = current.organizationId;

    if (updateRecipeDto.content) {
      try {
        if (updateRecipeDto.content.ingredients !== undefined) {
          const resolved = await this.resolveIngredientNames(
            updateRecipeDto.content.ingredients,
            organizationId,
          );
          current.setIngredients(resolved);
        }
        if (updateRecipeDto.content.steps !== undefined) {
          current.setSteps(updateRecipeDto.content.steps);
        }
        if (updateRecipeDto.content.metadata !== undefined) {
          current.content = {
            ...current.content,
            metadata: updateRecipeDto.content.metadata,
          };
        }
      } catch (err: unknown) {
        throw new BadRequestException((err as Error).message);
      }
    }

    return this.recipesRepository.update(id, {
      name: updateRecipeDto.name ?? current.name,
      description: updateRecipeDto.description ?? current.description,
      content: current.content as unknown as Prisma.InputJsonValue,
      category: updateRecipeDto.category ?? current.category,
      estimatedTime: updateRecipeDto.estimatedTime ?? current.estimatedTime,
      notes: updateRecipeDto.notes ?? current.notes,
    });
  }

  async remove(id: string): Promise<RecipeEntity> {
    await this.findOne(id);
    return this.recipesRepository.delete(id);
  }

  async toggleActive(id: string, isActive: boolean): Promise<RecipeEntity> {
    await this.findOne(id);
    return this.recipesRepository.update(id, { isActive });
  }

  async addNote(id: string, note: string): Promise<RecipeEntity> {
    const recipe = await this.findOne(id);
    recipe.appendNote(note);
    return this.recipesRepository.update(id, { notes: recipe.notes });
  }
}
