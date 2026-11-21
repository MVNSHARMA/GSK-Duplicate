export const OFFICIAL_BUSINESS_NAME = 'GSK Automotive';
export const OFFICIAL_BUSINESS_ADDRESS = '22 Artisan Rd, Seven Hills NSW 2147, Australia';
export const OFFICIAL_BUSINESS_PHONE = '+61 2 8856 5650';
export const OFFICIAL_BUSINESS_PHONE_TEL = 'tel:+61288565650';

export const OFFICIAL_GOOGLE_MAPS_EMBED_URL =
  'https://maps.google.com/maps?width=100%25&height=600&hl=en&q=22%20Artisan%20Rd,%20Seven%20Hills%20NSW%202147,%20Australia&t=&z=15&ie=UTF8&iwloc=B&output=embed';

const LEGACY_PLACEHOLDER_ADDRESSES = new Set([
  '123 service road, sydney nsw 2000',
  '123 automotive way, sydney nsw 2000',
  '123 auto lane, car city',
  '6/22-24 artisan road, seven hills nsw 2147'
]);

const LEGACY_PLACEHOLDER_PHONES = new Set([
  '02 9999 8888',
  '02 9999 8887',
  '1300 gsk auto',
  '123-456-7890',
  '00 8856 6550',
  '02 8856 5650'
]);

export const resolveBusinessAddress = (settingsOrAddress) => {
  const raw = typeof settingsOrAddress === 'string'
    ? settingsOrAddress
    : settingsOrAddress?.businessAddress;
  const trimmed = String(raw || '').trim();
  if (!trimmed || LEGACY_PLACEHOLDER_ADDRESSES.has(trimmed.toLowerCase())) {
    return OFFICIAL_BUSINESS_ADDRESS;
  }
  return trimmed;
};

export const resolveBusinessPhone = (settingsOrPhone) => {
  const raw = typeof settingsOrPhone === 'string'
    ? settingsOrPhone
    : settingsOrPhone?.businessPhone;
  const trimmed = String(raw || '').trim();
  if (!trimmed || LEGACY_PLACEHOLDER_PHONES.has(trimmed.toLowerCase())) {
    return OFFICIAL_BUSINESS_PHONE;
  }
  return trimmed;
};
