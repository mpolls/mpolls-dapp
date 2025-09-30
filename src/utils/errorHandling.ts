// Error handling utilities for Massa Polls

export interface ErrorContext {
  action: string;
  pollId?: string;
  address?: string;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestion: string;
  technical?: string;
}

/**
 * Convert blockchain/contract errors into user-friendly messages
 */
export function parseBlockchainError(error: unknown, context?: ErrorContext): UserFriendlyError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorLower = errorMessage.toLowerCase();

  // Wallet/Connection Errors
  if (errorLower.includes('wallet') || errorLower.includes('connect')) {
    if (errorLower.includes('not connected') || errorLower.includes('no wallet')) {
      return {
        title: 'Wallet Not Connected',
        message: 'Your wallet is not connected to the application.',
        suggestion: 'Please connect your MassaStation or Bearby wallet and try again.',
        technical: errorMessage
      };
    }
    if (errorLower.includes('rejected') || errorLower.includes('denied')) {
      return {
        title: 'Transaction Rejected',
        message: 'You rejected the transaction in your wallet.',
        suggestion: 'Please try again and approve the transaction when prompted.',
        technical: errorMessage
      };
    }
    if (errorLower.includes('unlock')) {
      return {
        title: 'Wallet Locked',
        message: 'Your wallet is locked.',
        suggestion: 'Please unlock your wallet and try again.',
        technical: errorMessage
      };
    }
  }

  // Balance/Fee Errors
  if (errorLower.includes('insufficient balance') || errorLower.includes('insufficient funds')) {
    return {
      title: 'Insufficient Balance',
      message: 'You don\'t have enough MASSA tokens to complete this transaction.',
      suggestion: 'Please add more MASSA to your wallet. You need at least 0.01 MASSA for transaction fees.',
      technical: errorMessage
    };
  }

  if (errorLower.includes('fee') && errorLower.includes('too low')) {
    return {
      title: 'Transaction Fee Too Low',
      message: 'The transaction fee is too low for the network to process.',
      suggestion: 'This is a system issue. Please try again or contact support.',
      technical: errorMessage
    };
  }

  // Contract/Poll Errors
  if (errorLower.includes('poll') && errorLower.includes('not found')) {
    return {
      title: 'Poll Not Found',
      message: `Poll ${context?.pollId || ''} could not be found on the blockchain.`,
      suggestion: 'The poll may have been removed or the ID is incorrect. Please refresh the page.',
      technical: errorMessage
    };
  }

  if (errorLower.includes('already voted')) {
    return {
      title: 'Already Voted',
      message: 'You have already cast your vote on this poll.',
      suggestion: 'Each wallet address can only vote once per poll.',
      technical: errorMessage
    };
  }

  if (errorLower.includes('poll') && (errorLower.includes('not active') || errorLower.includes('inactive') || errorLower.includes('ended'))) {
    return {
      title: 'Poll Closed',
      message: 'This poll is no longer accepting votes.',
      suggestion: 'The poll has ended or been closed by the creator. You can view the results but cannot vote.',
      technical: errorMessage
    };
  }

  if (errorLower.includes('invalid option')) {
    return {
      title: 'Invalid Vote Option',
      message: 'The voting option you selected is not valid.',
      suggestion: 'Please refresh the page and try again.',
      technical: errorMessage
    };
  }

  if (errorLower.includes('not authorized') || errorLower.includes('permission denied')) {
    return {
      title: 'Not Authorized',
      message: 'You don\'t have permission to perform this action.',
      suggestion: 'Only the poll creator can perform this action.',
      technical: errorMessage
    };
  }

  // Contract Deployment/Existence Errors
  if (errorLower.includes('contract') && errorLower.includes('not found')) {
    return {
      title: 'Contract Not Found',
      message: 'The smart contract could not be found on the blockchain.',
      suggestion: 'Please check that you\'re connected to the correct network (Buildnet) and that the contract is deployed.',
      technical: errorMessage
    };
  }

  if (errorLower.includes('function not found')) {
    return {
      title: 'Contract Function Missing',
      message: 'The contract function could not be found.',
      suggestion: 'The contract may be outdated or incorrectly deployed. Please contact support.',
      technical: errorMessage
    };
  }

  // Network Errors
  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('connection')) {
    return {
      title: 'Network Error',
      message: 'There was a problem connecting to the Massa network.',
      suggestion: 'Please check your internet connection and try again. The Massa network may also be experiencing delays.',
      technical: errorMessage
    };
  }

  if (errorLower.includes('rate limit')) {
    return {
      title: 'Rate Limit Exceeded',
      message: 'Too many requests have been made in a short time.',
      suggestion: 'Please wait a moment before trying again.',
      technical: errorMessage
    };
  }

  // Generic Errors
  if (errorLower.includes('timeout')) {
    return {
      title: 'Request Timeout',
      message: 'The request took too long to complete.',
      suggestion: 'The network might be busy. Please try again in a moment.',
      technical: errorMessage
    };
  }

  // Default fallback
  return {
    title: 'Unexpected Error',
    message: `An unexpected error occurred${context?.action ? ` while ${context.action}` : ''}.`,
    suggestion: 'Please try again. If the problem persists, contact support with the technical details below.',
    technical: errorMessage
  };
}

/**
 * Format error for display in UI
 */
export function formatErrorForDisplay(error: UserFriendlyError, showTechnical = false): string {
  let message = `${error.message}\n\n${error.suggestion}`;

  if (showTechnical && error.technical) {
    message += `\n\nTechnical details: ${error.technical}`;
  }

  return message;
}

/**
 * Log error to console with context
 */
export function logError(error: unknown, context?: ErrorContext): void {
  console.error(`❌ Error${context?.action ? ` during ${context.action}` : ''}:`, {
    error,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
}