/**
 * Brand Registry
 *
 * Central registry for all brand style definitions.
 * Add new brands by importing them and adding to the BRANDS object.
 */

import type { BrandRegistry, BrandStyle } from '../types';
import { gomedicus, gomedicusDark } from './gomedicus';

/**
 * All registered brand styles.
 * To add a new brand:
 * 1. Create a new file in this directory (e.g., acme.ts)
 * 2. Define the brand following the BrandStyle interface
 * 3. Import and add it to this BRANDS object
 */
export const BRANDS: BrandRegistry = {
  gomedicus,
  'gomedicus-dark': gomedicusDark,
};

/**
 * List of all brand styles as an array.
 */
export const BRAND_LIST: BrandStyle[] = Object.values(BRANDS);

/**
 * Get a brand style by ID.
 *
 * @param id - The brand identifier
 * @returns The brand style or undefined if not found
 */
export function getBrand(id: string): BrandStyle | undefined {
  return BRANDS[id];
}

/**
 * Check if a brand ID exists in the registry.
 *
 * @param id - The brand identifier to check
 * @returns True if the brand exists
 */
export function hasBrand(id: string): boolean {
  return id in BRANDS;
}

/**
 * Get all brand IDs.
 *
 * @returns Array of brand identifiers
 */
export function getBrandIds(): string[] {
  return Object.keys(BRANDS);
}

// Re-export individual brands for direct imports
export { gomedicus, gomedicusDark };
