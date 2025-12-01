# Save Button Feature Requirements

## Core Requirements

1. **Save Button Visibility**
   - Show "💾 Save" button on Navigator messages that contain executed code
   - Button appears next to the timestamp on the message
   - Only show when there is actual executed code to save (not dummy/test code)

2. **Code Extraction**
   - Extract the actual JavaScript code that was executed
   - Code is embedded in success messages via `<nano_executed_code>...</nano_executed_code>` tags
   - Extract code before message is displayed
   - Store code with correct message index

3. **Save Functionality**
   - Clicking save button prompts user for favorite name
   - Shows the code that will be saved before asking for name
   - Saves code with:
     - Name (user-provided)
     - Code (the actual executed JavaScript)
     - URL pattern (current page domain/URL)
   - Shows confirmation message when saved

4. **Favorites Panel**
   - Display saved favorites at top of message list
   - Only show favorites that match current page URL
   - Each favorite shows:
     - Name
     - URL pattern
     - Use count
   - Expandable to view full code
   - Execute button (▶️) to run code directly
   - Delete button (🗑️) to remove favorite

5. **Execute Favorite**
   - Clicking play button executes the saved code immediately
   - No AI involvement - direct code execution
   - Increments use count
   - Shows execution result in chat

## Technical Requirements

- Button only appears on Navigator messages with actual executed code
- Code must be extracted from message content before display
- Code must be stored in state (not ref) to trigger React re-renders
- Execute button must prevent navigation/scrolling
- Code must be visible in favorites list when expanded


