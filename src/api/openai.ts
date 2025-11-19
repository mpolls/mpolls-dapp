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

Your job is to guide users through creating a poll by asking questions and extracting the following information:

REQUIRED FIELDS:
1. Title: A concise poll title
2. Description: What the poll is about
3. Options: 2-10 poll options
4. Duration: How long the poll should run (in days)

OPTIONAL FIELDS:
5. Funding Type: How the poll is funded
   - "self": Creator funds it themselves
   - "community": Anyone can contribute funds
   - "treasury": Requires admin approval
6. Distribution Mode: How rewards are split among voters
   - "equal": Split equally among all voters
   - "fixed": Fixed amount per voter
   - "weighted": Based on response quality (for surveys)
7. Distribution Type: How rewards are distributed
   - "manual-pull": Voters claim their own rewards
   - "manual-push": Creator distributes to all voters
   - "autonomous": Automatic distribution by smart contract
8. Reward Pool: Initial funding amount (for self-funded polls)
9. Fixed Reward Amount: Amount per voter (for fixed distribution)
10. Funding Goal: Target amount (for community-funded polls)

CONVERSATION STYLE:
- Be friendly and professional
- Ask one question at a time
- Provide examples when helpful
- Confirm details before finalizing
- Use simple language

When you have collected all REQUIRED fields, ask the user if they want to configure the optional economics fields or use defaults.

When the user confirms they're done, respond with a JSON object in this exact format:
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

Only include the JSON when the user confirms they're ready to create the poll.`;

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
        content: "Hi! I'll help you create a professional poll or survey. Let's start with the basics.\n\nWhat would you like to ask people? Please provide a title for your poll."
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
          model: 'gpt-4',
          messages: this.conversationHistory,
          temperature: 0.7,
          max_tokens: 500
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
