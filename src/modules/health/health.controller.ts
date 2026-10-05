import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators.js';
import { DatabaseHealthIndicator } from './database.health.js';

@Public()
// Frequent probes from one load balancer IP must never be rate limited.
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /**
   * Liveness: the process is up. Deliberately checks no dependencies, so a
   * database outage does not make the orchestrator restart every instance.
   */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /** Readiness: dependencies are reachable, so the instance can take traffic. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.database.check()]);
  }
}
