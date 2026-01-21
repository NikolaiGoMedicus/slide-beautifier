import type { Request, Response, NextFunction } from 'express';
import type { BeautifyRequest, MimeType, AspectRatio } from '../types/index.js';

const VALID_MIME_TYPES: MimeType[] = ['image/png', 'image/jpeg', 'image/webp'];
const VALID_ASPECT_RATIOS: AspectRatio[] = ['16:9', '4:3', '1:1'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB in base64 is roughly 13.3MB string
const MAX_PROMPT_LENGTH = 2000;

function isValidMimeType(type: string): type is MimeType {
  return VALID_MIME_TYPES.includes(type as MimeType);
}

function isValidAspectRatio(ratio: string): ratio is AspectRatio {
  return VALID_ASPECT_RATIOS.includes(ratio as AspectRatio);
}

export function validateBeautifyRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as Partial<BeautifyRequest>;

  // Check required fields
  if (!body.image || typeof body.image !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Image is required',
      errorCode: 'INVALID_IMAGE',
    });
    return;
  }

  if (!body.mimeType || !isValidMimeType(body.mimeType)) {
    res.status(400).json({
      success: false,
      error: 'Invalid or missing mimeType. Must be image/png, image/jpeg, or image/webp',
      errorCode: 'UNSUPPORTED_FORMAT',
    });
    return;
  }

  if (!body.prompt || typeof body.prompt !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Prompt is required',
      errorCode: 'INVALID_IMAGE',
    });
    return;
  }

  // Validate sizes
  const imageSize = Buffer.from(body.image, 'base64').length;
  if (imageSize > MAX_IMAGE_SIZE) {
    res.status(400).json({
      success: false,
      error: 'Image too large. Maximum size is 10MB',
      errorCode: 'FILE_TOO_LARGE',
    });
    return;
  }

  if (body.prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({
      success: false,
      error: `Prompt too long. Maximum length is ${MAX_PROMPT_LENGTH} characters`,
      errorCode: 'INVALID_IMAGE',
    });
    return;
  }

  // Validate optional aspect ratio
  if (body.aspectRatio && !isValidAspectRatio(body.aspectRatio)) {
    res.status(400).json({
      success: false,
      error: 'Invalid aspectRatio. Must be 16:9, 4:3, or 1:1',
      errorCode: 'INVALID_IMAGE',
    });
    return;
  }

  next();
}
