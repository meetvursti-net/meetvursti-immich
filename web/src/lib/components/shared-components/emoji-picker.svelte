<script lang="ts">
  import { IconButton } from '@immich/ui';
  import { mdiClose } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { fly } from 'svelte/transition';

  export type EmojiPickerPosition = 'auto' | 'above' | 'below';

  // Common emoji categories
  const EMOJI_CATEGORIES = {
    recent: [] as string[],
    smileys: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😗',
      '😚',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '🤐',
      '🤨',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '🤥',
      '😌',
      '😔',
      '😪',
      '🤤',
      '😴',
      '😷',
      '🤒',
      '🤕',
      '🤢',
      '🤮',
      '🤧',
      '🥵',
      '🥶',
      '🥴',
      '😵',
      '🤯',
      '🤠',
      '🥳',
      '🥸',
      '😎',
      '🤓',
      '🧐',
    ],
    gestures: [
      '👍',
      '👎',
      '👌',
      '🤌',
      '🤏',
      '✌️',
      '🤞',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '🖕',
      '👇',
      '☝️',
      '👋',
      '🤚',
      '🖐️',
      '✋',
      '🖖',
      '👏',
      '🙌',
      '🤲',
      '🤝',
      '🙏',
      '✍️',
      '💪',
      '🦾',
      '🦿',
    ],
    hearts: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '♥️',
    ],
    objects: [
      '⭐',
      '🌟',
      '✨',
      '💫',
      '🔥',
      '💥',
      '💢',
      '💦',
      '💨',
      '🎉',
      '🎊',
      '🎈',
      '🎁',
      '🏆',
      '🥇',
      '🥈',
      '🥉',
      '🏅',
      '🎯',
      '🎪',
    ],
    nature: [
      '🌸',
      '💐',
      '🌷',
      '🌹',
      '🥀',
      '🌺',
      '🌻',
      '🌼',
      '🌱',
      '🌲',
      '🌳',
      '🌴',
      '🌵',
      '🌾',
      '🌿',
      '☘️',
      '🍀',
      '🍁',
      '🍂',
      '🍃',
    ],
  };

  const RECENT_STORAGE_KEY = 'immich-recent-emojis';
  const MAX_RECENT = 12;
  const PICKER_HEIGHT = 320; // max-h-80 = 320px
  const HEADER_HEIGHT = 64; // Approximate height of the app header

  interface Props {
    onSelect: (emoji: string) => void;
    onClose: () => void;
    position?: EmojiPickerPosition;
  }

  let { onSelect, onClose, position = 'auto' }: Props = $props();

  let recentEmojis = $state<string[]>([]);
  let selectedCategory = $state<keyof typeof EMOJI_CATEGORIES>('smileys');
  let pickerElement = $state<HTMLDivElement | null>(null);
  let computedPosition = $state<'above' | 'below'>('above');

  // Calculate best position based on available space
  $effect(() => {
    if (position !== 'auto') {
      computedPosition = position;
      return;
    }

    if (pickerElement) {
      const rect = pickerElement.getBoundingClientRect();
      const spaceAbove = rect.top - HEADER_HEIGHT;
      const spaceBelow = window.innerHeight - rect.bottom;

      // Prefer above, but use below if not enough space above
      if (spaceAbove < PICKER_HEIGHT && spaceBelow > spaceAbove) {
        computedPosition = 'below';
      } else {
        computedPosition = 'above';
      }
    }
  });

  // Load recent emojis from localStorage
  $effect(() => {
    try {
      const stored = localStorage.getItem(RECENT_STORAGE_KEY);
      if (stored) {
        recentEmojis = JSON.parse(stored);
      }
    } catch {
      recentEmojis = [];
    }
  });

  const saveRecentEmoji = (emoji: string) => {
    // Remove if already exists, then add to front
    const filtered = recentEmojis.filter((e) => e !== emoji);
    const updated = [emoji, ...filtered].slice(0, MAX_RECENT);
    recentEmojis = updated;
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const handleEmojiClick = (emoji: string) => {
    saveRecentEmoji(emoji);
    onSelect(emoji);
  };

  const categoryLabels: Record<keyof typeof EMOJI_CATEGORIES, string> = {
    recent: 'Recent',
    smileys: 'Smileys',
    gestures: 'Gestures',
    hearts: 'Hearts',
    objects: 'Objects',
    nature: 'Nature',
  };

  const currentEmojis = $derived(selectedCategory === 'recent' ? recentEmojis : EMOJI_CATEGORIES[selectedCategory]);
</script>

<div
  bind:this={pickerElement}
  class="bg-immich-bg dark:bg-immich-dark-gray rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-72 max-h-80 overflow-hidden"
  transition:fly={{ y: computedPosition === 'above' ? 10 : -10, duration: 200 }}
>
  <!-- Header -->
  <div class="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
    <span class="text-sm font-medium text-immich-fg dark:text-immich-dark-fg">
      {$t('select_reaction')}
    </span>
    <IconButton
      shape="round"
      variant="ghost"
      color="secondary"
      size="small"
      icon={mdiClose}
      onclick={onClose}
      aria-label={$t('close')}
    />
  </div>

  <!-- Category tabs -->
  <div class="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
    {#each Object.keys(EMOJI_CATEGORIES) as category}
      {@const cat = category as keyof typeof EMOJI_CATEGORIES}
      {#if cat !== 'recent' || recentEmojis.length > 0}
        <button
          type="button"
          class="px-2 py-1 text-xs rounded-md whitespace-nowrap transition-colors
            {selectedCategory === cat
            ? 'bg-primary text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-immich-fg dark:text-immich-dark-fg hover:bg-gray-200 dark:hover:bg-gray-600'}"
          onclick={() => (selectedCategory = cat)}
        >
          {categoryLabels[cat]}
        </button>
      {/if}
    {/each}
  </div>

  <!-- Emoji grid -->
  <div class="p-2 overflow-y-auto max-h-48">
    {#if currentEmojis.length === 0}
      <div class="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
        {$t('no_recent_reactions')}
      </div>
    {:else}
      <div class="grid grid-cols-8 gap-1">
        {#each currentEmojis as emoji}
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onclick={() => handleEmojiClick(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
