import type { Preset, PresetId } from '@/types';
import { gomedicus, buildBrandPrompt } from './styles';

export const PRESETS: Record<PresetId, Preset> = {
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Clean, business-ready design with balanced colors',
    prompt: `Generate an image of a professionally redesigned version of this slide. The new design should feature a clean, polished aesthetic suitable for high-stakes business presentations.

Composition: Apply a structured grid layout with clear visual hierarchy. Position the title prominently at the top using bold, modern sans-serif typography (similar to Inter or SF Pro). Body text should use lighter weight for contrast.

Style: Use a sophisticated color palette with a primary accent color complemented by neutral grays and white backgrounds. Apply subtle drop shadows and soft gradients for depth. Include thin separator lines to organize content sections.

Preserve all original text content exactly as shown, but enhance readability through improved typography, spacing, and alignment. Render all text legibly at 4K resolution.`,
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with bold typography and gradients',
    prompt: `Generate an image of this slide reimagined with a cutting-edge, contemporary design aesthetic that feels fresh and innovative.

Composition: Use generous white space with asymmetric layouts. Position key elements using the rule of thirds. Apply bold, oversized typography for headlines with clean geometric sans-serif fonts.

Style: Incorporate modern design trends including glassmorphism effects with frosted glass panels, subtle mesh gradients transitioning between complementary colors, and soft shadows creating layered depth. Use a vibrant but refined color palette with one bold accent color.

Maintain all original text content precisely as shown, enhancing it with improved kerning, line height, and visual weight distribution. Output at 4K resolution with crisp text rendering.`,
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Simple, elegant design with maximum clarity',
    prompt: `Generate an image of this slide transformed into a refined minimalist design emphasizing clarity and elegance through restraint.

Composition: Use extensive negative space, with content occupying no more than 40% of the frame. Apply a strict two-column or single-column layout with generous margins. Position elements with mathematical precision and consistent alignment.

Style: Employ a limited palette of no more than three colors - predominantly white or light gray backgrounds with black text and one subtle accent color. Use a single clean sans-serif typeface (similar to Helvetica Neue or Roboto) with clear weight hierarchy.

Preserve all essential text content exactly as shown, but strip away decorative elements. Focus purely on information hierarchy and readability. Render at 4K resolution with razor-sharp text.`,
  },
  vibrant: {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Eye-catching design with bold colors and energy',
    prompt: `Generate an image of this slide reimagined with bold, energetic visual design that commands attention while maintaining professional polish.

Composition: Use dynamic diagonal lines and overlapping geometric shapes to create movement. Apply bold scale contrast between headline and body text. Position elements to create visual tension and energy.

Style: Feature saturated, high-contrast colors with complementary or split-complementary color schemes. Include gradient overlays, bold color blocks, and abstract decorative shapes. Use thick, impactful typography with strong visual weight for headlines.

Preserve all original text content precisely as shown, ensuring high contrast for readability against colorful backgrounds. Maintain professional legibility despite the energetic design. Output at 4K resolution with vibrant color accuracy.`,
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    description: 'Traditional business style with authority',
    prompt: `Generate an image of this slide redesigned with a traditional corporate aesthetic that conveys trust, stability, and authority.

Composition: Apply a conservative, symmetrical layout with clear structure. Use a formal grid system with consistent margins and padding. Position the company/brand elements prominently with proper visual hierarchy.

Style: Employ a classic business color palette featuring navy blue, charcoal gray, and white with gold or burgundy accents. Use traditional serif fonts (similar to Georgia or Times) for headlines paired with clean sans-serif for body text. Include subtle professional textures or patterns.

Maintain all original text content exactly as displayed, enhancing it with formal typography and conservative styling. The design should feel established and trustworthy. Render at 4K resolution with professional text clarity.`,
  },
  gomedicus: {
    id: 'gomedicus',
    name: 'Gomedicus',
    description: gomedicus.description,
    prompt: buildBrandPrompt(gomedicus),
  },
};

export const PRESET_LIST = Object.values(PRESETS);

export function getPreset(id: PresetId): Preset {
  return PRESETS[id];
}

export function getPresetPrompt(id: PresetId): string {
  return PRESETS[id].prompt;
}
