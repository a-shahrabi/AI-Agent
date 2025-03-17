import type { AIMessage } from './types';
import { runLLM } from './llm';
import { z } from 'zod';
import { runTool } from './toolRunner';
import { addMessages, getMessages, saveToolResponse } from './memory';
import { logMessage, showLoader } from './ui';

interface AgentConfig {
  turns?: number;
  userMessage: string;
  tools?: { name: string; parameters: z.AnyZodObject }[];
}

export const runAgent = async ({ turns = 100, userMessage, tools = [] }: AgentConfig) => {
  try {
    await addMessages([{ role: 'user', content: userMessage }]);

    const loader = showLoader('Thinking...');

    for (let i = 0; i < turns; i++) {
      const history = await getMessages();
      const response = await runLLM({ messages: history, tools });

      await addMessages([response]);
      logMessage(response);

      if (response.content) {
        loader.stop();
        return getMessages();
      }

      if (response.tool_calls?.length) {
        for (const toolCall of response.tool_calls) {
          loader.update(`Executing: ${toolCall.function.name}`);
          const toolResponse = await runTool(toolCall, userMessage);
          await saveToolResponse(toolCall.id, toolResponse);
          loader.update(`Executed: ${toolCall.function.name}`);
        }
      }
    }
  } catch (error) {
    console.error('Error running agent:', error);
  }
};
