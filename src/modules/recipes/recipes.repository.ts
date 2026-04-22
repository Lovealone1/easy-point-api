import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { RecipeEntity } from './domain/recipe.entity.js';

/**
 * Repository de Recipe — capa de infraestructura.
 *
 * Responsabilidades:
 *  - Toda comunicación con la base de datos (Prisma).
 *  - Mapeo entre el modelo Prisma y la entidad de dominio RecipeEntity.
 *
 * NO contiene lógica de negocio.
 */
@Injectable()
export class RecipesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.RecipeUncheckedCreateInput,
  ): Promise<RecipeEntity> {
    const raw = await this.prisma.recipe.create({ data });
    return RecipeEntity.fromPrisma(raw);
  }

  async findManyWithCount(params: {
    skip?: number;
    take?: number;
    where?: Prisma.RecipeWhereInput;
    orderBy?: Prisma.RecipeOrderByWithRelationInput;
  }): Promise<[RecipeEntity[], number]> {
    const { skip, take, where, orderBy } = params;
    const [rows, count] = await Promise.all([
      this.prisma.recipe.findMany({ skip, take, where, orderBy }),
      this.prisma.recipe.count({ where }),
    ]);
    return [rows.map(RecipeEntity.fromPrisma), count];
  }

  async findById(id: string): Promise<RecipeEntity | null> {
    const raw = await this.prisma.recipe.findUnique({ where: { id } });
    return raw ? RecipeEntity.fromPrisma(raw) : null;
  }

  async update(
    id: string,
    data: Prisma.RecipeUncheckedUpdateInput,
  ): Promise<RecipeEntity> {
    const raw = await this.prisma.recipe.update({ where: { id }, data });
    return RecipeEntity.fromPrisma(raw);
  }

  async delete(id: string): Promise<RecipeEntity> {
    const raw = await this.prisma.recipe.delete({ where: { id } });
    return RecipeEntity.fromPrisma(raw);
  }
}
