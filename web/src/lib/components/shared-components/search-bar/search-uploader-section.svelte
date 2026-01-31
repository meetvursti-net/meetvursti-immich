<script lang="ts">
  import Combobox, { type ComboBoxOption } from '$lib/components/shared-components/combobox.svelte';
  import { searchUsers, type UserResponseDto } from '@immich/sdk';
  import { Text } from '@immich/ui';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';

  interface Props {
    selectedUploaderId: string | undefined;
    onSearch?: () => void;
  }

  let { selectedUploaderId = $bindable(), onSearch }: Props = $props();

  let allUsers: UserResponseDto[] = $state([]);
  let userMap = $derived(Object.fromEntries(allUsers.map((u) => [u.id, u])));

  onMount(async () => {
    allUsers = await searchUsers();
  });

  const handleSelect = (option?: ComboBoxOption) => {
    selectedUploaderId = option?.value;
  };

  const asSelectedOption = (userId?: string): ComboBoxOption | undefined => {
    if (!userId) {
      return undefined;
    }
    const user = userMap[userId];
    if (!user) {
      return undefined;
    }
    return { id: user.id, label: user.name, value: user.id };
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && selectedUploaderId && onSearch) {
      event.preventDefault();
      onSearch();
    }
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div id="uploader-selection" onkeydown={handleKeydown}>
  <div class="mb-4 flex flex-col">
    <Text class="py-3" fontWeight="medium">{$t('uploader')}</Text>
    <Combobox
      hideLabel
      label={$t('uploader')}
      onSelect={handleSelect}
      options={allUsers.map((user) => ({ id: user.id, label: user.name, value: user.id }))}
      placeholder={$t('search_uploaders')}
      selectedOption={asSelectedOption(selectedUploaderId)}
    />
  </div>
</div>
