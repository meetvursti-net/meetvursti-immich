<script lang="ts">
  import UserPageLayout from '$lib/components/layouts/user-page-layout.svelte';
  import ButtonContextMenu from '$lib/components/shared-components/context-menu/button-context-menu.svelte';
  import EmptyPlaceholder from '$lib/components/shared-components/empty-placeholder.svelte';
  import AddToAlbum from '$lib/components/timeline/actions/AddToAlbumAction.svelte';
  import ArchiveAction from '$lib/components/timeline/actions/ArchiveAction.svelte';
  import AssetJobActions from '$lib/components/timeline/actions/AssetJobActions.svelte';
  import ChangeDate from '$lib/components/timeline/actions/ChangeDateAction.svelte';
  import ChangeDescription from '$lib/components/timeline/actions/ChangeDescriptionAction.svelte';
  import ChangeLocation from '$lib/components/timeline/actions/ChangeLocationAction.svelte';
  import CreateSharedLink from '$lib/components/timeline/actions/CreateSharedLinkAction.svelte';
  import DeleteAssets from '$lib/components/timeline/actions/DeleteAssetsAction.svelte';
  import DownloadAction from '$lib/components/timeline/actions/DownloadAction.svelte';
  import FavoriteAction from '$lib/components/timeline/actions/FavoriteAction.svelte';
  import LinkLivePhotoAction from '$lib/components/timeline/actions/LinkLivePhotoAction.svelte';
  import SelectAllAssets from '$lib/components/timeline/actions/SelectAllAction.svelte';
  import SetVisibilityAction from '$lib/components/timeline/actions/SetVisibilityAction.svelte';
  import StackAction from '$lib/components/timeline/actions/StackAction.svelte';
  import TagAction from '$lib/components/timeline/actions/TagAction.svelte';
  import AssetSelectControlBar from '$lib/components/timeline/AssetSelectControlBar.svelte';
  import SortDropdown from '$lib/components/timeline/sort-dropdown.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import { AssetAction } from '$lib/constants';
  import { TimelineManager } from '$lib/managers/timeline-manager/timeline-manager.svelte';
  import { AssetInteraction } from '$lib/stores/asset-interaction.svelte';
  import { assetViewingStore } from '$lib/stores/asset-viewing.store';
  import { timelineSortBy } from '$lib/stores/preferences.store';
  import { user } from '$lib/stores/user.store';
  import {
    updateStackedAssetInTimeline,
    updateUnstackedAssetInTimeline,
    type OnLink,
    type OnUnlink,
  } from '$lib/utils/actions';
  import { openFileUploadDialog } from '$lib/utils/file-uploader';
  import { AssetSortBy, AssetVisibility } from '@immich/sdk';
  import { mdiDotsVertical, mdiPlus } from '@mdi/js';
  import { t } from 'svelte-i18n';

  let { isViewing: showAssetViewer } = assetViewingStore;
  let timelineManager = $state<TimelineManager>() as TimelineManager;
  let sortBy = $derived($timelineSortBy === 'dateUploaded' ? AssetSortBy.DateUploaded : AssetSortBy.DateTaken);

  // Only show the current user's photos (no partners)
  const options = $derived({
    userId: $user?.id,
    visibility: AssetVisibility.Timeline,
    withStacked: true,
    withPartners: false,
    sortBy,
  });

  const assetInteraction = new AssetInteraction();

  let selectedAssets = $derived(assetInteraction.selectedAssets);
  let isAssetStackSelected = $derived(selectedAssets.length === 1 && !!selectedAssets[0].stack);
  let isLinkActionAvailable = $derived.by(() => {
    const isLivePhoto = selectedAssets.length === 1 && !!selectedAssets[0].livePhotoVideoId;
    const isLivePhotoCandidate =
      selectedAssets.length === 2 &&
      selectedAssets.some((asset) => asset.isImage) &&
      selectedAssets.some((asset) => asset.isVideo);

    return assetInteraction.isAllUserOwned && (isLivePhoto || isLivePhotoCandidate);
  });

  const handleEscape = () => {
    if ($showAssetViewer) {
      return;
    }
    if (assetInteraction.selectionActive) {
      assetInteraction.clearMultiselect();
      return;
    }
  };

  const handleLink: OnLink = ({ still, motion }) => {
    timelineManager.removeAssets([motion.id]);
    timelineManager.upsertAssets([still]);
  };

  const handleUnlink: OnUnlink = ({ still, motion }) => {
    timelineManager.upsertAssets([motion]);
    timelineManager.upsertAssets([still]);
  };

  const handleSetVisibility = (assetIds: string[]) => {
    timelineManager.removeAssets(assetIds);
    assetInteraction.clearMultiselect();
  };

  const handleSortChange = (newSortBy: AssetSortBy) => {
    $timelineSortBy = newSortBy;
  };
</script>

<UserPageLayout hideNavbar={assetInteraction.selectionActive} scrollbar={false} title={$t('my_photos')}>
  {#snippet buttons()}
    <div class="flex place-items-center gap-2">
      <SortDropdown {sortBy} onSelect={handleSortChange} />
    </div>
  {/snippet}
  <Timeline
    enableRouting={true}
    bind:timelineManager
    {options}
    {assetInteraction}
    removeAction={AssetAction.ARCHIVE}
    onEscape={handleEscape}
    withStacked
  >
    {#snippet empty()}
      <EmptyPlaceholder text={$t('no_assets_message')} onClick={() => openFileUploadDialog()} class="mt-10 mx-auto" />
    {/snippet}
  </Timeline>
</UserPageLayout>

{#if assetInteraction.selectionActive}
  <AssetSelectControlBar
    ownerId={$user.id}
    assets={assetInteraction.selectedAssets}
    clearSelect={() => assetInteraction.clearMultiselect()}
  >
    <CreateSharedLink />
    <SelectAllAssets {timelineManager} {assetInteraction} />
    <ButtonContextMenu icon={mdiPlus} title={$t('add_to')}>
      <AddToAlbum />
      <AddToAlbum shared />
    </ButtonContextMenu>

    <FavoriteAction
      removeFavorite={assetInteraction.isAllFavorite}
      onFavorite={(ids, isFavorite) => timelineManager.update(ids, (asset) => (asset.isFavorite = isFavorite))}
    />

    <ButtonContextMenu icon={mdiDotsVertical} title={$t('menu')}>
      <DownloadAction menuItem />
      {#if assetInteraction.selectedAssets.length > 1 || isAssetStackSelected}
        <StackAction
          unstack={isAssetStackSelected}
          onStack={(result) => updateStackedAssetInTimeline(timelineManager, result)}
          onUnstack={(assets) => updateUnstackedAssetInTimeline(timelineManager, assets)}
        />
      {/if}
      {#if isLinkActionAvailable}
        <LinkLivePhotoAction onLink={handleLink} onUnlink={handleUnlink} menuItem />
      {/if}
      <ChangeDate menuItem />
      <ChangeDescription menuItem />
      <ChangeLocation menuItem />
      <ArchiveAction menuItem onArchive={(assetIds) => timelineManager.removeAssets(assetIds)} />
      <SetVisibilityAction menuItem onVisibilitySet={handleSetVisibility} />
      <TagAction menuItem />
      <AssetJobActions />
      <hr />
      <DeleteAssets menuItem onAssetDelete={(assetIds) => timelineManager.removeAssets(assetIds)} />
    </ButtonContextMenu>
  </AssetSelectControlBar>
{/if}
