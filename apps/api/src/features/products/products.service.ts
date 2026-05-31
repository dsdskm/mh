import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../../database/entities/product.entity';
import { CreateProductInput, Product, UpdateProductInput } from '../../shared/store.types';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) {}

  async getProducts(): Promise<Product[]> {
    const products = await this.productRepository.find({
      where: { active: true },
      order: { createdAt: 'DESC' },
    });

    return products.map((product) => this.toProduct(product));
  }

  async getProductById(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, active: true },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return this.toProduct(product);
  }

  async getAdminProducts(): Promise<Product[]> {
    const products = await this.productRepository.find({
      order: { createdAt: 'DESC' },
    });

    return products.map((product) => this.toProduct(product));
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    const product = await this.productRepository.save(
      this.productRepository.create({
        id: this.createProductId(),
        name: input.name,
        description: input.description,
        price: input.price,
        stock: input.stock,
        imageUrl: input.imageUrl,
        badge: input.badge,
        active: input.active ?? true,
      }),
    );

    return this.toProduct(product);
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('수정할 상품을 찾을 수 없습니다.');
    }

    const updated = await this.productRepository.save({
      ...product,
      name: input.name ?? product.name,
      description: input.description ?? product.description,
      price: input.price ?? product.price,
      stock: input.stock ?? product.stock,
      imageUrl: input.imageUrl ?? product.imageUrl,
      badge: input.badge ?? product.badge,
      active: input.active ?? product.active,
    });

    return this.toProduct(updated);
  }

  private createProductId(): string {
    return `corn-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;
  }

  private toProduct(product: ProductEntity): Product {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      imageUrl: product.imageUrl,
      badge: product.badge,
      active: product.active,
    };
  }
}
