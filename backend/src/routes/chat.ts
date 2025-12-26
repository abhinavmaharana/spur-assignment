import { Router, Request, Response } from 'express';
import { z } from 'zod';
import cuid from 'cuid';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { createLLMProvider } from '../services/llm';
import { getCachedMessages, cacheMessages } from '../services/redis';
import { chatRateLimiter } from '../middleware/rateLimit';
import { sanitizeInput } from '../utils/sanitize';

const router = Router();

const messageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message is too long (max 5000 characters)')
    .trim(),
  sessionId: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
});

// Initialize LLM provider once
let llmProvider: ReturnType<typeof createLLMProvider> | null = null;

function getLLMProvider() {
  if (!llmProvider) {
    try {
      llmProvider = createLLMProvider();
    } catch (error) {
      console.error('Failed to initialize LLM provider:', error);
      throw error;
    }
  }
  return llmProvider;
}

// Get conversation history endpoint
router.get('/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || sessionId.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'sessionId is required',
      });
    }

    // Fetch conversation messages
    const messages = await prisma.message.findMany({
      where: { conversationId: sessionId },
      orderBy: { createdAt: 'asc' },
      take: 100, // Limit to last 100 messages
    });

    return res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.createdAt,
        reaction: (msg as any).reaction || null,
      })),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching history:', errorMessage);
    
    return res.status(500).json({
      error: 'An error occurred fetching conversation history',
      message: 'Please try again shortly.',
    });
  }
});

// Update message reaction endpoint
router.post('/message/:messageId/reaction', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;

    // Validate reaction value
    if (reaction !== 'thumbs_up' && reaction !== 'thumbs_down' && reaction !== null) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'reaction must be "thumbs_up", "thumbs_down", or null',
      });
    }

    // Update message with reaction
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { reaction } as any,
    });

    return res.json({
      success: true,
      messageId: updatedMessage.id,
      reaction: (updatedMessage as any).reaction,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating reaction:', errorMessage);
    
    // Handle case where message doesn't exist
    if (errorMessage.includes('Record to update does not exist')) {
      return res.status(404).json({
        error: 'Message not found',
        message: 'The message does not exist.',
      });
    }
    
    return res.status(500).json({
      error: 'An error occurred updating the reaction',
      message: 'Please try again shortly.',
    });
  }
});

// Chat message endpoint with rate limiting
router.post('/message', chatRateLimiter, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = messageSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors[0]?.message || 'Validation failed',
      });
    }

    const { message, sessionId } = validationResult.data;

    // Message is already validated and trimmed by Zod
    // Additional safety: ensure it's not empty after trim (shouldn't happen, but defensive)
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Message cannot be empty',
      });
    }

    // Sanitize user input to prevent XSS attacks
    const sanitizedMessage = sanitizeInput(trimmedMessage);

    let conversationId: string;

    // Create or use existing conversation
    if (sessionId) {
      // Verify conversation exists
      try {
        const existing = await prisma.conversation.findUnique({
          where: { id: sessionId },
        });

        if (existing) {
          conversationId = sessionId;
        } else {
          // Create new conversation if sessionId is invalid
          const newConv = await prisma.conversation.create({
            data: { id: cuid() },
          });
          conversationId = newConv.id;
        }
      } catch (dbError) {
        // If database query fails, create new conversation
        console.error('Database error checking conversation:', dbError);
        const newConv = await prisma.conversation.create({
          data: { id: cuid() },
        });
        conversationId = newConv.id;
      }
    } else {
      // Create new conversation
      const newConv = await prisma.conversation.create({
        data: { id: cuid() },
      });
      conversationId = newConv.id;
    }

    // Persist user message (store sanitized version)
    try {
      await prisma.message.create({
        data: {
          id: cuid(),
          conversationId,
          sender: 'user',
          text: sanitizedMessage,
        },
      });
    } catch (dbError) {
      console.error('Database error saving user message:', dbError);
      // Continue anyway - we'll try to generate reply even if message save fails
      // This is a graceful degradation approach
    }

    // Fetch conversation history (last 20 messages)
    let historyMessages: Prisma.MessageGetPayload<{}>[];
    try {
      historyMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
    } catch (dbError) {
      console.error('Database error fetching history:', dbError);
      // If history fetch fails, use empty history (graceful degradation)
      historyMessages = [];
    }

    // Check Redis cache first (optional optimization)
    const cachedHistory = await getCachedMessages(conversationId);
    let history: Array<{ sender: string; text: string }>;

    if (cachedHistory && cachedHistory.length === historyMessages.length) {
      history = cachedHistory;
    } else {
      history = historyMessages.map((msg) => ({
        sender: msg.sender,
        text: msg.text,
      }));
    }

    // Generate AI reply with timeout protection
    let aiReply: string;
    try {
        const provider = getLLMProvider();
          // Use original trimmed message (not sanitized) for LLM to preserve natural language
          aiReply = await provider.generateReply(history, trimmedMessage);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('LLM generation error:', errorMessage);
      aiReply = "Sorry — our support agent is having trouble right now. Please try again shortly.";
    }

    // Persist AI reply
    try {
      await prisma.message.create({
        data: {
          id: cuid(),
          conversationId,
          sender: 'ai',
          text: aiReply,
        },
      });
    } catch (dbError) {
      console.error('Database error saving AI message:', dbError);
      // Continue anyway - reply is already generated and will be sent to user
      // This is a graceful degradation approach
    }

    // Update cache with new messages (use sanitized message for cache)
    const updatedHistory = [
      ...history,
      { sender: 'user', text: sanitizedMessage },
      { sender: 'ai', text: aiReply },
    ].slice(-20);

    await cacheMessages(conversationId, updatedHistory);

    // Return response
    return res.json({
      reply: aiReply,
      sessionId: conversationId,
    });
  } catch (error: unknown) {
    // Log full error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Chat endpoint error:', errorMessage, errorStack);

    // Never expose stack traces or internal errors to client
    // Return a generic, user-friendly error message
    return res.status(500).json({
      error: 'An error occurred processing your message',
      message: 'Please try again shortly.',
    });
  }
});

export default router;
