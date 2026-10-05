import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';
import {
  userRoles,
  type User,
  type UserRole,
} from '../../infrastructure/database/schema/index.js';

/** Public shape of a user; never exposes the password hash. */
export class UserResponseDto {
  id: string;
  email: string;
  @ApiProperty({ enum: userRoles })
  role: UserRole;
  createdAt: Date;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}

export class PaginatedUsersDto {
  data: UserResponseDto[];
  meta: PaginationMetaDto;
}
