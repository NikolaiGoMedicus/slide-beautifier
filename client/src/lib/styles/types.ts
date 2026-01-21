/**
 * Brand Style System Types
 *
 * Design token-inspired configuration for brand visual identity.
 * Based on DTCG (Design Tokens Community Group) patterns.
 */

/**
 * A color token with its value and semantic description.
 * The description is used in prompt generation to give context to the AI.
 */
export interface ColorToken {
  /** Hex color value (e.g., "#005B96") */
  value: string;
  /** Human-readable description for prompt generation (e.g., "deep medical blue") */
  description: string;
}

/**
 * Brand color palette configuration.
 * All colors should be specified with exact hex values for consistency.
 */
export interface BrandColors {
  /** Primary brand color - used for main elements, headers, key UI */
  primary: ColorToken;
  /** Secondary brand color - supporting color for variety */
  secondary: ColorToken;
  /** Accent color - highlights, CTAs, interactive elements */
  accent: ColorToken;
  /** Main background color */
  background: ColorToken;
  /** Alternative background for sections/cards */
  backgroundAlt: ColorToken;
  /** Primary text color */
  text: ColorToken;
  /** Optional: Additional brand colors */
  [key: string]: ColorToken | undefined;
}

/**
 * Typography specification for a text style.
 */
export interface TypographyStyle {
  /** Font family description (e.g., "geometric sans-serif similar to Poppins") */
  family: string;
  /** Font weight (e.g., "bold", "semibold", "regular") */
  weight: string;
}

/**
 * Brand typography configuration.
 */
export interface BrandTypography {
  /** Heading/title typography */
  heading: TypographyStyle;
  /** Body text typography */
  body: TypographyStyle;
  /** Overall typography characteristics for prompts */
  characteristics: string;
}

/**
 * Design principles and visual style configuration.
 */
export interface BrandDesign {
  /** Layout approach (e.g., "structured grid with generous whitespace") */
  layout: string;
  /** Visual elements (e.g., "rounded corners, soft shadows") */
  elements: string;
  /** Overall tone/mood (e.g., "professional, trustworthy") */
  tone: string;
  /** Optional: Industry-specific or special design elements */
  special?: string;
}

/**
 * Optional modifiers for brand style variations.
 */
export interface BrandModifiers {
  /** Style intensity: how strongly to apply the brand styling */
  intensity?: 'subtle' | 'balanced' | 'bold';
  /** Formality level */
  formality?: 'casual' | 'professional' | 'formal';
  /** Slide type for context-specific styling */
  slideType?: 'title' | 'content' | 'section' | 'comparison' | 'data';
}

/**
 * Complete brand style definition.
 * This is the main interface for defining a brand's visual identity.
 */
export interface BrandStyle {
  /** Unique identifier for the brand (used as preset ID) */
  id: string;
  /** Display name */
  name: string;
  /** Short description of the brand style */
  description: string;
  /** Color palette */
  colors: BrandColors;
  /** Typography settings */
  typography: BrandTypography;
  /** Design principles */
  design: BrandDesign;
  /** Optional modifiers for variations */
  modifiers?: BrandModifiers;
}

/**
 * Options for prompt generation.
 */
export interface PromptOptions {
  /** Override the default intensity */
  intensity?: 'subtle' | 'balanced' | 'bold';
  /** Specific slide type for targeted styling */
  slideType?: 'title' | 'content' | 'section' | 'comparison' | 'data';
  /** Additional custom instructions to append */
  customInstructions?: string;
  /** Whether to include special/industry-specific elements */
  includeSpecialElements?: boolean;
}

/**
 * Brand registry type for storing multiple brands.
 */
export type BrandRegistry = Record<string, BrandStyle>;
