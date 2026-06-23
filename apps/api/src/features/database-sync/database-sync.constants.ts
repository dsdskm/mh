export const DATABASE_SYNC_TABLES = [
  'accounts',
  'products',
  'app_settings',
  'notices',
  'inquiries',
  'reviews',
  'coupon_templates',
  'orders',
  'account_shipping_addresses',
  'inquiry_comments',
  'review_comments',
  'order_items',
  'coupons',
  'mileage_transactions',
  'notifications',
  'admin_sms_histories',
  'app_setting_terms_history',
] as const;

export type DatabaseSyncTable = (typeof DATABASE_SYNC_TABLES)[number];
