import { user } from '$lib/stores/user.store';
import { handlePromiseError } from '$lib/utils';
import { handleError } from '$lib/utils/handle-error';
import {
  createActivity,
  deleteActivity,
  getActivities,
  getActivityStatistics,
  ReactionType,
  updateActivity,
  type ActivityCreateDto,
  type ActivityResponseDto,
} from '@immich/sdk';
import { t } from 'svelte-i18n';
import { get } from 'svelte/store';

type CacheKey = string;
type ActivityCache = {
  activities: ActivityResponseDto[];
  commentCount: number;
  likeCount: number;
  reactionCount: number;
  isLiked: ActivityResponseDto | null;
  userReaction: ActivityResponseDto | null;
};

class ActivityManager {
  #albumId = $state<string | undefined>();
  #assetId = $state<string | undefined>();
  #activities = $state<ActivityResponseDto[]>([]);
  #commentCount = $state(0);
  #likeCount = $state(0);
  #reactionCount = $state(0);
  #isLiked = $state<ActivityResponseDto | null>(null);
  #userReaction = $state<ActivityResponseDto | null>(null);

  #cache = new Map<CacheKey, ActivityCache>();

  isLoading = $state(false);

  get albumId() {
    return this.#albumId;
  }

  get assetId() {
    return this.#assetId;
  }

  get activities() {
    return this.#activities;
  }

  get commentCount() {
    return this.#commentCount;
  }

  get likeCount() {
    return this.#likeCount;
  }

  get reactionCount() {
    return this.#reactionCount;
  }

  get isLiked() {
    return this.#isLiked;
  }

  get userReaction() {
    return this.#userReaction;
  }

  // Get all unique asset-level reactions for display (excludes comment reactions)
  get reactionSummary(): { reaction: string; count: number; users: { id: string; name: string }[] }[] {
    const reactionMap = new Map<string, { count: number; users: { id: string; name: string }[] }>();

    for (const activity of this.#activities) {
      // Only include asset-level reactions (no parentId means not a comment reaction)
      if (activity.type === ReactionType.Reaction && activity.reaction && !activity.parentId) {
        const existing = reactionMap.get(activity.reaction);
        if (existing) {
          existing.count++;
          existing.users.push({ id: activity.user.id, name: activity.user.name });
        } else {
          reactionMap.set(activity.reaction, { count: 1, users: [{ id: activity.user.id, name: activity.user.name }] });
        }
      }
    }

    return [...reactionMap.entries()]
      .map(([reaction, data]) => ({ reaction, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  // Get total reaction count for asset-level reactions only
  get assetReactionCount(): number {
    return this.#activities.filter((a) => a.type === ReactionType.Reaction && !a.parentId).length;
  }

  // Get total comment count including all replies
  get totalCommentCount(): number {
    return this.#activities.filter((a) => a.type === ReactionType.Comment).length;
  }

  // Get comment reactions with user details
  getCommentReactionDetails(
    commentId: string,
  ): { reaction: string; count: number; users: { id: string; name: string }[] }[] {
    const reactions = this.#activities.filter((a) => a.type === ReactionType.Reaction && a.parentId === commentId);
    const reactionMap = new Map<string, { count: number; users: { id: string; name: string }[] }>();

    for (const r of reactions) {
      if (r.reaction) {
        const existing = reactionMap.get(r.reaction);
        if (existing) {
          existing.count++;
          existing.users.push({ id: r.user.id, name: r.user.name });
        } else {
          reactionMap.set(r.reaction, { count: 1, users: [{ id: r.user.id, name: r.user.name }] });
        }
      }
    }

    return [...reactionMap.entries()]
      .map(([reaction, data]) => ({ reaction, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  // Get a comment by ID (for reply references)
  getCommentById(commentId: string): ActivityResponseDto | undefined {
    return this.#activities.find((a) => a.id === commentId && a.type === ReactionType.Comment);
  }

  #getCacheKey(albumId?: string, assetId?: string) {
    return `${albumId ?? 'none'}:${assetId ?? ''}`;
  }

  async init(albumId: string | undefined, assetId?: string) {
    if (assetId && assetId === this.#assetId) {
      return;
    }

    this.#albumId = albumId;
    this.#assetId = assetId;
    try {
      await activityManager.refreshActivities(albumId, assetId);
    } catch (error) {
      handleError(error, get(t)('errors.unable_to_get_comments_number'));
    }
  }

  #invalidateCache(albumId?: string, assetId?: string) {
    if (albumId) {
      this.#cache.delete(this.#getCacheKey(albumId));
      this.#cache.delete(this.#getCacheKey(albumId, assetId));
    }
    // Also invalidate asset-only cache
    this.#cache.delete(this.#getCacheKey(undefined, assetId));
  }

  async addActivity(dto: ActivityCreateDto) {
    const activity = await createActivity({ activityCreateDto: dto });
    this.#activities = [...this.#activities, activity];

    if (activity.type === ReactionType.Comment) {
      this.#commentCount++;
    }

    if (activity.type === ReactionType.Like) {
      this.#likeCount++;
    }

    if (activity.type === ReactionType.Reaction) {
      this.#reactionCount++;
      this.#userReaction = activity;
    }

    this.#invalidateCache(this.#albumId, this.#assetId);
    handlePromiseError(this.refreshActivities(this.#albumId, this.#assetId));
    return activity;
  }

  async updateActivity(activityId: string, comment: string) {
    const updated = await updateActivity({
      id: activityId,
      activityUpdateDto: { comment },
    });

    // Update the activity in the local state
    this.#activities = this.#activities.map((a) => (a.id === activityId ? updated : a));
    this.#invalidateCache(this.#albumId, this.#assetId);
    return updated;
  }

  async deleteActivity(activity: ActivityResponseDto, index?: number) {
    if (activity.type === ReactionType.Comment) {
      this.#commentCount--;
    }

    if (activity.type === ReactionType.Like) {
      this.#likeCount--;
    }

    if (activity.type === ReactionType.Reaction) {
      this.#reactionCount--;
      if (this.#userReaction?.id === activity.id) {
        this.#userReaction = null;
      }
    }

    // Always use filter to remove the activity - splice modifies in place and returns removed elements
    this.#activities = this.#activities.filter(({ id }) => id !== activity.id);

    await deleteActivity({ id: activity.id });
    this.#invalidateCache(this.#albumId, this.#assetId);
    handlePromiseError(this.refreshActivities(this.#albumId, this.#assetId));
  }

  async toggleLike() {
    if (this.#isLiked) {
      await this.deleteActivity(this.#isLiked);
      this.#isLiked = null;
    } else {
      this.#isLiked = (await this.addActivity({
        albumId: this.#albumId,
        assetId: this.#assetId,
        type: ReactionType.Like,
      }))!;
    }
  }

  async setReaction(emoji: string | null) {
    // If user has existing reaction, remove it first
    if (this.#userReaction) {
      await this.deleteActivity(this.#userReaction);
      this.#userReaction = null;
    }

    // Add new reaction if emoji is provided
    if (emoji) {
      this.#userReaction = (await this.addActivity({
        albumId: this.#albumId,
        assetId: this.#assetId,
        type: ReactionType.Reaction,
        reaction: emoji,
      }))!;
    }
  }

  async addComment(comment: string, parentId?: string) {
    return this.addActivity({
      albumId: this.#albumId,
      assetId: this.#assetId,
      type: ReactionType.Comment,
      comment,
      parentId,
    });
  }

  async addCommentReaction(commentId: string, emoji: string) {
    return this.addActivity({
      albumId: this.#albumId,
      assetId: this.#assetId,
      type: ReactionType.Reaction,
      reaction: emoji,
      parentId: commentId,
    });
  }

  // Get replies to a specific comment
  getReplies(parentId: string): ActivityResponseDto[] {
    return this.#activities.filter((a) => a.parentId === parentId);
  }

  // Get top-level comments (no parentId or parentId is not a comment)
  get topLevelComments(): ActivityResponseDto[] {
    const commentIds = new Set(this.#activities.filter((a) => a.type === ReactionType.Comment).map((a) => a.id));
    return this.#activities.filter(
      (a) => a.type === ReactionType.Comment && (!a.parentId || !commentIds.has(a.parentId)),
    );
  }

  async refreshActivities(albumId?: string, assetId?: string) {
    this.isLoading = true;

    const cacheKey = this.#getCacheKey(albumId, assetId);

    if (this.#cache.has(cacheKey)) {
      const cached = this.#cache.get(cacheKey)!;
      this.#activities = cached.activities;
      this.#commentCount = cached.commentCount;
      this.#likeCount = cached.likeCount;
      this.#reactionCount = cached.reactionCount;
      this.#isLiked = cached.isLiked ?? null;
      this.#userReaction = cached.userReaction ?? null;
      this.isLoading = false;
      return;
    }

    // For asset-only activities (no album), pass undefined for albumId
    this.#activities = await getActivities({ albumId, assetId });

    const currentUserId = get(user).id;

    // Find user's like
    const liked = this.#activities.find((a) => a.type === ReactionType.Like && a.user.id === currentUserId);
    this.#isLiked = liked ?? null;

    // Find user's reaction
    const reaction = this.#activities.find(
      (a) => a.type === ReactionType.Reaction && a.user.id === currentUserId && !a.parentId,
    );
    this.#userReaction = reaction ?? null;

    // Get statistics - for asset-only, albumId may be undefined
    if (albumId || assetId) {
      const stats = await getActivityStatistics({ albumId, assetId });
      this.#commentCount = stats.comments;
      this.#likeCount = stats.likes;
      this.#reactionCount = stats.reactions;
    }

    this.#cache.set(cacheKey, {
      activities: this.#activities,
      commentCount: this.#commentCount,
      likeCount: this.#likeCount,
      reactionCount: this.#reactionCount,
      isLiked: this.#isLiked,
      userReaction: this.#userReaction,
    });

    this.isLoading = false;
  }

  reset() {
    this.#albumId = undefined;
    this.#assetId = undefined;
    this.#activities = [];
    this.#commentCount = 0;
    this.#likeCount = 0;
    this.#reactionCount = 0;
    this.#userReaction = null;
  }
}

export const activityManager = new ActivityManager();
