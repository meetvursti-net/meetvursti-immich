import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Activity } from 'src/database';
import { mapUser, UserResponseDto } from 'src/dtos/user.dto';
import { ValidateEnum, ValidateUUID } from 'src/validation';

export enum ReactionType {
  COMMENT = 'comment',
  LIKE = 'like',
  REACTION = 'reaction',
}

export enum ReactionLevel {
  ALBUM = 'album',
  ASSET = 'asset',
}

export type MaybeDuplicate<T> = { duplicate: boolean; value: T };

export class ActivityResponseDto {
  id!: string;
  createdAt!: Date;
  @ValidateEnum({ enum: ReactionType, name: 'ReactionType' })
  type!: ReactionType;
  user!: UserResponseDto;
  assetId!: string | null;
  albumId!: string | null;
  comment?: string | null;
  reaction?: string | null;
  parentId?: string | null;
  editedAt?: Date | null;
}

export class ActivityStatisticsResponseDto {
  @ApiProperty({ type: 'integer' })
  comments!: number;

  @ApiProperty({ type: 'integer' })
  likes!: number;

  @ApiProperty({ type: 'integer' })
  reactions!: number;
}

export class ActivityDto {
  @ValidateUUID({ optional: true })
  albumId?: string;

  @ValidateUUID({ optional: true })
  assetId?: string;
}

export class ActivitySearchDto extends ActivityDto {
  @ValidateEnum({ enum: ReactionType, name: 'ReactionType', optional: true })
  type?: ReactionType;

  @ValidateEnum({ enum: ReactionLevel, name: 'ReactionLevel', optional: true })
  level?: ReactionLevel;

  @ValidateUUID({ optional: true })
  userId?: string;

  @ValidateUUID({ optional: true })
  parentId?: string;
}

const isComment = (dto: ActivityCreateDto) => dto.type === ReactionType.COMMENT;
const isReaction = (dto: ActivityCreateDto) => dto.type === ReactionType.REACTION;

export class ActivityCreateDto extends ActivityDto {
  @ValidateEnum({ enum: ReactionType, name: 'ReactionType' })
  type!: ReactionType;

  @ValidateIf(isComment)
  @IsNotEmpty()
  @IsString()
  comment?: string;

  @ValidateIf(isReaction)
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  reaction?: string;

  @ValidateUUID({ optional: true })
  parentId?: string;
}

export class ActivityUpdateDto {
  @IsNotEmpty()
  @IsString()
  comment!: string;
}

export const mapActivity = (activity: Activity): ActivityResponseDto => {
  let type: ReactionType;
  if (activity.reaction) {
    type = ReactionType.REACTION;
  } else if (activity.isLiked) {
    type = ReactionType.LIKE;
  } else {
    type = ReactionType.COMMENT;
  }

  return {
    id: activity.id,
    assetId: activity.assetId,
    albumId: activity.albumId,
    createdAt: activity.createdAt,
    comment: activity.comment,
    reaction: activity.reaction,
    parentId: activity.parentId,
    editedAt: activity.editedAt,
    type,
    user: mapUser(activity.user),
  };
};
