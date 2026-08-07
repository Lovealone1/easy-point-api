import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserSubscriptionCategoriesRepository } from './user-subscription-categories.repository.js';
import { CreateUserSubscriptionCategoryDto } from './dto/create-user-subscription-category.dto.js';
import { UpdateUserSubscriptionCategoryDto } from './dto/update-user-subscription-category.dto.js';
import { SubscriptionCategoryEntity } from '../subscription-catalog/domain/subscription-category.entity.js';

/** User categories sort after the seeded ones unless they say otherwise. */
const DEFAULT_USER_SORT_ORDER = 500;
const DEFAULT_ICON = 'category-rounded';

@Injectable()
export class UserSubscriptionCategoriesService {
  constructor(private readonly categoriesRepository: UserSubscriptionCategoriesRepository) {}

  findAllForUser(userId: string): Promise<SubscriptionCategoryEntity[]> {
    return this.categoriesRepository.findAllVisibleTo(userId);
  }

  /**
   * Resolves a category a user is allowed to attach to a subscription: either a
   * system one or their own. Consumed by UserSubscriptionsService so a user
   * cannot reference someone else's category by id.
   */
  async assertUsableBy(id: string, userId: string): Promise<SubscriptionCategoryEntity> {
    const category = await this.categoriesRepository.findById(id);

    if (!category || (category.userId !== null && category.userId !== userId)) {
      // Deliberately a 404, not a 403: acknowledging the id would confirm that
      // another user's category exists.
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  /** Same resolution, plus the requirement that the user owns it. */
  private async assertOwnedBy(id: string, userId: string): Promise<SubscriptionCategoryEntity> {
    const category = await this.assertUsableBy(id, userId);

    if (category.isSystem) {
      throw new ForbiddenException(
        'Las categorías del sistema no se pueden modificar. Crea una propia si necesitas otra.',
      );
    }

    return category;
  }

  async create(
    userId: string,
    dto: CreateUserSubscriptionCategoryDto,
  ): Promise<SubscriptionCategoryEntity> {
    const key = await this.buildUniqueKey(userId, dto.name);

    return this.categoriesRepository.create({
      user: { connect: { id: userId } },
      key,
      name: dto.name.trim(),
      icon: dto.icon ?? DEFAULT_ICON,
      color: dto.color ?? null,
      sortOrder: dto.sortOrder ?? DEFAULT_USER_SORT_ORDER,
      isActive: true,
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateUserSubscriptionCategoryDto,
  ): Promise<SubscriptionCategoryEntity> {
    const current = await this.assertOwnedBy(id, userId);

    const data: Prisma.SubscriptionCategoryUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      // Keep the key readable alongside the name, but only when the rename
      // actually produces a different slug.
      const nextKey = slugify(dto.name);
      if (nextKey && nextKey !== current.key) {
        data.key = await this.buildUniqueKey(userId, dto.name);
      }
    }

    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.categoriesRepository.update(id, data);
  }

  async remove(id: string, userId: string, reassignTo?: string): Promise<SubscriptionCategoryEntity> {
    await this.assertOwnedBy(id, userId);

    const inUse = await this.categoriesRepository.countSubscriptionsUsing(id);

    if (inUse === 0) {
      return this.categoriesRepository.delete(id);
    }

    // The FK is onDelete: SetNull, so deleting silently would strip the
    // category off every subscription using it. Make the caller decide.
    if (!reassignTo) {
      throw new ConflictException(
        `Esta categoría está en uso por ${inUse} suscripción(es). Indica "reassignTo" con la categoría de destino para moverlas.`,
      );
    }

    if (reassignTo === id) {
      throw new BadRequestException('No puedes reasignar las suscripciones a la misma categoría que vas a borrar.');
    }

    await this.assertUsableBy(reassignTo, userId);

    return this.categoriesRepository.reassignAndDelete(id, reassignTo);
  }

  /**
   * Derives a URL-safe key from the name, appending a counter on collision.
   * Only the user's own keys are consulted — a user may reuse a system key.
   */
  private async buildUniqueKey(userId: string, name: string): Promise<string> {
    const base = slugify(name);
    if (!base) {
      throw new BadRequestException('El nombre debe contener al menos una letra o número.');
    }

    let candidate = base;
    for (let suffix = 2; suffix < 100; suffix++) {
      const clash = await this.categoriesRepository.findByKeyForUser(userId, candidate);
      if (!clash) return candidate;
      candidate = `${base}-${suffix}`;
    }

    throw new BadRequestException('Ya tienes demasiadas categorías con un nombre parecido.');
  }
}

/** "Mis Mascotas 🐶" -> "mis-mascotas". Strips accents so keys stay ASCII. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritics left over by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
