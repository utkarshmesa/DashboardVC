-- 005: split the persona into target_space (drives relevance) and my_product (drives possible_competitor only),
-- and store the classifier's fixed relevance level next to the mapped number (SPEC §2, §9.4).
alter table signals add column if not exists relevance_level text
  check (relevance_level in ('core', 'logistics_non_software', 'adjacent', 'unrelated'));

-- The existing company_profile (the TMS persona) becomes my_product.
insert into settings (key, value)
select 'my_product', value from settings where key = 'company_profile'
on conflict (key) do nothing;

insert into settings (key, value) values ('target_space',
  'B2B software for logistics and supply chain: transport and freight management, freight procurement, warehouse management, fleet and telematics, supply-chain visibility, last-mile and delivery software, cross-border and customs, procurement, logistics analytics and AI, and logistics fintech.')
on conflict (key) do nothing;

delete from settings where key = 'company_profile';
