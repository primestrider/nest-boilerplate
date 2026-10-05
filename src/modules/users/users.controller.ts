import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppException } from '../../common/errors/app.exception.js';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { PaginatedUsersDto, UserResponseDto } from './user-response.dto.js';
import { UsersRepository } from './users.repository.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersRepository) {}

  @Get('me')
  async me(@CurrentUser() current: AuthUser): Promise<UserResponseDto> {
    const user = await this.users.findById(current.id);
    // The token can outlive a deleted account.
    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'USER_NOT_FOUND',
        'User not found',
      );
    }
    return UserResponseDto.from(user);
  }

  @Get()
  @Roles('admin')
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedUsersDto> {
    const { items, total } = await this.users.list(query);
    return {
      data: items.map((user) => UserResponseDto.from(user)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }
}
