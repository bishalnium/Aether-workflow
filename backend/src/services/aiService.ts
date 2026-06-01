// ===========================================
// AETHER WORKFLOW ENGINE - AI Service
// Integration with Groq GPT-OSS-120B Model
// ===========================================

import { logger } from '../utils/logger';
import { groqChat } from '../utils/groqClient';

interface ChatOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const GROQ_MODEL = 'openai/gpt-oss-120b';

class AIService {
  private lastRequestTime: number = 0;

  constructor() {}

  /**
   * Rate limiting helper
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Minimum 100ms between requests
    if (timeSinceLastRequest < 100) {
      await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Chat completion using rotating Groq GPT-OSS-120B client
   */
  async chat(options: ChatOptions): Promise<string> {
    const { prompt, systemPrompt, temperature = 0.7, maxTokens } = options;

    await this.rateLimit();

    try {
      const messages: any[] = [];
      
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      messages.push({ role: 'user', content: prompt });

      const text = await groqChat({
        messages,
        temperature,
        maxTokens
      });

      if (!text) {
        throw new Error('No response generated from Groq');
      }

      logger.debug(`AI response generated`, { model: GROQ_MODEL, promptLength: prompt.length });
      return text;
    } catch (error: any) {
      logger.error('AI service error', { error: error.message, model: GROQ_MODEL });
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  /**
   * Generate workflow from natural language description
   */
  async generateWorkflow(description: string): Promise<any> {
    const systemPrompt = `You are a workflow automation expert. Given a description of a workflow, generate a JSON structure representing the workflow.

The workflow JSON should have this structure:
{
  "name": "Workflow Name",
  "description": "What this workflow does",
  "nodes": [
    {
      "id": "unique_id",
      "type": "NODE_TYPE",
      "name": "Display Name",
      "position": { "x": number, "y": number },
      "config": { /* node-specific configuration */ }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id"
    }
  ]
}

Available node types:
TRIGGERS: TRIGGER_MANUAL, TRIGGER_WEBHOOK, TRIGGER_SCHEDULE
ACTIONS: ACTION_HTTP, ACTION_EMAIL, ACTION_CODE, ACTION_SET, ACTION_FILTER, ACTION_SWITCH, ACTION_LOOP, ACTION_WAIT
AI: ACTION_AI_CHAT, ACTION_AI_SUMMARIZE, ACTION_AI_CLASSIFY, ACTION_AI_TRANSFORM
INTEGRATIONS: ACTION_SLACK, ACTION_DISCORD, ACTION_DATABASE, ACTION_GOOGLE_SHEETS

Position nodes in a logical left-to-right flow, starting triggers at x=100, with subsequent nodes at increments of 300 on x-axis.
Y positions should vary to create visual separation (e.g., 100, 250, 400).

Return ONLY valid JSON, no markdown or explanation.`;

    const prompt = `Create a workflow for the following requirement:\n\n${description}`;

    const response = await this.chat({
      prompt,
      systemPrompt,
      model: 'gemini-2.5-flash',
      temperature: 0.3,
    });

    // Parse the JSON response
    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonStr = response;
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('Failed to parse workflow JSON', { response: response.substring(0, 200) });
      throw new Error('Failed to generate valid workflow structure');
    }
  }

  /**
   * Analyze workflow and suggest improvements
   */
  async analyzeWorkflow(workflow: any): Promise<string> {
    const systemPrompt = `You are a workflow optimization expert. Analyze workflows and provide actionable suggestions for improvement.`;
    
    const prompt = `Analyze this workflow and suggest improvements:\n\n${JSON.stringify(workflow, null, 2)}\n\nProvide:\n1. Potential issues or bottlenecks\n2. Suggestions for optimization\n3. Missing error handling recommendations`;

    return this.chat({
      prompt,
      systemPrompt,
      model: 'gemini-2.5-flash',
      temperature: 0.5,
    });
  }
}

export const aiService = new AIService();
export default aiService;
