import { IsArray, IsIn, IsInt } from 'class-validator';

export class BulkActionDto {
  @IsArray()
  @IsInt({ each: true })
  ids: number[];

  @IsIn(['delete', 'active', 'inactive'])
  action: 'delete' | 'active' | 'inactive';
}
