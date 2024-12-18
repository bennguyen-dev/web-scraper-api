import { Request, Response } from "express";
import { addFrameToImage } from "../services/image.service";

export async function addImageFrame(req: Request, res: Response) {
  const { imageUrl, template } = req.body;

  // Validate required fields
  if (!imageUrl) {
    return res.status(400).json({
      status: 400,
      error: "imageUrl is required"
    });
  }

  if (!template) {
    return res.status(400).json({
      status: 400,
      error: "template is required"
    });
  }

  // Validate template structure
  const requiredFields = ['id', 'name', 'padding', 'gradient', 'borderRadius'];
  const missingFields = requiredFields.filter(field => !(field in template));
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: 400,
      error: `Missing required template fields: ${missingFields.join(', ')}`
    });
  }

  try {
    const result = await addFrameToImage(imageUrl, template);
    
    if (result.status === 200 && result.data) {
      // Set response headers for image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'inline');
      return res.send(result.data.imageBuffer);
    } else {
      return res.status(result.status).json({
        status: result.status,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in addImageFrame controller:', error);
    return res.status(500).json({
      status: 500,
      error: 'Internal server error'
    });
  }
}
