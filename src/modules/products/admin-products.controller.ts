import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { AdminCreateProductDto } from './dto/admin-create-product.dto';
import { AdminUpdateProductDto } from './dto/admin-update-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../audit-logs/audit-logs.interceptor';
import { AuditLogAction } from '../audit-logs/audit-logs.decorator';

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('admin', 'manager')
  async findAll(
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      status?: 'active' | 'inactive';
      stockStatus?: 'in_stock' | 'out_of_stock' | 'low_stock';
      sortBy?: 'name' | 'price' | 'stock' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    return this.productsService.adminFindAll(query);
  }

  @Post()
  @Roles('admin', 'manager')
  @AuditLogAction('PRODUCT_CREATED', 'products')
  async create(@Body() dto: AdminCreateProductDto) {
    return this.productsService.adminCreate(dto);
  }

  @Get(':id')
  @Roles('admin', 'manager')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  @AuditLogAction('PRODUCT_UPDATED', 'products')
  async update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateProductDto,
  ) {
    return this.productsService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @AuditLogAction('PRODUCT_DELETED', 'products')
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }

  @Post('bulk-update')
  @Roles('admin', 'manager')
  @AuditLogAction('PRODUCT_BULK_UPDATED', 'products')
  async bulkUpdate(
    @Body()
    dto: {
      productIds: string[];
      updates: { status?: boolean; stock?: number; price?: number };
    },
  ) {
    return this.productsService.adminBulkUpdate(dto);
  }

  @Post('import')
  @Roles('admin', 'manager')
  @UseInterceptors(FileInterceptor('file'))
  @AuditLogAction('PRODUCT_IMPORT_CSV', 'products')
  async importCsv(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    return this.productsService.adminImportCsv(file.buffer);
  }
}
