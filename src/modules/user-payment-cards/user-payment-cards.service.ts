import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserPaymentCardsRepository } from './user-payment-cards.repository.js';
import { CreateUserPaymentCardDto } from './dto/create-user-payment-card.dto.js';
import { UpdateUserPaymentCardDto } from './dto/update-user-payment-card.dto.js';
import { UserPaymentCardEntity } from './domain/user-payment-card.entity.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class UserPaymentCardsService {
  constructor(private readonly cardsRepository: UserPaymentCardsRepository) {}

  async findAllForUser(userId: string): Promise<UserPaymentCardEntity[]> {
    return this.cardsRepository.findAllByUser(userId);
  }

  async findOneForUser(id: string, userId: string): Promise<UserPaymentCardEntity> {
    const card = await this.cardsRepository.findByIdAndUser(id, userId);
    if (!card) {
      throw new NotFoundException(`Payment card with ID ${id} not found`);
    }
    return card;
  }

  async create(userId: string, dto: CreateUserPaymentCardDto): Promise<UserPaymentCardEntity> {
    const existing = await this.cardsRepository.findByLabelAndUser(dto.label, userId);
    if (existing) {
      throw new BadRequestException(`Ya tienes una tarjeta con el nombre "${dto.label}"`);
    }

    if (dto.isDefault) {
      await this.cardsRepository.clearDefaultForUser(userId);
    }

    return this.cardsRepository.create({
      user: { connect: { id: userId } },
      label: dto.label,
      brand: dto.brand,
      color: dto.color ?? '#6366F1',
      lastFourDigits: dto.lastFourDigits ?? null,
      statementDay: dto.statementDay ?? null,
      paymentDueDay: dto.paymentDueDay ?? null,
      isDefault: dto.isDefault ?? false,
      notes: dto.notes ?? null,
    });
  }

  async update(id: string, userId: string, dto: UpdateUserPaymentCardDto): Promise<UserPaymentCardEntity> {
    await this.findOneForUser(id, userId);

    if (dto.label) {
      const clash = await this.cardsRepository.findByLabelAndUser(dto.label, userId);
      if (clash && clash.id !== id) {
        throw new BadRequestException(`Ya tienes una tarjeta con el nombre "${dto.label}"`);
      }
    }

    if (dto.isDefault) {
      await this.cardsRepository.clearDefaultForUser(userId, id);
    }

    const data: Prisma.UserPaymentCardUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.lastFourDigits !== undefined) data.lastFourDigits = dto.lastFourDigits;
    if (dto.statementDay !== undefined) data.statementDay = dto.statementDay;
    if (dto.paymentDueDay !== undefined) data.paymentDueDay = dto.paymentDueDay;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.cardsRepository.update(id, data);
  }

  async setDefault(id: string, userId: string): Promise<UserPaymentCardEntity> {
    await this.findOneForUser(id, userId);
    await this.cardsRepository.clearDefaultForUser(userId, id);
    return this.cardsRepository.update(id, { isDefault: true });
  }

  async remove(id: string, userId: string): Promise<{ card: UserPaymentCardEntity; orphanedSubscriptions: number }> {
    await this.findOneForUser(id, userId);
    const orphanedSubscriptions = await this.cardsRepository.countOrphanedSubscriptions(id);
    const card = await this.cardsRepository.delete(id);
    return { card, orphanedSubscriptions };
  }
}
