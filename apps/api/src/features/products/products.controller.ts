import { Controller, Get, Param } from '@nestjs/common';
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
    return this.productsService.getProductById(id);
  }
}
