// OpenAI API integration for conversational poll creation

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PollParameters {
  title?: string;
  description?: string;
  options?: string[];
  duration?: number; // in days
  fundingType?: 'self' | 'community' | 'treasury';
  distributionMode?: 'equal' | 'fixed' | 'weighted';
  distributionType?: 'manual-pull' | 'manual-push' | 'autonomous';
  rewardPool?: number;
  fixedRewardAmount?: number;
  fundingGoal?: number;
  projectId?: number;
}

export interface ExtractionResult {
  parameters: PollParameters;
  missingFields: string[];
  isComplete: boolean;
}

const SYSTEM_PROMPT = `You are a helpful assistant that helps users create professional polls and surveys for business feedback on the Massa blockchain.

SMART POLL CREATION:
You can create polls from a single prompt! Analyze the user's request and intelligently extract poll details. If enough information is provided, return the complete poll JSON immediately.

REQUIRED FIELDS:
1. Title: A concise poll title (infer from user's question/topic)
2. Description: What the poll is about (can expand from title)
3. Options: 2-10 poll options (if not specified, suggest relevant options based on context)
4. Duration: How long the poll should run (in days, default: 7 days)

OPTIONAL FIELDS WITH SMART DEFAULTS:
5. Funding Type: How the poll is funded (default: "self")
   - "self": Creator funds it themselves
   - "community": Anyone can contribute funds
   - "treasury": Requires admin approval
6. Distribution Mode: How rewards are split among voters (default: "equal")
   - "equal": Split equally among all voters
   - "fixed": Fixed amount per voter (use if user mentions "X MASSA per response/voter")
   - "weighted": Based on response quality (use if user mentions "quality" or "best responses")
7. Distribution Type: How rewards are distributed (default: "manual-pull")
   - "manual-pull": Voters claim their own rewards
   - "manual-push": Creator distributes to all voters
   - "autonomous": Automatic distribution by smart contract
8. Reward Pool: Initial funding amount (default: 0, use value if user mentions total fund)
9. Fixed Reward Amount: Amount per voter (default: 0, use if distribution mode is "fixed")
10. Funding Goal: Target amount (default: 0, use if funding type is "community")

INTELLIGENT EXTRACTION EXAMPLES:
- "30 days" or "a month" → duration: 30
- "10 MASSA fund" or "10 MASSA reward pool" → rewardPool: 10
- "1 MASSA per response" or "fixed 1 MASSA each" → distributionMode: "fixed", fixedRewardAmount: 1
- "split equally" or "equal rewards" → distributionMode: "equal"
- "collect 10 responses" with "10 MASSA fund" and "1 MASSA each" → suggests fixed distribution
- If options not specified but topic is clear, suggest 3-4 relevant options

DEFAULT VALUES (use these if not specified):
- duration: 7
- fundingType: "self"
- distributionMode: "equal"
- distributionType: "manual-pull"
- rewardPool: 0
- fixedRewardAmount: 0
- fundingGoal: 0

RESPONSE STRATEGY:
1. If the user provides a complete request (title/topic is clear), immediately return the JSON with intelligent defaults
2. If poll options are not provided but the topic is clear, suggest 3-4 relevant options
3. Only ask questions if critical information is missing (like the poll topic/question)
4. Be proactive - don't ask unnecessary questions if you can infer reasonable defaults

When ready to create the poll, respond with ONLY this JSON format (no additional text):
{
  "complete": true,
  "parameters": {
    "title": "string",
    "description": "string",
    "options": ["option1", "option2", ...],
    "duration": number,
    "fundingType": "self|community|treasury",
    "distributionMode": "equal|fixed|weighted",
    "distributionType": "manual-pull|manual-push|autonomous",
    "rewardPool": number,
    "fixedRewardAmount": number,
    "fundingGoal": number
  }
}

EXAMPLE PROMPT: "Create a poll to ask what features to build next for Mass Polls. Collect responses for 30 days with a reward pool of 10 Massa. Each response gets a fixed 1 Massa. Collect a total of 10 responses"

EXAMPLE RESPONSE:
{
  "complete": true,
  "parameters": {
    "title": "What features should we build next for Mass Polls?",
    "description": "Help us prioritize development by voting on which features you'd like to see implemented next in Mass Polls.",
    "options": ["AI-powered poll creation", "Advanced analytics dashboard", "Mobile app", "Integration with other blockchains"],
    "duration": 30,
    "fundingType": "self",
    "distributionMode": "fixed",
    "distributionType": "manual-pull",
    "rewardPool": 10,
    "fixedRewardAmount": 1,
    "fundingGoal": 0
  }
}`;


export class OpenAIService {
  private apiKey: string;
  private conversationHistory: Message[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.initializeConversation();
  }

  private initializeConversation() {
    this.conversationHistory = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'assistant',
        content: "Hi! I'll help you create a professional poll or survey on the Massa blockchain.\n\nYou can either:\n• Describe your poll in one message (e.g., \"Create a 30-day poll asking what features to build next, with 10 MASSA reward pool, 1 MASSA per response\")\n• Or I can guide you step-by-step\n\nWhat would you like to create?"
      }
    ];
  }

  async sendMessage(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: this.conversationHistory,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to get response from OpenAI');
      }

      const data = await response.json();
      const assistantMessage = data.choices[0]?.message?.content || 'Sorry, I did not understand that.';

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      return assistantMessage;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  extractParameters(assistantMessage: string): ExtractionResult | null {
    // Try to extract JSON from the message
    const jsonMatch = assistantMessage.match(/\{[\s\S]*"complete":\s*true[\s\S]*\}/);

    if (!jsonMatch) {
      return null;
    }

    try {
      const extracted = JSON.parse(jsonMatch[0]);

      if (!extracted.complete || !extracted.parameters) {
        return null;
      }

      const params = extracted.parameters;
      const missingFields: string[] = [];

      // Check required fields
      if (!params.title) missingFields.push('title');
      if (!params.description) missingFields.push('description');
      if (!params.options || params.options.length < 2) missingFields.push('options');
      if (!params.duration) missingFields.push('duration');

      return {
        parameters: params,
        missingFields,
        isComplete: missingFields.length === 0
      };
    } catch (error) {
      console.error('Failed to parse parameters:', error);
      return null;
    }
  }

  getConversationHistory(): Message[] {
    return this.conversationHistory;
  }

  resetConversation() {
    this.initializeConversation();
  }

  // Validate extracted parameters
  validateParameters(params: PollParameters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.title || params.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!params.description || params.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!params.options || params.options.length < 2) {
      errors.push('At least 2 options are required');
    }

    if (params.options && params.options.length > 10) {
      errors.push('Maximum 10 options allowed');
    }

    if (!params.duration || params.duration < 1) {
      errors.push('Duration must be at least 1 day');
    }

    if (params.distributionMode === 'fixed' && (!params.fixedRewardAmount || params.fixedRewardAmount <= 0)) {
      errors.push('Fixed reward amount is required for fixed distribution mode');
    }

    if (params.fundingType === 'community' && (!params.fundingGoal || params.fundingGoal <= 0)) {
      errors.push('Funding goal is required for community-funded polls');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Helper to check if OpenAI API key is configured
export function hasOpenAIKey(): boolean {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}

// Get OpenAI API key from environment
export function getOpenAIKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
  }
  return key;
}
