import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UserPaymentCardsService } from './user-payment-cards.service.js';
import { CreateUserPaymentCardDto } from './dto/create-user-payment-card.dto.js';
import { UpdateUserPaymentCardDto } from './dto/update-user-payment-card.dto.js';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AllowWithoutSubscription } from '../../common/decorators/allow-without-subscription.decorator.js';

@ApiTags('Personal Space — Payment Cards')
@Controller('me/payment-cards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowWithoutSubscription()
export class UserPaymentCardsController {
  constructor(private readonly cardsService: UserPaymentCardsService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user\'s payment cards' })
  @ApiOkResponse({ description: 'Cards found.' })
  findAll(@CurrentUser('sub') userId: string) {
    return this.cardsService.findAllForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment card by ID' })
  @ApiOkResponse({ description: 'Card found.' })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.cardsService.findOneForUser(id, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a payment card' })
  @ApiCreatedResponse({ description: 'Card successfully created.' })
  @ApiBadRequestResponse({ description: 'Invalid payload or duplicate label.' })
  create(@Body() dto: CreateUserPaymentCardDto, @CurrentUser('sub') userId: string) {
    return this.cardsService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a payment card' })
  @ApiOkResponse({ description: 'Card successfully updated.' })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateUserPaymentCardDto, @CurrentUser('sub') userId: string) {
    return this.cardsService.update(id, userId, dto);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set a card as the default payment card' })
  @ApiOkResponse({ description: 'Card marked as default.' })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  setDefault(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.cardsService.setDefault(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a payment card' })
  @ApiOkResponse({ description: 'Card successfully deleted.' })
  @ApiNotFoundResponse({ description: 'Card not found.' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.cardsService.remove(id, userId);
  }
}
