import { Router, type Request, type Response } from 'express';
import { validateBeautifyRequest } from '../middleware/validation.js';
import { generateImage } from '../services/gemini.js';
import { saveToHistory } from '../services/database.js';
import type { BeautifyRequest, BeautifyResponse } from '../types/index.js';

export const beautifyRouter = Router();

beautifyRouter.post(
  '/',
  validateBeautifyRequest,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const body = req.body as BeautifyRequest;

    try {
      const result = await generateImage({
        image: body.image,
        mimeType: body.mimeType,
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
      });

      const processingTime = Date.now() - startTime;

      if (result.success && result.image && result.mimeType) {
        // Save to history
        const historyId = saveToHistory({
          originalImage: body.image,
          originalMimeType: body.mimeType,
          generatedImage: result.image,
          generatedMimeType: result.mimeType,
          prompt: body.prompt,
          preset: body.preset,
          aspectRatio: body.aspectRatio,
          processingTime,
        });

        const response: BeautifyResponse = {
          success: true,
          image: result.image,
          mimeType: result.mimeType,
          processingTime,
          historyId,
        };
        res.json(response);
      } else if (result.success) {
        // Success but no image (shouldn't happen)
        const response: BeautifyResponse = {
          success: false,
          error: 'No image generated',
          errorCode: 'API_ERROR',
          processingTime,
        };
        res.status(500).json(response);
      } else {
        const response: BeautifyResponse = {
          success: false,
          error: result.error,
          errorCode: result.errorCode as BeautifyResponse['errorCode'],
          processingTime,
        };
        res.status(500).json(response);
      }
    } catch (error) {
      console.error('Beautify error:', error);

      const processingTime = Date.now() - startTime;
      const response: BeautifyResponse = {
        success: false,
        error: 'An unexpected error occurred',
        errorCode: 'UNKNOWN',
        processingTime,
      };
      res.status(500).json(response);
    }
  }
);
