import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RecipesService } from './recipes.service.js';
import { CreateRecipeDto } from './dto/create-recipe.dto.js';
import { UpdateRecipeDto } from './dto/update-recipe.dto.js';
import { FindRecipesDto } from './dto/find-recipes.dto.js';
import { ToggleRecipeActiveDto } from './dto/toggle-recipe-active.dto.js';
import { AddRecipeNoteDto } from './dto/add-recipe-note.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiSecurity,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role, GlobalRole } from '@prisma/client';
import { PageDto } from '../../common/pagination/page.dto.js';

@ApiTags('Recipes')
@ApiBearerAuth()
@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  // --- RUTA GLOBAL ADMIN (declarada antes de :id) ---

  @Get('global/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.ADMIN)
  @ApiOperation({ summary: 'Get all recipes globally (Global Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAllGlobal(@Query() findOptionsDto: FindRecipesDto) {
    return this.recipesService.findAll(findOptionsDto);
  }

  // --- RUTAS DE ORGANIZACIÓN ---

  @Post()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create recipe (Org Owner / Org Admin)',
    description:
      'El campo `content` debe incluir `ingredients`, `steps` y `metadata`. ' +
      'Los pasos se ordenan automáticamente por `order`. ' +
      'Los ingredientes deben tener `quantity > 0`.',
  })
  @ApiCreatedResponse({ description: 'Recipe created successfully.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  create(@Body() createRecipeDto: CreateRecipeDto) {
    return this.recipesService.create(createRecipeDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'List recipes paginated (Org Owner / Org Admin)' })
  @ApiOkResponse({ type: PageDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findAll(@Query() findOptionsDto: FindRecipesDto) {
    return this.recipesService.findAll(findOptionsDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Get recipe by ID (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Recipe found.' })
  @ApiNotFoundResponse({ description: 'Recipe not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  findOne(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({
    summary: 'Update recipe (Org Owner / Org Admin)',
    description:
      'Se puede actualizar el `content` completo o solo los campos de texto. ' +
      'Al actualizar, las validaciones de dominio (pasos únicos, qty > 0) se aplican igual que en la creación.',
  })
  @ApiOkResponse({ description: 'Recipe updated successfully.' })
  @ApiNotFoundResponse({ description: 'Recipe not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  update(@Param('id') id: string, @Body() updateRecipeDto: UpdateRecipeDto) {
    return this.recipesService.update(id, updateRecipeDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Toggle active status (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Status updated.' })
  @ApiNotFoundResponse({ description: 'Recipe not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  toggleActive(
    @Param('id') id: string,
    @Body() toggleDto: ToggleRecipeActiveDto,
  ) {
    return this.recipesService.toggleActive(id, toggleDto.isActive);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add note to recipe (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Note appended.' })
  @ApiNotFoundResponse({ description: 'Recipe not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  addNote(@Param('id') id: string, @Body() noteDto: AddRecipeNoteDto) {
    return this.recipesService.addNote(id, noteDto.notes);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, OrgRolesGuard)
  @OrgRoles(Role.OWNER, Role.ADMINISTRATOR)
  @ApiSecurity('x-organization-id')
  @ApiOperation({ summary: 'Delete recipe (Org Owner / Org Admin)' })
  @ApiOkResponse({ description: 'Recipe deleted.' })
  @ApiNotFoundResponse({ description: 'Recipe not found.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  remove(@Param('id') id: string) {
    return this.recipesService.remove(id);
  }
}
