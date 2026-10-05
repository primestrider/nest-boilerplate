import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import {
  DRIZZLE,
  type Database,
} from '../../infrastructure/database/database.js';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  check() {
    return this.healthIndicatorService
      .check('database')
      .attempt(async () => {
        await this.db.execute(sql`SELECT 1`);
      })
      .withTimeout(3000);
  }
}
