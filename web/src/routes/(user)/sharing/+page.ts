import { authenticate } from '$lib/utils/auth';
import { getFormatter } from '$lib/utils/i18n';
import { PartnerDirection, getPartners } from '@immich/sdk';
import type { PageLoad } from './$types';

export const load = (async ({ url }) => {
  await authenticate(url);
  const partners = await getPartners({ direction: PartnerDirection.SharedWith });
  const $t = await getFormatter();

  return {
    partners,
    meta: {
      title: $t('users'),
    },
  };
}) satisfies PageLoad;
