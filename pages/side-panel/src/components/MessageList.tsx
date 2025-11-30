import type { Message } from '@extension/storage';
import { ACTOR_PROFILES } from '../types/message';
import { memo } from 'react';
import { Actors } from '@extension/storage';

interface MessageListProps {
  messages: Message[];
  isDarkMode?: boolean;
  executedCodeMap?: Map<number, string>;
  onSaveCode?: (messageIndex: number, code: string) => void;
}

export default memo(function MessageList({
  messages,
  isDarkMode = false,
  executedCodeMap,
  onSaveCode,
}: MessageListProps) {
  return (
    <div className="max-w-full space-y-4">
      {messages.map((message, index) => (
        <MessageBlock
          key={`${message.actor}-${message.timestamp}-${index}`}
          message={message}
          messageIndex={index}
          isSameActor={index > 0 ? messages[index - 1].actor === message.actor : false}
          isDarkMode={isDarkMode}
          executedCode={executedCodeMap?.get(index)}
          onSaveCode={onSaveCode}
        />
      ))}
    </div>
  );
});

interface MessageBlockProps {
  message: Message;
  messageIndex: number;
  isSameActor: boolean;
  isDarkMode?: boolean;
  executedCode?: string;
  onSaveCode?: (messageIndex: number, code: string) => void;
}

function MessageBlock({
  message,
  messageIndex,
  isSameActor,
  isDarkMode = false,
  executedCode,
  onSaveCode,
}: MessageBlockProps) {
  if (!message.actor) {
    console.error('No actor found');
    return <div />;
  }
  const actor = ACTOR_PROFILES[message.actor as keyof typeof ACTOR_PROFILES];
  const isProgress = message.content === 'Showing progress...';

  // Check if this is a Navigator message with executed code
  // Show button if we have extracted code OR if message contains code execution text (success or failure)
  const hasCodeExecutedText = message.content.includes('Code executed') || 
                             message.content.includes('Code execution failed') ||
                             message.content.includes('Error executing code');
  
  const hasExecutedCode = message.actor === Actors.NAVIGATOR && (executedCode || hasCodeExecutedText);
  
  // If we don't have extracted code but message has code execution text, try to extract from original content
  let codeToSave = executedCode;
  if (!codeToSave && hasCodeExecutedText) {
    // Try to extract code from the original message (before it was cleaned)
    const codeMatch = message.content.match(/<nano_executed_code>([\s\S]*?)<\/nano_executed_code>/);
    if (codeMatch) {
      codeToSave = codeMatch[1];
      console.log('[MessageBlock] ✅ Extracted code from message content:', codeToSave.substring(0, 100));
    }
  }
  
  // Debug: log Navigator messages with code execution
  if (message.actor === Actors.NAVIGATOR && hasCodeExecutedText) {
    console.log('[MessageBlock] Navigator message with code execution:', {
      messageIndex,
      hasExecutedCode: !!executedCode,
      hasCodeToSave: !!codeToSave,
      contentPreview: message.content.substring(0, 150),
      hasCodeTags: message.content.includes('<nano_executed_code>'),
    });
  }

  // Strip nano_executed_code tags from display
  const displayContent = message.content.replace(/<nano_executed_code>[\s\S]*?<\/nano_executed_code>/g, '');

  const handleSaveClick = () => {
    if (codeToSave && onSaveCode) {
      onSaveCode(messageIndex, codeToSave);
    } else if (executedCode && onSaveCode) {
      onSaveCode(messageIndex, executedCode);
    } else {
      // If no code found, show alert and try to prompt user
      alert('No code found in this message. The Navigator may not have used execute_code action. Try asking explicitly: "use execute_code to..."');
    }
  };

  return (
    <div
      className={`flex max-w-full gap-3 ${
        !isSameActor
          ? `mt-4 border-t ${isDarkMode ? 'border-sky-800/50' : 'border-sky-200/50'} pt-4 first:mt-0 first:border-t-0 first:pt-0`
          : ''
      }`}>
      {!isSameActor && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: actor.iconBackground }}>
          <img src={actor.icon} alt={actor.name} className="size-6" />
        </div>
      )}
      {isSameActor && <div className="w-8" />}

      <div className="min-w-0 flex-1">
        {!isSameActor && (
          <div className={`mb-1 text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
            {actor.name}
          </div>
        )}

        <div className="space-y-0.5">
          <div className={`whitespace-pre-wrap break-words text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {isProgress ? (
              <div className={`h-1 overflow-hidden rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div className="h-full animate-progress bg-blue-500" />
              </div>
            ) : (
              displayContent
            )}
          </div>
          {!isProgress && (
            <div className="flex items-center justify-end gap-2">
              {hasExecutedCode && onSaveCode && (
                <button
                  type="button"
                  onClick={handleSaveClick}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                  title={codeToSave || executedCode ? "Save code as favorite" : "No code found - Navigator may not have used execute_code action"}>
                  💾 Save
                </button>
              )}
              <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-300'}`}>
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Formats a timestamp (in milliseconds) to a readable time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Check if the message is from today
  const isToday = date.toDateString() === now.toDateString();

  // Check if the message is from yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // Check if the message is from this year
  const isThisYear = date.getFullYear() === now.getFullYear();

  // Format the time (HH:MM)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr; // Just show the time for today's messages
  }

  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  if (isThisYear) {
    // Show month and day for this year
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  }

  // Show full date for older messages
  return `${date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}, ${timeStr}`;
}
