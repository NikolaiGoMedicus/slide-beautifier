/**
 * Brand Style System
 *
 * A flexible, expandable system for defining and applying brand visual identities
 * to AI-generated slide designs.
 *
 * Usage:
 * ```typescript
 * import { getBrand, buildBrandPrompt } from '@/lib/styles';
 *
 * const brand = getBrand('gomedicus');
 * const prompt = buildBrandPrompt(brand, { intensity: 'balanced' });
 * ```
 */

// Types
export type {
  BrandStyle,
  BrandColors,
  BrandTypography,
  BrandDesign,
  BrandModifiers,
  ColorToken,
  TypographyStyle,
  PromptOptions,
  BrandRegistry,
} from './types';

// Prompt builder
export {
  buildBrandPrompt,
  buildCompactBrandPrompt,
  estimatePromptLength,
  validateBrandStyle,
} from './prompt-builder';

// Brand registry
export {
  BRANDS,
  BRAND_LIST,
  getBrand,
  hasBrand,
  getBrandIds,
  gomedicus,
  gomedicusDark,
} from './brands';
