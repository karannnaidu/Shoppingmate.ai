import { SERVICE_SEGMENTS, detectSegment } from '@shoppingmate/shared/segments';

type BrandFields = {
  name?: string | null;
  domain?: string | null;
  brandSummary?: string | null;
  brandCategories?: string[] | null;
  businessType?: string | null;
};

/** Clinics, restaurants, salons and service firms take bookings and enquiries,
 *  not orders — the dashboard speaks their language (same detection as the
 *  assistant, incl. the owner's choice in Settings). */
export function isServiceBusiness(m: BrandFields | null | undefined): boolean {
  if (!m) return false;
  return SERVICE_SEGMENTS.has(detectSegment(m));
}
