import { describe, expect, it } from 'vitest';
import { detectSegment, segmentBlock } from './segments.js';

// Brand profiles exactly as onboarding wrote them for the [QA] audit stores
// (2026-10-07) + the existing tenants.
const cases: Array<[string, string[], string, ReturnType<typeof detectSegment>]> = [
  ['Allbirds', ["Men's Sneakers & Shoes", "Women's Sneakers & Shoes", 'Sandals & Slip-Ons', "Men's Apparel", "Women's Apparel", 'Socks'], 'Allbirds sells shoes and apparel for men and women made from natural and recycled materials', 'fashion'],
  ['ColourPop', ['Eyeshadow Palettes', 'Lip Products', 'Blush & Cheek', 'Makeup Brushes', 'Collaboration Collections', 'Makeup Accessories'], 'ColourPop is a cosmetics brand that sells makeup products', 'beauty'],
  ['Mejuri', ['Necklaces', 'Earrings', 'Rings', 'Bracelets & Cuffs', 'Charms', 'Piercing Services'], 'Mejuri sells fine jewelry', 'jewelry'],
  ['Burrow', ['Sofas & Sectionals', 'Rugs', 'Outdoor Furniture', 'Dining Furniture', 'Bedroom Furniture', 'Office Furniture'], 'Burrow sells modular sofas, sectionals, and home furniture', 'home'],
  ['Ritual', ['Multivitamins & Nutrients', 'Pregnancy & Postnatal', 'Gut Health', 'Skin Support', 'Relaxation & Sleep', 'Performance & Recovery'], 'Ritual sells science-backed vitamins, multivitamins, and supplements', 'supplements'],
  ['Wild One', ['Dog Walk Gear', 'Cat Wear & Accessories', 'Pet Toys', 'Feeding & Mealtime', 'Pet Travel & Carriers', 'Poop Bags & Accessories'], 'Wild One sells harnesses, collars, leashes for dogs and cats', 'pet'],
  ['Olipop', ['Prebiotic Soda', 'Sparkling Beverages', 'Variety Packs', 'Limited Edition Flavors', 'Mini Cans'], 'OLIPOP sells prebiotic sparkling sodas', 'food'],
  ['Snowboard dev store', ['Snowboards', 'Ski & Snowboard Accessories', 'Gift Cards'], 'This store sells snowboards and snowboard-related accessories', 'sports'],
  // Service businesses
  ['Dental clinic', ['General Dentistry', 'Orthodontics', 'Cosmetic Dentistry', 'Emergency Appointments'], 'Smile Dental is a family dental clinic offering check-ups, braces and emergency appointments.', 'clinic'],
  ['Multi-speciality clinic', ['Pediatrics', 'Gynecology', 'Dermatology', 'Book a Consultation'], 'A multi-speciality clinic where patients can book doctor consultations.', 'clinic'],
  ['Restaurant', ['Menu', 'Reservations', 'Brunch', 'Takeaway'], 'An Italian restaurant and pizzeria serving brunch and dinner; book a table online.', 'restaurant'],
  ['Salon', ['Haircuts', 'Hair Colour', 'Manicure & Pedicure', 'Bridal Makeup', 'Spa'], 'A unisex salon and spa offering haircuts, colour, nails and facials.', 'salon'],
  ['Cleaning service', ['Home Cleaning', 'Deep Cleaning Services', 'Office Cleaning'], 'A professional cleaning service for homes and offices — get a free quote.', 'services'],
];

describe('detectSegment', () => {
  for (const [name, cats, summary, want] of cases) {
    it(`${name} → ${want}`, () => {
      expect(detectSegment({ brandCategories: cats, brandSummary: summary })).toBe(want);
    });
  }
  it('falls back to general with no profile', () => {
    expect(detectSegment({})).toBe('general');
  });
});

describe('segmentBlock — service businesses', () => {
  it('clinics: emergency redirect, no diagnosis, booking never confirmed', () => {
    const b = segmentBlock({ brandCategories: ['Dentistry', 'Appointments'], brandSummary: 'a dental clinic for patients' });
    expect(b).toMatch(/emergency/);
    expect(b).toMatch(/NEVER diagnose/);
    expect(b).toMatch(/NEVER say a booking is confirmed/);
    expect(b).not.toMatch(/products\.get/);
  });
  it('restaurants collect guests/date/time for a table', () => {
    const b = segmentBlock({ brandCategories: ['Menu', 'Reservations'], brandSummary: 'restaurant serving dinner' });
    expect(b).toMatch(/number of guests/);
  });
});

describe('segmentBlock', () => {
  it('forbids cure claims for supplements and always adds the grounding rule', () => {
    const b = segmentBlock({ brandCategories: ['Multivitamins & Nutrients', 'Prenatal'], brandSummary: 'vitamins and supplements' });
    expect(b).toMatch(/NEVER say a product cures/);
    expect(b).toMatch(/products\.get/);
  });
});

describe('detectSegment — no brand profile (site blocks our reader)', () => {
  it('uses the name / domain for service businesses so safety rules still apply', () => {
    expect(detectSegment({ name: '[QA] Clove Dental', domain: 'www.clovedental.in', brandCategories: null })).toBe('clinic');
    expect(detectSegment({ name: 'Joe', domain: 'joespizzeria.com' })).toBe('restaurant');
    expect(detectSegment({ name: 'Studio', domain: 'mybarbershop.co.uk' })).toBe('salon');
  });
  it('stays general for a product store with no profile', () => {
    expect(detectSegment({ name: 'Allbirds', domain: 'allbirds.com' })).toBe('general');
  });
  it('ignores the name once a profile exists', () => {
    expect(detectSegment({ name: 'Kitchen Co', domain: 'kitchenco.com', brandCategories: ['Cookware', 'Kitchen Tools', 'Home'] })).toBe('home');
  });
});
