/* eslint-disable @typescript-eslint/no-unused-vars */
import { BasePrompt } from './base';
import { type HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AgentContext } from '@src/background/agent/types';
import { createLogger } from '@src/background/log';
import { navigatorSystemPromptTemplate } from './templates/navigator';
import type { GeneralSettingsConfig } from '@extension/storage';

const logger = createLogger('agent/prompts/navigator');

export class NavigatorPrompt extends BasePrompt {
  private systemMessage: SystemMessage;

  constructor(
    private readonly maxActionsPerStep = 10,
    private readonly generalSettings?: GeneralSettingsConfig,
  ) {
    super();

    let promptTemplate = navigatorSystemPromptTemplate;
    // Format the template with the maxActionsPerStep
    let formattedPrompt = promptTemplate.replace('{{max_actions}}', this.maxActionsPerStep.toString()).trim();

    // Add code execution section if enabled
    if (this.generalSettings?.allowCodeGeneration) {
      const codeExecutionSection = `

13. Code Execution (CRITICAL - USE THIS FOR PAGE MANIPULATION):

- ***WHEN USER ASKS TO CHANGE/MODIFY THE PAGE (background, colors, styles, hide/show elements, etc.), YOU MUST USE execute_code ACTION IMMEDIATELY***
- DO NOT provide code examples, instructions, or explanations - EXECUTE THE CODE DIRECTLY using execute_code action
- The execute_code action runs JavaScript in the page context and can manipulate the DOM directly
- Example for "make background blue": {"execute_code": {"intent": "Change page background to blue", "code": "() => { document.body.style.backgroundColor = 'blue'; return {success: true, output: 'Background changed to blue'}; }"}}
- Example for "hide element": {"execute_code": {"intent": "Hide element", "code": "() => { document.querySelector('#element').style.display = 'none'; return {success: true}; }"}}
- The code you provide should be a function that returns an object with {success: boolean, output?: string, error?: string}
- For page manipulation tasks (change colors, modify styles, hide/show elements, etc.), ALWAYS use execute_code - never explain or show code examples
- The code runs in the page context and has full access to the DOM and page JavaScript
- If user asks to modify the page appearance or behavior, use execute_code immediately`;
      formattedPrompt += codeExecutionSection;
    }

    this.systemMessage = new SystemMessage(formattedPrompt);
  }

  getSystemMessage(): SystemMessage {
    /**
     * Get the system prompt for the agent.
     *
     * @returns SystemMessage containing the formatted system prompt
     */
    return this.systemMessage;
  }

  async getUserMessage(context: AgentContext): Promise<HumanMessage> {
    return await this.buildBrowserStateUserMessage(context);
  }
}
