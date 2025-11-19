import React, { useState, useEffect, useRef } from 'react';
import { OpenAIService, PollParameters, Message, hasOpenAIKey, getOpenAIKey } from '../api/openai';
import './AIChatBox.css';

interface AIChatBoxProps {
  onPollParametersReady: (params: PollParameters) => void;
}

export const AIChatBox: React.FC<AIChatBoxProps> = ({ onPollParametersReady }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiService, setAiService] = useState<OpenAIService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedParams, setExtractedParams] = useState<PollParameters | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize OpenAI service
  useEffect(() => {
    if (!hasOpenAIKey()) {
      setError('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
      return;
    }

    try {
      const service = new OpenAIService(getOpenAIKey());
      setAiService(service);

      // Get initial greeting message from conversation history
      const history = service.getConversationHistory();
      setMessages(history.filter(msg => msg.role !== 'system'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize AI service');
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !aiService || isTyping) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsTyping(true);
    setError(null);

    try {
      const response = await aiService.sendMessage(userMessage);

      // Update messages from conversation history
      const history = aiService.getConversationHistory();
      setMessages(history.filter(msg => msg.role !== 'system'));

      // Try to extract poll parameters from the response
      const extraction = aiService.extractParameters(response);
      if (extraction && extraction.isComplete) {
        setExtractedParams(extraction.parameters);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartOver = () => {
    if (!aiService) return;

    aiService.resetConversation();
    const history = aiService.getConversationHistory();
    setMessages(history.filter(msg => msg.role !== 'system'));
    setExtractedParams(null);
    setError(null);
    setInputValue('');
  };

  const handleCreatePoll = () => {
    if (!extractedParams || !aiService) return;

    const validation = aiService.validateParameters(extractedParams);
    if (!validation.valid) {
      setError(`Validation errors: ${validation.errors.join(', ')}`);
      return;
    }

    onPollParametersReady(extractedParams);
  };

  const suggestedPrompts = [
    "I want to create a customer satisfaction survey",
    "Help me create a product feedback poll",
    "I need a poll about team preferences",
  ];

  if (error && !aiService) {
    return (
      <div className="ai-chatbox-error">
        <p>{error}</p>
        <p>To use AI-powered poll creation, add your OpenAI API key to the .env file:</p>
        <code>VITE_OPENAI_API_KEY=your_api_key_here</code>
      </div>
    );
  }

  return (
    <div className="ai-chatbox">
      <div className="ai-chatbox-header">
        <h3>AI Poll Creator</h3>
        <button
          className="ai-chatbox-reset-btn"
          onClick={handleStartOver}
          disabled={isTyping}
        >
          Start Over
        </button>
      </div>

      {error && (
        <div className="ai-chatbox-error-banner">
          {error}
        </div>
      )}

      <div className="ai-chatbox-messages">
        {messages.length === 0 && (
          <div className="ai-chatbox-suggestions">
            <p>Try asking:</p>
            {suggestedPrompts.map((prompt, index) => (
              <button
                key={index}
                className="ai-suggestion-btn"
                onClick={() => setInputValue(prompt)}
                disabled={isTyping}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`ai-message ${msg.role === 'user' ? 'ai-message-user' : 'ai-message-assistant'}`}
          >
            <div className="ai-message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="ai-message-content">
              <div className="ai-message-text">
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="ai-message ai-message-assistant">
            <div className="ai-message-avatar">🤖</div>
            <div className="ai-message-content">
              <div className="ai-typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {extractedParams && (
        <div className="ai-chatbox-ready">
          <div className="ai-chatbox-ready-message">
            ✓ Poll parameters collected! Ready to create your poll.
          </div>
          <button
            className="ai-chatbox-create-btn"
            onClick={handleCreatePoll}
          >
            Create Poll
          </button>
        </div>
      )}

      <div className="ai-chatbox-input">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          disabled={isTyping}
          rows={2}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isTyping}
          className="ai-chatbox-send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
};
