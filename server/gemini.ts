import { GoogleGenAI, Modality } from "@google/genai";
import { storage } from "./storage";
import * as fs from "fs";
import * as path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface VideoAnalysis {
  keyMoments: { timestamp: number; description: string }[];
  titleVariations: string[];
  visualElements: string[];
  targetAudience: string;
  emotionalTone: string;
}

class GeminiService {
  async analyzeVideoContent(
    transcript: string,
    videoTitle: string,
    thumbnailUrl?: string | null
  ): Promise<VideoAnalysis> {
    try {
      const prompt = `Analyze this YouTube video content for thumbnail optimization.

Video Title: ${videoTitle}
Transcript: ${transcript.slice(0, 5000)}

Provide a JSON response with:
1. keyMoments: Array of {timestamp: number, description: string} for impactful moments
2. titleVariations: 5 alternative title suggestions optimized for CTR
3. visualElements: Key visual elements to include in thumbnails (faces, objects, text, colors)
4. targetAudience: Who is the target audience
5. emotionalTone: The emotional tone to convey (exciting, educational, controversial, etc.)

Respond ONLY with valid JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return {
        keyMoments: parsed.keyMoments || [],
        titleVariations: parsed.titleVariations || [],
        visualElements: parsed.visualElements || ['face', 'text', 'bright colors'],
        targetAudience: parsed.targetAudience || 'general audience',
        emotionalTone: parsed.emotionalTone || 'engaging',
      };
    } catch (error) {
      console.error('Video analysis error:', error);
      return {
        keyMoments: [],
        titleVariations: [],
        visualElements: ['face', 'text', 'bright colors'],
        targetAudience: 'general audience',
        emotionalTone: 'engaging',
      };
    }
  }

  async generateCampaignThumbnails(
    campaignId: string,
    userId: string,
    basePrompt: string,
    variationCount: number,
    referenceElements: string[]
  ): Promise<string[]> {
    const thumbnailIds: string[] = [];
    
    const variationStyles = [
      "vibrant and eye-catching with bold colors and dramatic lighting",
      "clean minimal design with strong focal point and contrast",
      "high energy dynamic composition with motion elements",
      "emotional close-up with expressive face and reaction",
      "curiosity-inducing with mystery element and question hook",
      "before/after transformation style with split composition",
    ];

    const promises = [];
    for (let i = 0; i < variationCount; i++) {
      const style = variationStyles[i % variationStyles.length];
      const elements = referenceElements.length > 0 
        ? `Include these key elements: ${referenceElements.join(', ')}.`
        : '';
      
      const enhancedPrompt = `${basePrompt}
Style: ${style}.
${elements}
Create a 16:9 YouTube thumbnail that maximizes click-through rate.
Make it highly clickable with clear focal point and readable text if any.
Professional quality, optimized for mobile viewing.`;

      promises.push(this.generateSingleCampaignThumbnail(
        campaignId,
        userId,
        enhancedPrompt,
        i
      ));
    }

    const results = await Promise.all(promises);
    return results.filter((id): id is string => id !== null);
  }

  private async generateSingleCampaignThumbnail(
    campaignId: string,
    userId: string,
    prompt: string,
    variationIndex: number
  ): Promise<string | null> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      let imageUrl = "";
      let textDescription = "";

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            
            const uploadsDir = path.join(process.cwd(), "uploads");
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const fileName = `campaign_${campaignId}_${variationIndex}_${Date.now()}.png`;
            const filePath = path.join(uploadsDir, fileName);
            
            const buffer = Buffer.from(imageData, "base64");
            fs.writeFileSync(filePath, buffer);
            
            imageUrl = `/uploads/${fileName}`;
          } else if (part.text) {
            textDescription = part.text;
          }
        }
      }

      if (!imageUrl) {
        imageUrl = `https://picsum.photos/seed/${campaignId}-${variationIndex}/1280/720`;
      }

      const thumbnail = await storage.createThumbnail({
        userId,
        name: `Campaign Variation ${variationIndex + 1}`,
        imageUrl,
        prompt,
        variationIndex,
        metadata: { campaignId, textDescription },
      });

      return thumbnail.id;
    } catch (error) {
      console.error(`Error generating campaign thumbnail ${variationIndex}:`, error);
      
      const fallbackUrl = `https://picsum.photos/seed/${campaignId}-${variationIndex}/1280/720`;
      const thumbnail = await storage.createThumbnail({
        userId,
        name: `Campaign Variation ${variationIndex + 1}`,
        imageUrl: fallbackUrl,
        prompt,
        variationIndex,
        metadata: { campaignId, error: "Generation failed, using placeholder" },
      });
      
      return thumbnail.id;
    }
  }

  async generateThumbnails(
    jobId: string,
    prompt: string,
    variationCount: number,
    userId: string
  ): Promise<void> {
    try {
      await storage.updateGenerationJob(jobId, { status: "processing" });

      const thumbnailPromises = [];
      
      for (let i = 0; i < variationCount; i++) {
        thumbnailPromises.push(this.generateSingleThumbnail(jobId, prompt, i, userId));
      }

      await Promise.all(thumbnailPromises);
      
      await storage.updateGenerationJob(jobId, {
        status: "completed",
        completedAt: new Date(),
      });
    } catch (error) {
      console.error("Error generating thumbnails:", error);
      await storage.updateGenerationJob(jobId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async generateSingleThumbnail(
    jobId: string,
    basePrompt: string,
    variationIndex: number,
    userId: string
  ): Promise<void> {
    try {
      const variationPrompts = [
        "vibrant and eye-catching with bold colors",
        "dramatic lighting with high contrast",
        "clean and minimal with focus on the subject",
        "dynamic with motion blur effects",
        "warm tones with golden hour lighting",
        "cool tones with a professional look",
        "vintage aesthetic with film grain",
        "modern and sleek with neon accents",
      ];

      const variation = variationPrompts[variationIndex % variationPrompts.length];
      const enhancedPrompt = `Create a YouTube thumbnail: ${basePrompt}. Style: ${variation}. Make it 16:9 aspect ratio, highly clickable, with clear focal point. Professional quality.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: enhancedPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      let imageUrl = "";
      let textDescription = "";

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            
            const uploadsDir = path.join(process.cwd(), "uploads");
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const fileName = `thumbnail_${jobId}_${variationIndex}_${Date.now()}.png`;
            const filePath = path.join(uploadsDir, fileName);
            
            const buffer = Buffer.from(imageData, "base64");
            fs.writeFileSync(filePath, buffer);
            
            imageUrl = `/uploads/${fileName}`;
          } else if (part.text) {
            textDescription = part.text;
          }
        }
      }

      if (!imageUrl) {
        imageUrl = `https://picsum.photos/seed/${jobId}-${variationIndex}/1280/720`;
      }

      await storage.createThumbnail({
        userId,
        jobId,
        name: `Variation ${variationIndex + 1}`,
        imageUrl,
        prompt: enhancedPrompt,
        variationIndex,
        metadata: { textDescription },
      });
    } catch (error) {
      console.error(`Error generating variation ${variationIndex}:`, error);
      
      const fallbackUrl = `https://picsum.photos/seed/${jobId}-${variationIndex}/1280/720`;
      await storage.createThumbnail({
        userId,
        jobId,
        name: `Variation ${variationIndex + 1}`,
        imageUrl: fallbackUrl,
        prompt: basePrompt,
        variationIndex,
        metadata: { error: "Generation failed, using placeholder" },
      });
    }
  }

  async editThumbnail(
    thumbnailId: string,
    userId: string,
    originalImageUrl: string,
    originalPrompt: string,
    editCommand: string
  ): Promise<{ thumbnailId: string; message: string }> {
    try {
      const editPrompt = `The user wants to edit this YouTube thumbnail with the following request:
"${editCommand}"

Original description: "${originalPrompt}"

Apply the user's requested changes while maintaining the core elements of the original image.
Make it 16:9 aspect ratio, highly clickable, with clear focal point. Professional quality.`;

      let contents: any[] = [];
      
      // Try to include the original image for context
      if (originalImageUrl.startsWith("/uploads/")) {
        const imagePath = path.join(process.cwd(), originalImageUrl.replace(/^\/+/, ""));
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          const base64Image = imageBuffer.toString("base64");
          contents = [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image,
              },
            },
            { text: editPrompt },
          ];
        } else {
          contents = [{ text: editPrompt }];
        }
      } else {
        // External URL - just use text prompt
        contents = [{ text: editPrompt }];
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      let imageUrl = "";
      let textDescription = "";

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            
            const uploadsDir = path.join(process.cwd(), "uploads");
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            const fileName = `edit_${thumbnailId}_${Date.now()}.png`;
            const filePath = path.join(uploadsDir, fileName);
            
            const buffer = Buffer.from(imageData, "base64");
            fs.writeFileSync(filePath, buffer);
            
            imageUrl = `/uploads/${fileName}`;
          } else if (part.text) {
            textDescription = part.text;
          }
        }
      }

      if (!imageUrl) {
        imageUrl = `https://picsum.photos/seed/edit-${thumbnailId}-${Date.now()}/1280/720`;
      }

      const newThumbnail = await storage.createThumbnail({
        userId,
        name: `Edited: ${editCommand.slice(0, 30)}${editCommand.length > 30 ? '...' : ''}`,
        imageUrl,
        prompt: `${originalPrompt}\n\nEdit: ${editCommand}`,
        variationIndex: null,
        metadata: { 
          editedFrom: thumbnailId, 
          editCommand,
          textDescription,
        },
      });

      return {
        thumbnailId: newThumbnail.id,
        message: textDescription || "Thumbnail edited successfully!",
      };
    } catch (error) {
      console.error("Error editing thumbnail:", error);
      throw new Error("Failed to apply edit to thumbnail");
    }
  }

  async analyzeVideoHooks(
    transcript: string,
    videoTitle: string,
    hookCount: number = 3
  ): Promise<{
    hooks: Array<{
      timestampSeconds: number;
      hookTitle: string;
      thumbnailText: string;
      strategy: string;
      confidenceScore: number;
    }>;
  }> {
    try {
      const prompt = `You are an expert YouTube content strategist. Analyze this video transcript to identify the ${hookCount} most viral-worthy moments that would make the best thumbnails and hooks.

Video Title: ${videoTitle}
Transcript: ${transcript.slice(0, 8000)}

For each viral moment, provide:
1. timestampSeconds: The exact second in the video where this moment occurs
2. hookTitle: A short, attention-grabbing hook title (max 10 words) that creates curiosity
3. thumbnailText: Bold text to overlay on a thumbnail (2-4 words max)
4. strategy: Brief explanation of why this moment is viral-worthy and the psychological trigger it uses
5. confidenceScore: 0-1 score for viral potential

Focus on moments with:
- Surprising revelations or plot twists
- Emotional peaks (excitement, shock, humor)
- Controversial or contrarian statements
- Transformation moments (before/after)
- Mystery or curiosity gaps

Respond ONLY with valid JSON in this format:
{
  "hooks": [
    {
      "timestampSeconds": 45,
      "hookTitle": "He revealed the secret that changed everything",
      "thumbnailText": "THE SECRET",
      "strategy": "Creates curiosity gap with promise of hidden knowledge",
      "confidenceScore": 0.92
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: prompt,
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { hooks: [] };

      return {
        hooks: (parsed.hooks || []).slice(0, hookCount).map((hook: any) => ({
          timestampSeconds: hook.timestampSeconds || 0,
          hookTitle: hook.hookTitle || "Viral moment",
          thumbnailText: hook.thumbnailText || "WATCH",
          strategy: hook.strategy || "High engagement potential",
          confidenceScore: Math.min(1, Math.max(0, hook.confidenceScore || 0.7)),
        })),
      };
    } catch (error) {
      console.error('Hook analysis error:', error);
      return { hooks: [] };
    }
  }
}

export const geminiService = new GeminiService();
