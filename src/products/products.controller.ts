import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service.js';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductSchema,
  UpdateProductSchema,
} from './dto.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@ApiTags('Products')
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Listado de productos con filtros de búsqueda y categoría' })
  @ApiQuery({ name: 'search', required: false, description: 'Búsqueda por nombre o SKU' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filtrar por categoría' })
  async findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const catIdNum = categoryId ? parseInt(categoryId, 10) : undefined;
    return this.productsService.findAll(search, catIdNum);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Listar todas las categorías disponibles' })
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crear una nueva categoría' })
  async createCategory(@Body() body: { name: string; description?: string }) {
    return this.productsService.createCategory(body.name, body.description);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el detalle de un producto por ID' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo producto en el catálogo' })
  async create(
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto,
  ) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar producto existente por ID' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar producto por ID' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
