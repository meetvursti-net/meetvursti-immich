import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Activity } from 'src/database';
import {
  ActivityCreateDto,
  ActivityDto,
  ActivityResponseDto,
  ActivitySearchDto,
  ActivityStatisticsResponseDto,
  ActivityUpdateDto,
  mapActivity,
  MaybeDuplicate,
  ReactionLevel,
  ReactionType,
} from 'src/dtos/activity.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { Permission } from 'src/enum';
import { BaseService } from 'src/services/base.service';

@Injectable()
export class ActivityService extends BaseService {
  async getAll(auth: AuthDto, dto: ActivitySearchDto): Promise<ActivityResponseDto[]> {
    // For album activities, check album access
    if (dto.albumId) {
      await this.requireAccess({ auth, permission: Permission.AlbumRead, ids: [dto.albumId] });
    }
    // For asset-only activities (no album), check asset access
    else if (dto.assetId) {
      await this.requireAccess({ auth, permission: Permission.AssetRead, ids: [dto.assetId] });
    } else {
      throw new BadRequestException('Either albumId or assetId must be provided');
    }

    const activities = await this.activityRepository.search({
      userId: dto.userId,
      albumId: dto.albumId ?? null,
      assetId: dto.level === ReactionLevel.ALBUM ? null : dto.assetId,
      isLiked: dto.type === ReactionType.LIKE ? true : undefined,
      // Only filter by parentId if explicitly provided, otherwise get all activities including replies
      parentId: dto.parentId,
      assetOnly: !dto.albumId && !!dto.assetId,
    });

    return activities.map((activity) => mapActivity(activity));
  }

  async getStatistics(auth: AuthDto, dto: ActivityDto): Promise<ActivityStatisticsResponseDto> {
    // For album activities, check album access
    if (dto.albumId) {
      await this.requireAccess({ auth, permission: Permission.AlbumRead, ids: [dto.albumId] });
    }
    // For asset-only activities, check asset access
    else if (dto.assetId) {
      await this.requireAccess({ auth, permission: Permission.AssetRead, ids: [dto.assetId] });
    } else {
      throw new BadRequestException('Either albumId or assetId must be provided');
    }

    return await this.activityRepository.getStatistics({ albumId: dto.albumId, assetId: dto.assetId });
  }

  async create(auth: AuthDto, dto: ActivityCreateDto): Promise<MaybeDuplicate<ActivityResponseDto>> {
    // Validate that either albumId or assetId is provided
    if (!dto.albumId && !dto.assetId && !dto.parentId) {
      throw new BadRequestException('Either albumId, assetId, or parentId must be provided');
    }

    // For album activities, check album activity permission
    if (dto.albumId) {
      await this.requireAccess({ auth, permission: Permission.ActivityCreate, ids: [dto.albumId] });
    }
    // For asset-only activities (no album), check asset access
    else if (dto.assetId) {
      await this.requireAccess({ auth, permission: Permission.AssetRead, ids: [dto.assetId] });
    }
    // For replies/reactions to comments, verify parent exists and get context
    else if (dto.parentId) {
      const parent = await this.activityRepository.getById(dto.parentId);
      if (!parent) {
        throw new NotFoundException('Parent activity not found');
      }
      // Inherit albumId and assetId from parent
      dto.albumId = parent.albumId ?? undefined;
      dto.assetId = parent.assetId ?? undefined;

      // Check access based on parent's context
      if (parent.albumId) {
        await this.requireAccess({ auth, permission: Permission.ActivityCreate, ids: [parent.albumId] });
      } else if (parent.assetId) {
        await this.requireAccess({ auth, permission: Permission.AssetRead, ids: [parent.assetId] });
      }
    }

    const common = {
      userId: auth.user.id,
      assetId: dto.assetId ?? null,
      albumId: dto.albumId ?? null,
      parentId: dto.parentId ?? null,
    };

    let activity: Activity | undefined;
    let duplicate = false;

    // Handle likes (legacy)
    if (dto.type === ReactionType.LIKE) {
      delete dto.comment;
      delete dto.reaction;
      [activity] = await this.activityRepository.search({
        ...common,
        assetId: dto.assetId ?? null,
        isLiked: true,
      });
      duplicate = !!activity;
    }
    // Handle emoji reactions
    else if (dto.type === ReactionType.REACTION) {
      if (!dto.reaction) {
        throw new BadRequestException('Reaction emoji is required for reaction type');
      }
      delete dto.comment;
      // Check for duplicate reaction with same emoji
      [activity] = await this.activityRepository.search({
        ...common,
        assetId: dto.assetId ?? null,
        reaction: dto.reaction,
      });
      duplicate = !!activity;
    }

    if (!activity) {
      activity = await this.activityRepository.create({
        ...common,
        isLiked: dto.type === ReactionType.LIKE,
        reaction: dto.type === ReactionType.REACTION ? dto.reaction : null,
        comment: dto.type === ReactionType.COMMENT ? dto.comment : null,
      });
    }

    return { duplicate, value: mapActivity(activity) };
  }

  async update(auth: AuthDto, id: string, dto: ActivityUpdateDto): Promise<ActivityResponseDto> {
    // First check if user owns this activity
    await this.requireAccess({ auth, permission: Permission.ActivityDelete, ids: [id] });

    // Get the activity to verify it's a comment
    const activity = await this.activityRepository.getById(id);
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    // Only comments can be edited
    if (activity.isLiked || activity.reaction) {
      throw new BadRequestException('Only comments can be edited');
    }

    // Verify the user owns this comment
    if (activity.userId !== auth.user.id) {
      throw new BadRequestException('You can only edit your own comments');
    }

    const updated = await this.activityRepository.update(id, {
      comment: dto.comment,
      editedAt: new Date(),
    });

    return mapActivity(updated);
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.ActivityDelete, ids: [id] });
    await this.activityRepository.delete(id);
  }
}
