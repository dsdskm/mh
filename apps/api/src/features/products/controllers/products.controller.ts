import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ProductsService } from '../services/products.service';

type CreateProductBody = {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  totalQuantity?: number;
  imageUrl?: string;
  badge?: string;
  active?: boolean;
};

@Controller('api')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  getProducts() {
    return this.productsService.getProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new BadRequestException('상품 id가 올바르지 않습니다.');
    }

    return this.productsService.getProductById(productId);
  }

  // Backoffice endpoints
  @Get('backoffice/products')
  getBackofficeProducts() {
    return this.productsService.getAdminProducts();
  }

  @Post('backoffice/products')
  async createProduct(@Body() body: CreateProductBody) {
    if (
      !body.name ||
      !body.description ||
      !body.imageUrl ||
      !body.badge ||
      typeof body.price !== 'number' ||
      typeof body.stock !== 'number' ||
      typeof body.totalQuantity !== 'number'
    ) {
      throw new BadRequestException('상품 필수값을 확인해주세요.');
    }

    if (body.stock > body.totalQuantity) {
      throw new BadRequestException('재고는 총 수량을 초과할 수 없습니다.');
    }

    return this.productsService.createProduct({
      name: body.name,
      description: body.description,
      price: body.price,
      stock: body.stock,
      totalQuantity: body.totalQuantity,
      imageUrl: body.imageUrl,
      badge: body.badge,
      active: body.active,
    });
  }

  @Patch('backoffice/products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() body: CreateProductBody,
  ) {
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new BadRequestException('상품 id가 올바르지 않습니다.');
    }

    if (
      typeof body.stock === 'number' &&
      typeof body.totalQuantity === 'number' &&
      body.stock > body.totalQuantity
    ) {
      throw new BadRequestException('재고는 총 수량을 초과할 수 없습니다.');
    }

    return this.productsService.updateProduct(productId, body);
  }

  @Delete('backoffice/products/:id')
  async deleteProduct(@Param('id') id: string) {
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      throw new BadRequestException('상품 id가 올바르지 않습니다.');
    }

    const deleted = await this.productsService.deleteProduct(productId);
    if (!deleted) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return { ok: true };
  }
}
