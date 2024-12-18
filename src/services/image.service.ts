import sharp from "sharp";
import { createCanvas } from "canvas";
import { writeFile } from "fs/promises";
import { join } from "path";
import fs from "fs";

interface FrameTemplate {
  id: string;
  name: string;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  gradient: {
    from: string;
    to: string;
    direction: "horizontal" | "vertical";
  };
  borderRadius: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  border?: {
    width: number;
    color: string;
  };
}

interface AddFrameResult {
  status: number;
  data?: {
    imageBuffer: Buffer;
    savedPath?: string;
  };
  error?: string;
}

async function ensureOutputDir(dir: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs").promises;
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

function createRoundedRectPath(
  width: number,
  height: number,
  { topLeft, topRight, bottomRight, bottomLeft }: FrameTemplate["borderRadius"],
): string {
  return `M${topLeft},0
    h${width - topLeft - topRight}
    q${topRight},0 ${topRight},${topRight}
    v${height - topRight - bottomRight}
    q0,${bottomRight} -${bottomRight},${bottomRight}
    h-${width - bottomRight - bottomLeft}
    q-${bottomLeft},0 -${bottomLeft},-${bottomLeft}
    v-${height - bottomLeft - topLeft}
    q0,-${topLeft} ${topLeft},-${topLeft}`;
}

export async function addFrameToImage(
  imageUrl: string,
  template: FrameTemplate,
): Promise<AddFrameResult> {
  try {
    // Download and process the original image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return {
        status: 400,
        error: "Failed to fetch image",
      };
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // Create a canvas for the gradient background
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext("2d");

    // Create gradient
    const gradient =
      template.gradient.direction === "horizontal"
        ? ctx.createLinearGradient(0, 0, 1200, 0)
        : ctx.createLinearGradient(0, 0, 0, 630);

    gradient.addColorStop(0, template.gradient.from);
    gradient.addColorStop(1, template.gradient.to);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // Convert canvas to buffer
    const backgroundBuffer = canvas.toBuffer("image/png");

    // Process the original image
    const image = sharp(Buffer.from(imageBuffer));
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not get image dimensions");
    }

    // Calculate available space considering padding
    const availableWidth =
      1200 - (template.padding.left + template.padding.right);
    const availableHeight =
      630 - (template.padding.top + template.padding.bottom);

    // Scale image to match available width exactly
    const scaleRatio = availableWidth / metadata.width;
    const width = availableWidth;
    const scaledHeight = Math.round(metadata.height * scaleRatio);

    // Calculate crop height if image is too tall
    const height = Math.min(scaledHeight, availableHeight);
    const cropTop = Math.max(
      0,
      Math.round((scaledHeight - availableHeight) / 2),
    );

    // Calculate final position
    const left = template.padding.left;
    const top = template.padding.top;

    // Default border settings
    const borderWidth = template.border?.width || 1;
    const borderColor = template.border?.color || "#FFFFFF";

    // Create path for rounded corners
    const roundedRectPath = createRoundedRectPath(
      width,
      height,
      template.borderRadius,
    );

    // Create SVG mask with border and individual border radius values
    const svgMask = `<svg width="${width}" height="${height}">
      <defs>
        <path id="bounds" d="${roundedRectPath}" />
      </defs>
      <!-- Border background -->
      <use href="#bounds" fill="none" stroke="${borderColor}" stroke-width="${borderWidth * 2}"/>
      <!-- Image mask -->
      <use href="#bounds" fill="black"/>
    </svg>`;

    // Process and composite the images
    const result = await sharp(backgroundBuffer)
      .composite([
        {
          input: await image
            .resize(width, scaledHeight, {
              fit: "fill",
            })
            .extract({
              left: 0,
              top: cropTop,
              width,
              height,
            })
            .composite([
              {
                input: Buffer.from(svgMask),
                blend: "dest-in",
              },
            ])
            .toBuffer(),
          top,
          left,
        },
      ])
      .toBuffer();

    // Save the image to file
    const outputDir = join(process.cwd(), "output");
    await ensureOutputDir(outputDir);

    const timestamp = new Date().getTime();
    const filename = `frame_${template.id}_${timestamp}.png`;
    const outputPath = join(outputDir, filename);

    await writeFile(outputPath, result);

    return {
      status: 200,
      data: {
        imageBuffer: result,
        savedPath: outputPath,
      },
    };
  } catch (error) {
    console.error("Error processing image:", error);
    return {
      status: 500,
      error: "Error processing image",
    };
  }
}
