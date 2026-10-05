import { Type } from 'class-transformer';
import { IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { AppException } from './app.exception.js';
import { createValidationPipe } from './validation.js';

class ItemDto {
  @IsInt()
  @Min(1)
  quantity: number;
}

class OrderDto {
  @IsString()
  note: string;

  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();
  const validate = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: OrderDto });

  it('reports one entry per failed rule with nested field paths', async () => {
    const error: unknown = await validate({
      note: 42,
      items: [{ quantity: 2 }, { quantity: 0 }],
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppException);
    const exception = error as AppException;
    expect(exception.code).toBe('VALIDATION_FAILED');
    expect(exception.getStatus()).toBe(400);
    expect(exception.errors).toEqual([
      { field: 'note', code: 'isString', message: 'note must be a string' },
      {
        field: 'items[1].quantity',
        code: 'min',
        message: 'quantity must not be less than 1',
      },
    ]);
  });
});
