<script lang="ts">
  import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';
  import { locale } from '$lib/stores/preferences.store';
  import { Icon } from '@immich/ui';
  import { mdiCommentOutline, mdiEmoticonHappyOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    numberOfComments: number | undefined;
    numberOfReactions: number | undefined;
    disabled: boolean;
  }

  let { numberOfComments, numberOfReactions, disabled }: Props = $props();
</script>

<!-- Single clickable area that opens the activity panel -->
<button
  type="button"
  class="w-full flex p-4 items-center justify-center rounded-full gap-5 bg-subtle border bg-opacity-60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
  onclick={() => assetViewerManager.toggleActivityPanel()}
  aria-label={$t('open_activity_panel')}
>
  <!-- Reactions indicator -->
  <div class="flex gap-2 items-center justify-center">
    <Icon icon={mdiEmoticonHappyOutline} size="24" class="text-fg" />
    {#if numberOfReactions}
      <div class="text-l">{numberOfReactions.toLocaleString($locale)}</div>
    {/if}
  </div>

  <!-- Comments indicator -->
  <div class="flex gap-2 items-center justify-center">
    <Icon icon={mdiCommentOutline} class="scale-x-[-1]" size="24" />
    {#if numberOfComments}
      <div class="text-l">{numberOfComments.toLocaleString($locale)}</div>
    {/if}
  </div>
</button>
