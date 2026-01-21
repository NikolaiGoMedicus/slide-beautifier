import { GoogleGenAI, type Part } from '@google/genai';
import type { MimeType, AspectRatio } from '../types/index.js';

// Nano Banana Pro - best for professional content with text rendering
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview';

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

interface GenerateImageOptions {
  image: string;
  mimeType: MimeType;
  prompt: string;
  aspectRatio?: AspectRatio;
}

interface GenerateImageResult {
  success: boolean;
  image?: string;
  mimeType?: MimeType;
  error?: string;
  errorCode?: string;
}

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const { image, mimeType, prompt, aspectRatio } = options;

  try {
    const client = getClient();

    // Build the prompt with aspect ratio if specified
    let fullPrompt = prompt;
    if (aspectRatio) {
      fullPrompt = `${prompt}\n\nOutput the image in ${aspectRatio} aspect ratio.`;
    }

    // Create the image part
    const imagePart: Part = {
      inlineData: {
        mimeType,
        data: image,
      },
    };

    // Create the text part
    const textPart: Part = {
      text: fullPrompt,
    };

    // Generate the image
    console.log('Calling Gemini API with model:', MODEL_NAME);
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [imagePart, textPart],
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    console.log('Gemini response:', JSON.stringify(response, null, 2).substring(0, 500));

    // Extract the image from the response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: 'No response generated',
        errorCode: 'API_ERROR',
      };
    }

    const content = candidates[0].content;
    if (!content?.parts) {
      return {
        success: false,
        error: 'No content in response',
        errorCode: 'API_ERROR',
      };
    }

    // Find the image part in the response
    for (const part of content.parts) {
      if (part.inlineData?.data && part.inlineData?.mimeType) {
        return {
          success: true,
          image: part.inlineData.data,
          mimeType: part.inlineData.mimeType as MimeType,
        };
      }
    }

    // Check for safety filter blocks
    const finishReason = candidates[0].finishReason;
    if (finishReason === 'SAFETY') {
      return {
        success: false,
        error: 'Content was blocked by safety filters',
        errorCode: 'SAFETY_FILTER',
      };
    }

    return {
      success: false,
      error: 'No image found in response',
      errorCode: 'API_ERROR',
    };
  } catch (error) {
    console.error('Gemini API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for permission/API key issues
    if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('API_KEY_SERVICE_BLOCKED')) {
      return {
        success: false,
        error: 'API key does not have permission. Please enable the Generative Language API in Google Cloud Console.',
        errorCode: 'API_ERROR',
      };
    }

    // Check for rate limiting
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        errorCode: 'RATE_LIMIT',
      };
    }

    // Check for safety filter
    if (errorMessage.toLowerCase().includes('safety')) {
      return {
        success: false,
        error: 'Content was blocked by safety filters',
        errorCode: 'SAFETY_FILTER',
      };
    }

    return {
      success: false,
      error: `API error: ${errorMessage}`,
      errorCode: 'API_ERROR',
    };
  }
}
