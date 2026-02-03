<script lang="ts">
  import { clickOutside } from '$lib/actions/click-outside';
  import { shortcut } from '$lib/actions/shortcut';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/button-context-menu.svelte';
  import MenuOption from '$lib/components/shared-components/context-menu/menu-option.svelte';
  import EmojiPicker from '$lib/components/shared-components/emoji-picker.svelte';
  import { timeBeforeShowLoadingSpinner } from '$lib/constants';
  import { activityManager } from '$lib/managers/activity-manager.svelte';
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { Route } from '$lib/route';
  import { locale } from '$lib/stores/preferences.store';
  import { getAssetThumbnailUrl } from '$lib/utils';
  import { getAssetType } from '$lib/utils/asset-utils';
  import { handleError } from '$lib/utils/handle-error';
  import { isTenMinutesApart } from '$lib/utils/timesince';
  import { ReactionType, type ActivityResponseDto, type AssetTypeEnum, type UserResponseDto } from '@immich/sdk';
  import { Icon, IconButton, LoadingSpinner, Textarea, toastManager } from '@immich/ui';
  import {
    mdiClose,
    mdiDeleteOutline,
    mdiDotsVertical,
    mdiEmoticonOutline,
    mdiPencilOutline,
    mdiReply,
    mdiSend,
    mdiThumbUp,
  } from '@mdi/js';
  import * as luxon from 'luxon';
  import { t } from 'svelte-i18n';
  import { fromAction } from 'svelte/attachments';
  import UserAvatar from '../shared-components/user-avatar.svelte';

  const units: Intl.RelativeTimeFormatUnit[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];

  const shouldGroup = (currentDate: string, nextDate: string): boolean => {
    const currentDateTime = luxon.DateTime.fromISO(currentDate, { locale: $locale });
    const nextDateTime = luxon.DateTime.fromISO(nextDate, { locale: $locale });

    return currentDateTime.hasSame(nextDateTime, 'hour') || currentDateTime.toRelative() === nextDateTime.toRelative();
  };

  const timeSince = (dateTime: luxon.DateTime) => {
    const diff = dateTime.diffNow().shiftTo(...units);
    const unit = units.find((unit) => diff.get(unit) !== 0) || 'second';

    const relativeFormatter = new Intl.RelativeTimeFormat($locale, {
      numeric: 'auto',
    });
    return relativeFormatter.format(Math.trunc(diff.as(unit)), unit);
  };

  interface Props {
    user: UserResponseDto;
    assetId?: string | undefined;
    albumId?: string | undefined;
    assetType?: AssetTypeEnum | undefined;
    albumOwnerId?: string | undefined;
    disabled: boolean;
  }

  let {
    user,
    assetId = undefined,
    albumId = undefined,
    assetType = undefined,
    albumOwnerId = undefined,
    disabled,
  }: Props = $props();

  let innerHeight: number = $state(0);
  let activityHeight: number = $state(0);
  let chatHeight: number = $state(0);
  let divHeight = $derived(innerHeight - activityHeight);
  let previousAssetId: string | undefined = $state(assetId);
  let message = $state('');
  let isSendingMessage = $state(false);

  // Editing state
  let editingCommentId = $state<string | null>(null);
  let editingMessage = $state('');

  // Reply state - WhatsApp/Telegram style
  let replyingToComment = $state<ActivityResponseDto | null>(null);

  // Emoji picker for comment reactions
  let showEmojiPickerForComment = $state<string | null>(null);

  // Click-based reaction dropdown for asset reactions
  let showReactionDropdown = $state<string | null>(null);

  // Click-based reaction dropdown for comment reactions
  let showCommentReactionDropdown = $state<string | null>(null);

  const timeOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const handleDeleteReaction = async (reaction: ActivityResponseDto, index: number) => {
    try {
      await activityManager.deleteActivity(reaction, index);

      const deleteMessages: Record<ReactionType, string> = {
        [ReactionType.Comment]: $t('comment_deleted'),
        [ReactionType.Like]: $t('like_deleted'),
        [ReactionType.Reaction]: $t('reaction_deleted'),
      };
      toastManager.success(deleteMessages[reaction.type]);
    } catch (error) {
      handleError(error, $t('errors.unable_to_remove_reaction'));
    }
  };

  const handleSendComment = async () => {
    if (!message) {
      return;
    }
    const timeout = setTimeout(() => (isSendingMessage = true), timeBeforeShowLoadingSpinner);
    try {
      // If replying to a comment, send as a reply
      const parentId = replyingToComment?.id;
      await activityManager.addComment(message, parentId);
      message = '';
      replyingToComment = null;
    } catch (error) {
      handleError(error, $t('errors.unable_to_add_comment'));
    } finally {
      clearTimeout(timeout);
    }
    isSendingMessage = false;
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingMessage.trim()) {
      return;
    }
    try {
      await activityManager.updateActivity(commentId, editingMessage);
      editingCommentId = null;
      editingMessage = '';
      toastManager.success($t('comment_updated'));
    } catch (error) {
      handleError(error, $t('errors.unable_to_update_comment'));
    }
  };

  const startEditingComment = (comment: ActivityResponseDto) => {
    editingCommentId = comment.id;
    editingMessage = comment.comment || '';
  };

  const cancelEditing = () => {
    editingCommentId = null;
    editingMessage = '';
  };

  const startReply = (comment: ActivityResponseDto) => {
    replyingToComment = comment;
    // Focus the main input field
    const inputElement = document.querySelector('textarea[placeholder]') as HTMLTextAreaElement;
    inputElement?.focus();
  };

  const cancelReply = () => {
    replyingToComment = null;
  };

  const handleCommentReaction = async (commentId: string, emoji: string) => {
    try {
      await activityManager.addCommentReaction(commentId, emoji);
      showEmojiPickerForComment = null;
    } catch (error) {
      handleError(error, $t('errors.unable_to_add_reaction'));
    }
  };

  // Scroll to and highlight a referenced comment
  const scrollToComment = (commentId: string) => {
    const element = document.getElementById(`comment-${commentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-glow');
      setTimeout(() => {
        element.classList.remove('highlight-glow');
      }, 2000);
    }
  };

  $effect(() => {
    if (assetId && previousAssetId != assetId) {
      previousAssetId = assetId;
    }
  });

  const onsubmit = async (event: Event) => {
    event.preventDefault();
    await handleSendComment();
  };

  // State for the asset-level reaction picker
  let showAssetReactionPicker = $state(false);
  let assetReactionPickerPosition = $state<'above' | 'below'>('below');
</script>

<div class="overflow-y-hidden relative h-full border-l border-subtle bg-subtle" bind:offsetHeight={innerHeight}>
  <div class="w-full h-full">
    <div class="flex w-full h-fit dark:text-immich-dark-fg p-2 bg-subtle" bind:clientHeight={activityHeight}>
      <div class="flex place-items-center gap-2 flex-1">
        <IconButton
          shape="round"
          variant="ghost"
          color="secondary"
          onclick={() => assetViewerManager.closeActivityPanel()}
          icon={mdiClose}
          aria-label={$t('close')}
        />

        <p class="text-lg text-immich-fg dark:text-immich-dark-fg">{$t('activity')}</p>
      </div>
    </div>
    {#if innerHeight}
      <div
        class="overflow-y-auto immich-scrollbar relative w-full px-2"
        style="height: {divHeight}px;padding-bottom: {chatHeight}px"
      >
        <!-- Facebook-style Reaction Summary Bar -->
        {#if activityManager.reactionSummary.length > 0 || !disabled}
          <div class="flex items-center justify-between py-3 px-2 border-b border-gray-200 dark:border-gray-700">
            <!-- Reactions display (left side) - individual reaction counts -->
            <div class="flex items-center gap-1 flex-wrap">
              {#if activityManager.reactionSummary.length > 0}
                {#each activityManager.reactionSummary as { reaction, count, users }}
                  <div class="relative" use:clickOutside={{ onOutclick: () => (showReactionDropdown = null) }}>
                    <button
                      type="button"
                      class="flex items-center gap-0.5 px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      onclick={() => {
                        showReactionDropdown = showReactionDropdown === reaction ? null : reaction;
                      }}
                    >
                      <span class="text-base">{reaction}</span>
                      <span class="text-xs text-gray-600 dark:text-gray-300">{count}</span>
                    </button>
                    <!-- Click popover with users who reacted (flows downward) -->
                    {#if showReactionDropdown === reaction}
                      <div class="absolute top-full left-0 mt-2 z-50">
                        <div
                          class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-48 max-w-64"
                        >
                          <div
                            class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 pb-1 border-b border-gray-200 dark:border-gray-700"
                          >
                            {reaction}
                            {count}
                          </div>
                          <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
                            {#each users as userInfo}
                              <a
                                href={Route.viewPartner({ id: userInfo.id })}
                                class="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <span class="text-sm text-immich-fg dark:text-immich-dark-fg truncate"
                                  >{userInfo.name}</span
                                >
                              </a>
                            {/each}
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/each}
              {:else}
                <span class="text-sm text-gray-500 dark:text-gray-400">{$t('no_reactions_yet')}</span>
              {/if}
            </div>

            <!-- React button (right side) -->
            {#if !disabled}
              <div
                class="relative flex items-center gap-2"
                use:clickOutside={{ onOutclick: () => (showAssetReactionPicker = false) }}
              >
                <!-- Remove reaction button (if user has reacted) -->
                {#if activityManager.userReaction}
                  <button
                    type="button"
                    class="flex items-center gap-1 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    onclick={async () => {
                      await activityManager.setReaction(null);
                    }}
                    title={$t('remove_your_reaction')}
                  >
                    <Icon icon={mdiClose} size="14" />
                  </button>
                {/if}
                <button
                  type="button"
                  class="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  onclick={(e) => {
                    const button = e.currentTarget;
                    if (showAssetReactionPicker) {
                      showAssetReactionPicker = false;
                    } else {
                      const rect = button.getBoundingClientRect();
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const pickerHeight = 320;
                      assetReactionPickerPosition = spaceBelow < pickerHeight ? 'above' : 'below';
                      showAssetReactionPicker = true;
                    }
                  }}
                >
                  {#if activityManager.userReaction}
                    <span class="text-lg">{activityManager.userReaction.reaction}</span>
                  {:else}
                    <Icon icon={mdiEmoticonOutline} size="18" />
                  {/if}
                  <span>{$t('react')}</span>
                </button>
                {#if showAssetReactionPicker}
                  <div
                    class="absolute {assetReactionPickerPosition === 'above'
                      ? 'bottom-full mb-2'
                      : 'top-full mt-2'} right-0 z-50"
                  >
                    <EmojiPicker
                      position={assetReactionPickerPosition}
                      onSelect={async (emoji) => {
                        showAssetReactionPicker = false;
                        await activityManager.setReaction(emoji);
                      }}
                      onClose={() => (showAssetReactionPicker = false)}
                    />
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Comments section header -->
        {#if activityManager.totalCommentCount > 0}
          <div class="py-2 px-2">
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {$t('comments')} ({activityManager.totalCommentCount})
            </span>
          </div>
        {/if}

        {#each activityManager.activities as reaction, index (reaction.id)}
          {#if reaction.type === ReactionType.Comment}
            <!-- Comment (both top-level and replies shown inline with reference) -->
            <div
              id="comment-{reaction.id}"
              class="flex flex-col dark:bg-gray-800 bg-gray-200 py-3 ps-3 mt-3 rounded-lg transition-all duration-300"
            >
              <!-- Reply reference (if this is a reply) -->
              {#if reaction.parentId}
                {@const parentComment = activityManager.getCommentById(reaction.parentId)}
                {#if parentComment}
                  <button
                    type="button"
                    class="flex items-center gap-2 mb-2 p-2 bg-gray-300 dark:bg-gray-700 rounded-lg text-xs text-left hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                    onclick={() => scrollToComment(reaction.parentId!)}
                  >
                    <Icon icon={mdiReply} size="14" class="text-gray-500 rotate-180" />
                    <span class="text-gray-500 dark:text-gray-400">{parentComment.user.name}:</span>
                    <span class="text-gray-600 dark:text-gray-300 truncate max-w-48">{parentComment.comment}</span>
                  </button>
                {/if}
              {/if}

              <div class="flex gap-3 justify-start">
                <a href={Route.viewPartner({ id: reaction.user.id })} class="flex-shrink-0">
                  <UserAvatar user={reaction.user} size="sm" />
                </a>

                <div class="flex-1 min-w-0">
                  <!-- User name and time -->
                  <div class="flex items-center gap-2 mb-1">
                    <a
                      href={Route.viewPartner({ id: reaction.user.id })}
                      class="font-medium text-sm text-immich-fg dark:text-immich-dark-fg hover:underline"
                      >{reaction.user.name}</a
                    >
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {timeSince(luxon.DateTime.fromISO(reaction.createdAt, { locale: $locale }))}
                    </span>
                    {#if reaction.editedAt}
                      <span class="text-xs text-gray-500 dark:text-gray-400 italic">({$t('edited')})</span>
                    {/if}
                  </div>

                  <!-- Comment content or edit form -->
                  {#if editingCommentId === reaction.id}
                    <div class="flex gap-2 items-center">
                      <Textarea
                        bind:value={editingMessage}
                        rows={1}
                        grow
                        class="flex-1 bg-white dark:bg-gray-700 rounded px-2 py-1"
                      />
                      <IconButton
                        shape="round"
                        variant="ghost"
                        icon={mdiSend}
                        onclick={() => handleEditComment(reaction.id)}
                        aria-label={$t('save')}
                      />
                      <IconButton
                        shape="round"
                        variant="ghost"
                        icon={mdiClose}
                        onclick={cancelEditing}
                        aria-label={$t('cancel')}
                      />
                    </div>
                  {:else}
                    <div class="leading-5 wrap-break-word text-sm">{reaction.comment}</div>
                  {/if}

                  <!-- Comment reactions display with click-based dropdown -->
                  {#if activityManager.getCommentReactionDetails(reaction.id).length > 0}
                    <div class="flex gap-1 mt-2 flex-wrap">
                      {#each activityManager.getCommentReactionDetails(reaction.id) as { reaction: emoji, count, users }}
                        <div
                          class="relative"
                          use:clickOutside={{ onOutclick: () => (showCommentReactionDropdown = null) }}
                        >
                          <button
                            type="button"
                            class="text-xs bg-gray-300 dark:bg-gray-700 rounded-full px-2 py-0.5 hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                            onclick={() => {
                              const key = `${reaction.id}-${emoji}`;
                              showCommentReactionDropdown = showCommentReactionDropdown === key ? null : key;
                            }}
                          >
                            {emoji}
                            {count}
                          </button>
                          {#if showCommentReactionDropdown === `${reaction.id}-${emoji}`}
                            <div class="absolute top-full left-0 mt-1 z-50">
                              <div
                                class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-32"
                              >
                                <div class="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                  {#each users as userInfo}
                                    <a
                                      href={Route.viewPartner({ id: userInfo.id })}
                                      class="text-xs text-immich-fg dark:text-immich-dark-fg hover:underline truncate"
                                    >
                                      {userInfo.name}
                                    </a>
                                  {/each}
                                </div>
                              </div>
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}

                  <!-- Action buttons for comment -->
                  <div class="flex items-center gap-2 mt-2">
                    <!-- React button -->
                    <div class="relative" use:clickOutside={{ onOutclick: () => (showEmojiPickerForComment = null) }}>
                      <button
                        type="button"
                        class="text-xs text-gray-500 dark:text-gray-400 hover:text-primary flex items-center gap-1"
                        onclick={() => {
                          showEmojiPickerForComment = showEmojiPickerForComment === reaction.id ? null : reaction.id;
                        }}
                      >
                        <Icon icon={mdiEmoticonOutline} size="14" />
                        <span>{$t('react')}</span>
                      </button>
                      {#if showEmojiPickerForComment === reaction.id}
                        <div class="absolute top-full mt-2 left-0 z-50">
                          <EmojiPicker
                            position="below"
                            onSelect={(emoji) => handleCommentReaction(reaction.id, emoji)}
                            onClose={() => (showEmojiPickerForComment = null)}
                          />
                        </div>
                      {/if}
                    </div>

                    <!-- Reply button -->
                    <button
                      type="button"
                      class="text-xs text-gray-500 dark:text-gray-400 hover:text-primary flex items-center gap-1"
                      onclick={() => startReply(reaction)}
                    >
                      <Icon icon={mdiReply} size="14" />
                      <span>{$t('reply')}</span>
                    </button>
                  </div>
                </div>

                {#if assetId === undefined && reaction.assetId && albumId}
                  <a
                    class="aspect-square w-19 h-19 flex-shrink-0"
                    href={Route.viewAlbumAsset({ albumId, assetId: reaction.assetId })}
                  >
                    <img
                      class="rounded-lg w-19 h-19 object-cover"
                      src={getAssetThumbnailUrl(reaction.assetId)}
                      alt="Asset that {reaction.user.name} commented on"
                    />
                  </a>
                {/if}

                {#if reaction.user.id === user.id || albumOwnerId === user.id}
                  <div class="me-2 flex-shrink-0">
                    <ButtonContextMenu
                      icon={mdiDotsVertical}
                      title={$t('comment_options')}
                      align="top-right"
                      direction="left"
                      size="small"
                    >
                      {#if reaction.user.id === user.id}
                        <MenuOption
                          icon={mdiPencilOutline}
                          text={$t('edit')}
                          onClick={() => startEditingComment(reaction)}
                        />
                      {/if}
                      <MenuOption
                        activeColor="bg-red-200"
                        icon={mdiDeleteOutline}
                        text={$t('remove')}
                        onClick={() => handleDeleteReaction(reaction, index)}
                      />
                    </ButtonContextMenu>
                  </div>
                {/if}
              </div>
            </div>

            {#if (index != activityManager.activities.length - 1 && !shouldGroup(activityManager.activities[index].createdAt, activityManager.activities[index + 1].createdAt)) || index === activityManager.activities.length - 1}
              <div
                class="pt-1 px-2 text-right w-full text-sm text-gray-500 dark:text-gray-300"
                title={new Date(reaction.createdAt).toLocaleDateString(undefined, timeOptions)}
              >
                {timeSince(luxon.DateTime.fromISO(reaction.createdAt, { locale: $locale }))}
              </div>
            {/if}
          {:else if reaction.type === ReactionType.Like}
            <div class="relative">
              <div class="flex py-3 ps-3 mt-3 gap-4 items-center text-sm">
                <div class="text-primary"><Icon icon={mdiThumbUp} size="20" /></div>

                <div class="w-full" title={`${reaction.user.name} (${reaction.user.email})`}>
                  {$t('user_liked', {
                    values: {
                      user: reaction.user.name,
                      type: assetType ? getAssetType(assetType).toLowerCase() : null,
                    },
                  })}
                </div>
                {#if assetId === undefined && reaction.assetId && albumId}
                  <a
                    class="aspect-square w-19 h-19"
                    href={Route.viewAlbumAsset({ albumId, assetId: reaction.assetId })}
                  >
                    <img
                      class="rounded-lg w-19 h-19 object-cover"
                      src={getAssetThumbnailUrl(reaction.assetId)}
                      alt="Profile picture of {reaction.user.name}, who liked this asset"
                    />
                  </a>
                {/if}
                {#if reaction.user.id === user.id || albumOwnerId === user.id}
                  <div class="me-4">
                    <ButtonContextMenu
                      icon={mdiDotsVertical}
                      title={$t('reaction_options')}
                      align="top-right"
                      direction="left"
                      size="small"
                    >
                      <MenuOption
                        activeColor="bg-red-200"
                        icon={mdiDeleteOutline}
                        text={$t('remove')}
                        onClick={() => handleDeleteReaction(reaction, index)}
                      />
                    </ButtonContextMenu>
                  </div>
                {/if}
              </div>
              {#if (index != activityManager.activities.length - 1 && isTenMinutesApart(activityManager.activities[index].createdAt, activityManager.activities[index + 1].createdAt)) || index === activityManager.activities.length - 1}
                <div
                  class="pt-1 px-2 text-right w-full text-sm text-gray-500 dark:text-gray-300"
                  title={new Date(reaction.createdAt).toLocaleDateString(navigator.language, timeOptions)}
                >
                  {timeSince(luxon.DateTime.fromISO(reaction.createdAt, { locale: $locale }))}
                </div>
              {/if}
            </div>
          {/if}
          <!-- Note: Asset-level reactions are now shown in the reaction summary bar at the top -->
        {/each}
      </div>
    {/if}
  </div>

  <div class="absolute w-full bottom-0">
    <div class="flex flex-col items-center justify-center p-2" bind:clientHeight={chatHeight}>
      <!-- Reply reference bar (WhatsApp/Telegram style) -->
      {#if replyingToComment}
        <div
          class="flex items-center justify-between w-full px-3 py-2 mb-1 bg-gray-300 dark:bg-gray-700 rounded-t-2xl border-l-4 border-primary"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <Icon icon={mdiReply} size="16" class="text-primary rotate-180 flex-shrink-0" />
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-medium text-primary">{replyingToComment.user.name}</span>
              <span class="text-xs text-gray-600 dark:text-gray-300 truncate">{replyingToComment.comment}</span>
            </div>
          </div>
          <button
            type="button"
            class="p-1 hover:bg-gray-400 dark:hover:bg-gray-600 rounded-full transition-colors flex-shrink-0"
            onclick={cancelReply}
            aria-label={$t('cancel')}
          >
            <Icon icon={mdiClose} size="16" />
          </button>
        </div>
      {/if}

      <div
        class="flex p-2 gap-4 h-fit bg-gray-200 text-immich-dark-gray w-full {replyingToComment
          ? 'rounded-b-3xl'
          : 'rounded-3xl'}"
      >
        <div>
          <UserAvatar {user} size="md" noTitle />
        </div>
        <form class="flex w-full items-center max-h-56 gap-1" {onsubmit}>
          <Textarea
            {disabled}
            bind:value={message}
            rows={1}
            grow
            placeholder={disabled
              ? $t('comments_are_disabled')
              : replyingToComment
                ? $t('write_a_reply')
                : $t('say_something')}
            {@attach fromAction(shortcut, () => ({
              shortcut: { key: 'Enter' },
              onShortcut: () => handleSendComment(),
            }))}
            class="{disabled
              ? 'cursor-not-allowed'
              : ''} ring-0! w-full max-h-56 pe-2 items-center overflow-y-auto leading-4 outline-none resize-none bg-gray-200 dark:bg-gray-200"
          />
          {#if isSendingMessage}
            <div class="flex place-items-center pb-2 ms-0">
              <div class="flex w-full place-items-center">
                <LoadingSpinner size="large" />
              </div>
            </div>
          {:else if message}
            <div class="flex items-center w-fit ms-0 light">
              <IconButton
                shape="round"
                aria-label={$t('send_message')}
                variant="ghost"
                icon={mdiSend}
                onclick={() => handleSendComment()}
              />
            </div>
          {/if}
        </form>
      </div>
    </div>
  </div>
</div>

<style>
  ::placeholder {
    color: rgb(60, 60, 60);
    opacity: 0.6;
  }

  ::-ms-input-placeholder {
    /* Edge 12 -18 */
    color: white;
  }

  /* Highlight glow animation for referenced comments */
  :global(.highlight-glow) {
    animation: glow 2s ease-out;
  }

  @keyframes glow {
    0% {
      box-shadow: 0 0 20px 5px rgba(59, 130, 246, 0.6);
      background-color: rgba(59, 130, 246, 0.2);
    }
    100% {
      box-shadow: none;
      background-color: inherit;
    }
  }
</style>
