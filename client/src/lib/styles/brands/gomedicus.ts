/**
 * Gomedicus Brand Style Definition
 *
 * Healthcare/medical professional visual identity.
 * Colors and typography designed to convey trust, professionalism, and clarity.
 *
 * Note: Update these values with official Gomedicus CI guidelines when available.
 */

import type { BrandStyle } from '../types';

export const gomedicus: BrandStyle = {
  id: 'gomedicus',
  name: 'Gomedicus',
  description: 'Healthcare professional style conveying trust, expertise, and clarity',

  colors: {
    // Primary: Deep medical blue - conveys trust, professionalism, healthcare
    primary: {
      value: '#005B96',
      description: 'deep medical blue',
    },

    // Secondary: Calming teal - healthcare, healing, calm
    secondary: {
      value: '#17A2B8',
      description: 'calming teal',
    },

    // Accent: Vibrant green - positive outcomes, health, vitality
    accent: {
      value: '#28A745',
      description: 'health green for positive elements',
    },

    // Background: Clean white - clinical cleanliness, clarity
    background: {
      value: '#FFFFFF',
      description: 'clean white',
    },

    // Background Alt: Light gray - subtle sections, cards
    backgroundAlt: {
      value: '#F8F9FA',
      description: 'light gray for sections',
    },

    // Text: Dark charcoal - excellent readability
    text: {
      value: '#2D3748',
      description: 'dark charcoal for readability',
    },
  },

  typography: {
    heading: {
      family: 'modern geometric sans-serif similar to Poppins or Montserrat',
      weight: 'semibold',
    },
    body: {
      family: 'highly readable sans-serif similar to Open Sans or Source Sans Pro',
      weight: 'regular',
    },
    characteristics:
      'clean, professional, excellent legibility essential for medical content and data',
  },

  design: {
    layout:
      'structured, balanced grid with clear visual hierarchy and generous whitespace for easy scanning',
    elements:
      'subtle rounded corners (4-8px radius), soft shadows for depth, clean divider lines, professional iconography',
    tone: 'trustworthy, professional, approachable yet authoritative, clinical precision',
    special:
      'subtle healthcare iconography where appropriate, clean data visualization for medical statistics, emphasis on accuracy and clarity',
  },
};

/**
 * Gomedicus brand with dark mode variant.
 * For future expansion - currently uses standard light mode.
 */
export const gomedicusDark: BrandStyle = {
  ...gomedicus,
  id: 'gomedicus-dark',
  name: 'Gomedicus Dark',
  description: 'Healthcare professional style in dark mode for reduced eye strain',

  colors: {
    ...gomedicus.colors,
    background: {
      value: '#1A202C',
      description: 'dark slate background',
    },
    backgroundAlt: {
      value: '#2D3748',
      description: 'slightly lighter dark sections',
    },
    text: {
      value: '#F7FAFC',
      description: 'light gray text for dark backgrounds',
    },
  },
};
