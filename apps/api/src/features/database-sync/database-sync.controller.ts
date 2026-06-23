import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DatabaseSyncService } from './database-sync.service';

type ImportTableBody = {
  rows?: unknown;
};

type ImportDatabaseBody = {
  tables?: unknown;
};

@Controller('api/backoffice/database-sync')
export class DatabaseSyncController {
  constructor(private readonly databaseSyncService: DatabaseSyncService) {}

  @Get('manifest')
  getManifest() {
    return this.databaseSyncService.getManifest();
  }

  @Get('export')
  exportDatabase() {
    return this.databaseSyncService.exportDatabase();
  }

  @Post('import')
  importDatabase(@Body() body: ImportDatabaseBody) {
    return this.databaseSyncService.importDatabase(body.tables);
  }

  @Get('tables/:tableName')
  exportTable(@Param('tableName') tableName: string) {
    return this.databaseSyncService.exportTable(tableName);
  }

  @Post('tables/:tableName')
  importTable(
    @Param('tableName') tableName: string,
    @Body() body: ImportTableBody,
  ) {
    return this.databaseSyncService.importTable(tableName, body.rows);
  }
}
