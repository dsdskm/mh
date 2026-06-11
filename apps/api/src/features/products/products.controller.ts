import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';

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
}
