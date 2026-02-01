<script lang="ts">
  import UserPageLayout from '$lib/components/layouts/user-page-layout.svelte';
  import UserAvatar from '$lib/components/shared-components/user-avatar.svelte';
  import { Route } from '$lib/route';
  import { Input } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  let { data }: Props = $props();

  let searchQuery = $state('');

  let filteredPartners = $derived(
    searchQuery.trim() === ''
      ? data.partners
      : data.partners.filter((partner) => partner.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );
</script>

<UserPageLayout title={data.meta.title}>
  <div class="mb-4">
    <Input type="text" placeholder={$t('search')} bind:value={searchQuery} class="max-w-xs" />
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    {#each filteredPartners as partner (partner.id)}
      <a
        href={Route.viewPartner(partner)}
        class="flex flex-col items-center gap-3 rounded-xl p-6 transition-all hover:bg-gray-200 dark:hover:bg-gray-700 bg-slate-50 dark:bg-gray-900"
      >
        <UserAvatar user={partner} size="xl" />
        <p class="text-immich-fg dark:text-immich-dark-fg font-medium text-center">
          {partner.name}
        </p>
      </a>
    {/each}
  </div>
</UserPageLayout>
