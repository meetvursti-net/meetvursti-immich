<script lang="ts">
  import { goto } from '$app/navigation';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/button-context-menu.svelte';
  import ControlAppBar from '$lib/components/shared-components/control-app-bar.svelte';
  import AddToAlbum from '$lib/components/timeline/actions/AddToAlbumAction.svelte';
  import CreateSharedLink from '$lib/components/timeline/actions/CreateSharedLinkAction.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import SortDropdown from '$lib/components/timeline/sort-dropdown.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import { Route } from '$lib/route';
  import { AssetInteraction } from '$lib/stores/asset-interaction.svelte';
  import { timelineSortBy } from '$lib/stores/preferences.store';
  import { AssetSortBy, AssetVisibility } from '@immich/sdk';
  import { mdiArrowLeft, mdiPlus } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let sortBy = $derived($timelineSortBy === 'dateUploaded' ? AssetSortBy.DateUploaded : AssetSortBy.DateTaken);

  const options = $derived({
    userId: data.partner.id,
    visibility: AssetVisibility.Timeline,
    withStacked: true,
    sortBy,
  });

  const assetInteraction = new AssetInteraction();

  const handleEscape = () => {
    if (assetInteraction.selectionActive) {
      assetInteraction.clearMultiselect();
      return;
    }
  };

  const handleSortChange = (newSortBy: AssetSortBy) => {
    $timelineSortBy = newSortBy;
  };
</script>

<main class="relative h-dvh overflow-hidden px-2 md:px-6 max-md:pt-(--navbar-height-md) pt-(--navbar-height)">
  <div class="flex justify-start px-2 pt-2">
    <SortDropdown {sortBy} onSelect={handleSortChange} />
  </div>
  <Timeline enableRouting={true} {options} {assetInteraction} onEscape={handleEscape} />
</main>

{#if assetInteraction.selectionActive}
  <AssetSelectControlBar
    assets={assetInteraction.selectedAssets}
    clearSelect={() => assetInteraction.clearMultiselect()}
  >
    <CreateSharedLink />
    <ButtonContextMenu icon={mdiPlus} title={$t('add_to')}>
      <AddToAlbum />
      <AddToAlbum shared />
    </ButtonContextMenu>
    <DownloadAction />
  </AssetSelectControlBar>
{:else}
  <ControlAppBar showBackButton backIcon={mdiArrowLeft} onClose={() => goto(Route.sharing())}>
    {#snippet leading()}
      <p class="whitespace-nowrap text-immich-fg dark:text-immich-dark-fg">
        {data.partner.name}'s photos
      </p>
    {/snippet}
  </ControlAppBar>
{/if}
