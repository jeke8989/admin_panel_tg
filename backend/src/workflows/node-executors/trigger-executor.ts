import { Injectable, Logger } from '@nestjs/common';
import { NodeExecutor } from './node-executor.abstract';
import { WorkflowNode } from '../../entities/WorkflowNode.entity';

@Injectable()
export class TriggerExecutor extends NodeExecutor {
  private readonly logger = new Logger(TriggerExecutor.name);

  async execute(node: WorkflowNode, context: any): Promise<boolean> {
    const { type, config } = node;
    const { message, triggerType } = context;

    if (!type.startsWith('trigger')) return false;

    // Check specific trigger type from config or node.type (if we stored specific type there)
    // The plan says node types are: Command Trigger, Text Trigger, etc.
    // In our entity we have `type` column. We might store 'trigger-command' there.
    // Let's assume `type` is like 'trigger-command', 'trigger-text', etc.

    // Or `type` is 'trigger' and config has `triggerType`.
    // The plan says "Типы нод: TriggerNode.tsx ... types: command, text, button".
    // Let's assume node.type holds the specific type identifier.

    switch (node.type) {
        case 'trigger-command': {
            if (triggerType !== 'command') return false;
            let command = config.command?.toLowerCase();
            if (!command) return false;
            
            // Ensure command starts with /
            if (!command.startsWith('/')) {
                command = `/${command}`;
            }
            
            const text = message?.text?.toLowerCase();
            // Check if message text starts with the command (e.g. /start)
            // We also want to ensure it's a complete command (e.g. "/start" matches "/start", but "/starting" should not match "/start")
            // But startsWith is a simple first step. For strict command matching we might want to split by space.
            
            if (!text) return false;
            
            // Exact match or match followed by space
            const parts = text.split(' ');
            return parts[0] === command;
        }
            
        case 'trigger-text': {
            if (triggerType !== 'text') return false;
            const matchType = config.matchType || 'exact';
            const pattern = config.text?.toLowerCase();
            const msgText = message?.text?.toLowerCase();
            
            if (!msgText) return false;

            if (matchType === 'exact') return msgText === pattern;
            if (matchType === 'contains') return msgText.includes(pattern);
            if (matchType === 'regex') return new RegExp(pattern).test(msgText);
            return false;
        }
            
        case 'trigger-callback': {
            if (triggerType !== 'callback' && triggerType !== 'button') {
                this.logger.debug(`Trigger type mismatch: expected 'callback' or 'button', got '${triggerType}'`);
                return false;
            }
            
            // Получаем callback_data из разных возможных источников
            const callbackData = context.data || 
                                (context.callbackQuery && (context.callbackQuery as any).data) ||
                                (context.callbackQuery && (context.callbackQuery as any).callback_data);
            
            this.logger.debug(`Checking callback trigger: callbackData='${callbackData}', config=${JSON.stringify(config)}`);
            
            if (!callbackData) {
                this.logger.debug('No callback data found in context');
                return false;
            }
            
            const callbackMatchType = config.matchType || 'exact';
            const callbackPattern = config.callbackData || config.data;
            
            if (!callbackPattern) {
                // Если паттерн не указан, триггер срабатывает на любой callback
                this.logger.debug('No pattern specified, triggering on any callback');
                return true;
            }
            
            let matches = false;
            if (callbackMatchType === 'exact') {
                matches = callbackData === callbackPattern;
            } else if (callbackMatchType === 'contains') {
                matches = callbackData.includes(callbackPattern);
            } else if (callbackMatchType === 'regex') {
                try {
                    matches = new RegExp(callbackPattern).test(callbackData);
                } catch (e) {
                    this.logger.error("Invalid regex pattern:", e);
                    return false;
                }
            } else if (callbackMatchType === 'startsWith') {
                matches = callbackData.startsWith(callbackPattern);
            }
            
            this.logger.debug(`Callback match result: ${matches} (pattern: '${callbackPattern}', data: '${callbackData}', type: '${callbackMatchType}')`);
            return matches;
        }
            
        default:
            return false;
    }
  }
}

