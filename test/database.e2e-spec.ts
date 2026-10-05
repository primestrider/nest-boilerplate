import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { eq } from 'drizzle-orm';
import { AppModule } from './../src/app.module.js';
import type { DatabaseAdapter } from './../src/infrastructure/database/database.js';
import { users } from './../src/infrastructure/database/schema/index.js';

describe('Database (e2e)', () => {
  let app: INestApplication;
  let txHost: TransactionHost<DatabaseAdapter>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    txHost = app.get(TransactionHost);
  });

  afterAll(async () => {
    await app.close();
  });

  const findByEmail = (email: string) =>
    txHost.tx.select().from(users).where(eq(users.email, email));

  it('commits writes made inside a transaction', async () => {
    const email = 'commit@test.local';
    await txHost.withTransaction(() =>
      txHost.tx.insert(users).values({ email, passwordHash: 'x' }),
    );

    const [user] = await findByEmail(email);
    expect(user).toMatchObject({ email, role: 'user' });
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('rolls back every write when the transaction fails', async () => {
    const email = 'rollback@test.local';
    await expect(
      txHost.withTransaction(async () => {
        await txHost.tx.insert(users).values({ email, passwordHash: 'x' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await findByEmail(email)).toHaveLength(0);
  });
});
