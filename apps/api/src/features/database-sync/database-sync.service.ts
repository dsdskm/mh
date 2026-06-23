import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityMetadata } from 'typeorm';
import {
  DATABASE_SYNC_TABLES,
  type DatabaseSyncTable,
} from './database-sync.constants';

type DatabaseRow = Record<string, unknown>;
type DatabaseTableRows = {
  table: DatabaseSyncTable;
  rows: DatabaseRow[];
};
type ImportTableResult = {
  table: string;
  received: number;
  upserted: number;
};

@Injectable()
export class DatabaseSyncService {
  constructor(private readonly dataSource: DataSource) {}

  getManifest() {
    return {
      version: 1,
      mode: 'upsert',
      tables: DATABASE_SYNC_TABLES,
    };
  }

  async exportDatabase() {
    const tables: DatabaseTableRows[] = [];

    for (const tableName of DATABASE_SYNC_TABLES) {
      const exported = await this.exportTable(tableName);
      tables.push({
        table: tableName,
        rows: exported.rows,
      });
    }

    return {
      ...this.getManifest(),
      tables,
    };
  }

  async importDatabase(tables: unknown) {
    if (!Array.isArray(tables)) {
      throw new BadRequestException('tables는 배열이어야 합니다.');
    }

    const providedTables = new Set<string>();
    const results: ImportTableResult[] = [];
    let totalUpserted = 0;

    for (const [index, entry] of tables.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new BadRequestException(`tables[${index}]가 객체가 아닙니다.`);
      }

      const record = entry as {
        table?: unknown;
        rows?: unknown;
      };
      if (typeof record.table !== 'string') {
        throw new BadRequestException(`tables[${index}].table은 문자열이어야 합니다.`);
      }
      if (providedTables.has(record.table)) {
        throw new BadRequestException(`중복된 테이블이 포함되어 있습니다: ${record.table}`);
      }

      providedTables.add(record.table);
      const imported = await this.importTable(record.table, record.rows);
      results.push(imported);
      totalUpserted += imported.upserted;
    }

    const missingTables = DATABASE_SYNC_TABLES.filter(
      (tableName) => !providedTables.has(tableName),
    );
    if (missingTables.length > 0) {
      throw new BadRequestException(
        `누락된 테이블이 있습니다: ${missingTables.join(', ')}`,
      );
    }

    return {
      version: this.getManifest().version,
      mode: this.getManifest().mode,
      importedTables: results.length,
      totalUpserted,
      results,
    };
  }

  async exportTable(tableName: string) {
    const metadata = this.getMetadata(tableName);
    const orderBy = metadata.primaryColumns
      .map((column) => this.quoteIdentifier(column.databaseName))
      .join(', ');
    const rows: DatabaseRow[] = await this.dataSource.query(
      `SELECT * FROM ${this.quoteIdentifier(metadata.tableName)}${
        orderBy ? ` ORDER BY ${orderBy}` : ''
      }`,
    );

    return {
      table: tableName,
      count: rows.length,
      rows,
    };
  }

  async importTable(tableName: string, rows: unknown) {
    const metadata = this.getMetadata(tableName);
    if (!Array.isArray(rows)) {
      throw new BadRequestException('rows는 배열이어야 합니다.');
    }

    if (rows.length === 0) {
      return { table: tableName, received: 0, upserted: 0 };
    }

    const allowedColumns = new Set(
      metadata.columns.map((column) => column.databaseName),
    );
    const primaryColumns = metadata.primaryColumns.map(
      (column) => column.databaseName,
    );
    if (primaryColumns.length === 0) {
      throw new BadRequestException(`${tableName} 테이블에 기본키가 없습니다.`);
    }

    const normalizedRows = rows.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new BadRequestException(`rows[${index}]가 객체가 아닙니다.`);
      }

      const record = row as DatabaseRow;
      for (const key of Object.keys(record)) {
        if (!allowedColumns.has(key)) {
          throw new BadRequestException(
            `${tableName}.${key} 컬럼은 동기화 대상이 아닙니다.`,
          );
        }
      }
      for (const primaryColumn of primaryColumns) {
        if (
          record[primaryColumn] === undefined ||
          record[primaryColumn] === null
        ) {
          throw new BadRequestException(
            `rows[${index}].${primaryColumn} 기본키가 필요합니다.`,
          );
        }
      }
      return record;
    });

    const columns = metadata.columns
      .map((column) => column.databaseName)
      .filter((column) =>
        normalizedRows.some((row) => row[column] !== undefined),
      );
    const updateColumns = columns.filter(
      (column) => !primaryColumns.includes(column),
    );
    const maxRowsPerQuery = Math.max(1, Math.floor(60000 / columns.length));

    await this.dataSource.transaction(async (manager) => {
      for (
        let offset = 0;
        offset < normalizedRows.length;
        offset += maxRowsPerQuery
      ) {
        const chunk = normalizedRows.slice(offset, offset + maxRowsPerQuery);
        const parameters: unknown[] = [];
        const valuesSql = chunk
          .map((row) => {
            const placeholders = columns.map((column) => {
              parameters.push(row[column] ?? null);
              return `$${parameters.length}`;
            });
            return `(${placeholders.join(', ')})`;
          })
          .join(', ');
        const conflictSql =
          updateColumns.length > 0
            ? `DO UPDATE SET ${updateColumns
                .map(
                  (column) =>
                    `${this.quoteIdentifier(column)} = EXCLUDED.${this.quoteIdentifier(column)}`,
                )
                .join(', ')}`
            : 'DO NOTHING';

        await manager.query(
          `INSERT INTO ${this.quoteIdentifier(metadata.tableName)}
            (${columns.map((column) => this.quoteIdentifier(column)).join(', ')})
           VALUES ${valuesSql}
           ON CONFLICT (${primaryColumns
             .map((column) => this.quoteIdentifier(column))
             .join(', ')}) ${conflictSql}`,
          parameters,
        );
      }

      await this.resetGeneratedSequences(manager, metadata);
    });

    return {
      table: tableName,
      received: normalizedRows.length,
      upserted: normalizedRows.length,
    };
  }

  private getMetadata(tableName: string): EntityMetadata {
    if (!DATABASE_SYNC_TABLES.includes(tableName as DatabaseSyncTable)) {
      throw new NotFoundException(
        `동기화할 수 없는 테이블입니다: ${tableName}`,
      );
    }

    const metadata = this.dataSource.entityMetadatas.find(
      (entity) => entity.tableName === tableName,
    );
    if (!metadata) {
      throw new NotFoundException(`테이블 메타데이터가 없습니다: ${tableName}`);
    }
    return metadata;
  }

  private async resetGeneratedSequences(
    manager: {
      query: (query: string, parameters?: unknown[]) => Promise<unknown>;
    },
    metadata: EntityMetadata,
  ) {
    for (const column of metadata.primaryColumns) {
      if (!column.isGenerated || column.generationStrategy !== 'increment') {
        continue;
      }

      await manager.query(
        `SELECT setval(
          pg_get_serial_sequence($1, $2),
          COALESCE((SELECT MAX(${this.quoteIdentifier(column.databaseName)})
                    FROM ${this.quoteIdentifier(metadata.tableName)}), 1),
          EXISTS(SELECT 1 FROM ${this.quoteIdentifier(metadata.tableName)})
        )`,
        [metadata.tableName, column.databaseName],
      );
    }
  }

  private quoteIdentifier(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }
}
