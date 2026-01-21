/**
 * Prompt Builder
 *
 * Generates optimized prompts from brand style configurations.
 * Based on Google's guidance: be specific with exact values, use narrative descriptions.
 */

import type { BrandStyle, PromptOptions } from './types';

/**
 * Intensity modifiers for prompt generation.
 */
const INTENSITY_MODIFIERS = {
  subtle: {
    colorStrength: 'subtle use of',
    designEmphasis: 'understated',
    prefix: 'Apply a refined, understated interpretation of',
  },
  balanced: {
    colorStrength: 'balanced application of',
    designEmphasis: 'harmonious',
    prefix: 'Apply a well-balanced interpretation of',
  },
  bold: {
    colorStrength: 'strong, prominent use of',
    designEmphasis: 'impactful',
    prefix: 'Apply a bold, distinctive interpretation of',
  },
} as const;

/**
 * Slide type specific instructions.
 */
const SLIDE_TYPE_INSTRUCTIONS = {
  title: 'This is a title slide - emphasize the main heading with large, impactful typography and minimal supporting elements.',
  content: 'This is a content slide - balance text readability with visual hierarchy, ensure adequate spacing between elements.',
  section: 'This is a section divider - create visual impact with the section title, use brand colors prominently.',
  comparison: 'This is a comparison slide - ensure clear visual distinction between compared elements while maintaining brand consistency.',
  data: 'This is a data slide - prioritize clarity of charts/graphs/numbers, use brand colors for data visualization.',
} as const;

/**
 * Builds a color palette section for the prompt.
 */
function buildColorSection(colors: BrandStyle['colors'], intensity: 'subtle' | 'balanced' | 'bold'): string {
  const modifier = INTENSITY_MODIFIERS[intensity];

  const colorLines = [
    `COLOR PALETTE: Apply ${modifier.colorStrength} the following brand colors:`,
    `- Primary: ${colors.primary.value} (${colors.primary.description}) for main elements and headers`,
    `- Secondary: ${colors.secondary.value} (${colors.secondary.description}) for supporting elements`,
    `- Accent: ${colors.accent.value} (${colors.accent.description}) for highlights and interactive elements`,
    `- Background: ${colors.background.value} (${colors.background.description}) as the main background`,
    `- Alternate sections: ${colors.backgroundAlt.value} (${colors.backgroundAlt.description})`,
    `- Text: ${colors.text.value} (${colors.text.description}) for body text`,
  ];

  return colorLines.join('\n');
}

/**
 * Builds a typography section for the prompt.
 */
function buildTypographySection(typography: BrandStyle['typography']): string {
  const lines = [
    'TYPOGRAPHY:',
    `- Headlines: Use ${typography.heading.family} at ${typography.heading.weight} weight`,
    `- Body text: Use ${typography.body.family} at ${typography.body.weight} weight`,
    `- Overall style: ${typography.characteristics}`,
  ];

  return lines.join('\n');
}

/**
 * Builds a design principles section for the prompt.
 */
function buildDesignSection(
  design: BrandStyle['design'],
  intensity: 'subtle' | 'balanced' | 'bold',
  includeSpecial: boolean
): string {
  const modifier = INTENSITY_MODIFIERS[intensity];

  const lines = [
    'DESIGN PRINCIPLES:',
    `- Layout: ${design.layout}`,
    `- Visual elements: ${design.elements}`,
    `- Tone: ${modifier.designEmphasis}, ${design.tone}`,
  ];

  if (includeSpecial && design.special) {
    lines.push(`- Special elements: ${design.special}`);
  }

  return lines.join('\n');
}

/**
 * Builds the standard closing instructions.
 */
function buildClosingInstructions(): string {
  return [
    'REQUIREMENTS:',
    '- Preserve all original text content exactly as shown',
    '- Enhance readability through improved typography, spacing, and alignment',
    '- Maintain professional quality suitable for business presentations',
    '- Render all text legibly at 4K resolution with crisp rendering',
  ].join('\n');
}

/**
 * Generates an optimized prompt from a brand style configuration.
 *
 * @param brand - The brand style definition
 * @param options - Optional prompt generation options
 * @returns A formatted prompt string for the AI model
 */
export function buildBrandPrompt(brand: BrandStyle, options: PromptOptions = {}): string {
  const {
    intensity = 'balanced',
    slideType,
    customInstructions,
    includeSpecialElements = true,
  } = options;

  const sections: string[] = [];

  // Opening instruction
  sections.push(
    `Generate a professionally redesigned version of this slide using ${brand.name} brand identity. ` +
      `The design should embody ${brand.description.toLowerCase()}.`
  );

  // Slide type specific instruction
  if (slideType && SLIDE_TYPE_INSTRUCTIONS[slideType]) {
    sections.push(SLIDE_TYPE_INSTRUCTIONS[slideType]);
  }

  // Color palette
  sections.push(buildColorSection(brand.colors, intensity));

  // Typography
  sections.push(buildTypographySection(brand.typography));

  // Design principles
  sections.push(buildDesignSection(brand.design, intensity, includeSpecialElements));

  // Custom instructions
  if (customInstructions) {
    sections.push(`ADDITIONAL INSTRUCTIONS: ${customInstructions}`);
  }

  // Closing requirements
  sections.push(buildClosingInstructions());

  return sections.join('\n\n');
}

/**
 * Generates a shorter prompt for when character limits are a concern.
 * This version prioritizes the most important brand elements.
 *
 * @param brand - The brand style definition
 * @returns A condensed prompt string
 */
export function buildCompactBrandPrompt(brand: BrandStyle): string {
  const { colors, typography, design } = brand;

  return `Redesign this slide with ${brand.name} brand identity.

Colors: Primary ${colors.primary.value} (${colors.primary.description}), secondary ${colors.secondary.value}, accent ${colors.accent.value}. Background ${colors.background.value}, text ${colors.text.value}.

Typography: ${typography.heading.family} (${typography.heading.weight}) for headlines, ${typography.body.family} for body. ${typography.characteristics}.

Design: ${design.layout}. ${design.elements}. Tone: ${design.tone}.

Preserve all text exactly. Render at 4K with crisp text.`;
}

/**
 * Estimates the character count of a generated prompt.
 * Useful for checking against API limits (2000 chars).
 *
 * @param brand - The brand style definition
 * @param options - Prompt generation options
 * @returns The estimated character count
 */
export function estimatePromptLength(brand: BrandStyle, options: PromptOptions = {}): number {
  return buildBrandPrompt(brand, options).length;
}

/**
 * Validates that a brand style will produce a valid prompt.
 *
 * @param brand - The brand style to validate
 * @returns An object with validation result and any errors
 */
export function validateBrandStyle(brand: BrandStyle): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!brand.id) errors.push('Brand ID is required');
  if (!brand.name) errors.push('Brand name is required');
  if (!brand.description) errors.push('Brand description is required');

  // Check colors
  const requiredColors = ['primary', 'secondary', 'accent', 'background', 'backgroundAlt', 'text'];
  for (const color of requiredColors) {
    if (!brand.colors[color]) {
      errors.push(`Color '${color}' is required`);
    } else {
      const colorToken = brand.colors[color];
      if (colorToken && !colorToken.value) errors.push(`Color '${color}' must have a value`);
      if (colorToken && !colorToken.description) errors.push(`Color '${color}' must have a description`);
    }
  }

  // Check typography
  if (!brand.typography.heading?.family) errors.push('Heading font family is required');
  if (!brand.typography.body?.family) errors.push('Body font family is required');

  // Check design
  if (!brand.design.layout) errors.push('Design layout is required');
  if (!brand.design.tone) errors.push('Design tone is required');

  // Check prompt length
  const promptLength = estimatePromptLength(brand);
  if (promptLength > 2000) {
    errors.push(`Generated prompt (${promptLength} chars) exceeds 2000 character limit`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
