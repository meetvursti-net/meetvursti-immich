<script lang="ts">
  import Dropdown from '$lib/elements/Dropdown.svelte';
  import { AssetSortBy } from '@immich/sdk';
  import { mdiCloudUploadOutline, mdiSortCalendarDescending } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    sortBy?: AssetSortBy;
    onSelect: (sortBy: AssetSortBy) => void;
  }

  let { sortBy = AssetSortBy.DateTaken, onSelect }: Props = $props();

  const sortOptions = [AssetSortBy.DateTaken, AssetSortBy.DateUploaded];

  const renderSortOption = (option: AssetSortBy) => {
    switch (option) {
      case AssetSortBy.DateTaken: {
        return {
          title: $t('date_taken'),
          icon: mdiSortCalendarDescending,
        };
      }
      case AssetSortBy.DateUploaded: {
        return {
          title: $t('date_uploaded'),
          icon: mdiCloudUploadOutline,
        };
      }
      default: {
        return { title: option };
      }
    }
  };

  const handleSelect = (option: AssetSortBy) => {
    onSelect(option);
  };
</script>

<Dropdown
  options={sortOptions}
  selectedOption={sortBy}
  onSelect={handleSelect}
  render={renderSortOption}
  title={$t('sort_by')}
  hideTextOnSmallScreen={false}
  position="bottom-right"
/>
