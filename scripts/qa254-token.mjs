import { createClient } from '@supabase/supabase-js';
const s = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
for (const slug of ['qrflowcafe', 'cheeseburg']) {
  const { data, error } = await s.rpc('sp_public_offers', { p_slug: slug });
  console.log('offers@' + slug + ':', error ? 'ERR ' + error.message : JSON.stringify(data?.offers?.map(o => ({ t: o.title, dt: o.discount_type, dv: o.discount_value, min: o.min_order_amount }))));
}
