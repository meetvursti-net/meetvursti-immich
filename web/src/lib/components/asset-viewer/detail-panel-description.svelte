<script lang="ts">
  import { shortcut } from '$lib/actions/shortcut';
  import { handleError } from '$lib/utils/handle-error';
  import { updateAsset, type AssetResponseDto } from '@immich/sdk';
  import { IconButton, Textarea, toastManager } from '@immich/ui';
  import { mdiCheck, mdiClose, mdiPencil } from '@mdi/js';
  import { tick } from 'svelte';
  import { t } from 'svelte-i18n';
  import { fromAction } from 'svelte/attachments';

  interface Props {
    asset: AssetResponseDto;
    isOwner: boolean;
  }

  let { asset, isOwner }: Props = $props();

  let currentDescription = $derived(asset.exifInfo?.description ?? '');
  let editedDescription = $state('');
  let isEditing = $state(false);

  const saveChanges = async () => {
    isEditing = false;
    if (editedDescription === currentDescription) {
      return;
    }
    try {
      await updateAsset({ id: asset.id, updateAssetDto: { description: editedDescription } });
      toastManager.success($t('asset_description_updated'));
    } catch (error) {
      handleError(error, $t('cannot_update_the_description'));
    }
  };

  const cancelEditing = () => {
    isEditing = false;
    editedDescription = currentDescription;
  };

  const startEditing = async () => {
    editedDescription = currentDescription;
    isEditing = true;
    await tick();
    // Focus the textarea after it becomes visible
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="autogrow-textarea"]');
    textarea?.focus();
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelEditing();
    }
  };
</script>

{#if isOwner}
  <section class="px-4 mt-2">
    {#if isEditing}
      <div class="flex flex-col gap-2">
        <Textarea
          bind:value={editedDescription}
          class="max-h-40 pl-0 outline-none bg-transparent ring-0 focus:ring-0 resize-none dark:bg-transparent"
          rows={1}
          grow
          shape="rectangle"
          onfocusout={(e) => {
            // Only cancel if clicking outside the edit section (not on the buttons)
            const relatedTarget = e.relatedTarget as HTMLElement | null;
            if (!relatedTarget?.closest('[data-edit-actions]')) {
              cancelEditing();
            }
          }}
          onkeydown={handleKeydown}
          placeholder={$t('add_a_description')}
          data-testid="autogrow-textarea"
          {@attach fromAction(shortcut, () => ({
            shortcut: { key: 'Enter', ctrl: true },
            onShortcut: () => saveChanges(),
          }))}
        />
        <div class="flex gap-1" data-edit-actions>
          <IconButton
            icon={mdiCheck}
            aria-label={$t('confirm')}
            size="small"
            shape="round"
            color="primary"
            variant="ghost"
            onclick={saveChanges}
          />
          <IconButton
            icon={mdiClose}
            aria-label={$t('cancel')}
            size="small"
            shape="round"
            color="secondary"
            variant="ghost"
            onclick={cancelEditing}
          />
        </div>
      </div>
    {:else}
      <button
        type="button"
        class="inline wrap-break-word whitespace-pre-line text-black dark:text-white text-base text-left"
        onclick={startEditing}
      >
        {#if currentDescription}
          {currentDescription}
        {:else}
          <span class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
            >{$t('add_a_description')}</span
          >
        {/if}
        <IconButton
          icon={mdiPencil}
          aria-label={$t('edit_description')}
          size="small"
          shape="round"
          color="secondary"
          variant="ghost"
          onclick={startEditing}
          class="inline-flex align-middle ms-1"
        />
      </button>
    {/if}
  </section>
{:else if currentDescription}
  <section class="px-4 mt-2">
    <p class="wrap-break-word whitespace-pre-line w-full text-black dark:text-white text-base">{currentDescription}</p>
  </section>
{/if}
