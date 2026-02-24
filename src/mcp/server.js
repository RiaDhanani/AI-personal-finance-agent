import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { AggregationService } from '../services/aggregation.js';
import { EXPENSE_CATEGORIES } from '../services/categorization.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = 'C:\\Users\\admin\\Desktop\\mcp-debug.log';

function log(message) {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
  } catch (err) {
    // Silently fail if we can't write logs
  }
}

log('=== MCP Server Starting ===');

try {
  log('Creating AggregationService...');
  const aggregationService = new AggregationService();
  log('AggregationService created successfully');

  log('Creating MCP Server...');
  const server = new Server(
    {
      name: 'finance-agent',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  log('MCP Server created successfully');

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log('ListTools request received');
    return {
      tools: [
        {
          name: 'get_monthly_summary',
          description: 'Get spending summary for a specific month',
          inputSchema: {
            type: 'object',
            properties: {
              month: {
                type: 'string',
                description: 'Month in YYYY-MM format (e.g., "2026-01")',
              },
            },
            required: ['month'],
          },
        },
        {
          name: 'list_available_months',
          description: 'Get list of all months with expense data',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_expense_categories',
          description: 'Get list of all available expense categories',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'compare_months',
          description: 'Compare spending between two months',
          inputSchema: {
            type: 'object',
            properties: {
              month1: {
                type: 'string',
                description: 'First month in YYYY-MM format',
              },
              month2: {
                type: 'string',
                description: 'Second month in YYYY-MM format',
              },
            },
            required: ['month1', 'month2'],
          },
        },
        {
          name: 'get_ytd_summary',
          description: 'Get year-to-date spending summary',
          inputSchema: {
            type: 'object',
            properties: {
              year: {
                type: 'integer',
                description: 'Year (e.g., 2026)',
              },
            },
            required: ['year'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    log(`CallTool request: ${name} with args: ${JSON.stringify(args)}`);

    try {
      let result;

      switch (name) {
        case 'get_monthly_summary':
          result = aggregationService.getMonthlySummary(args.month);
          break;

        case 'list_available_months':
          result = { months: aggregationService.getAvailableMonths() };
          break;

        case 'get_expense_categories':
          result = { categories: EXPENSE_CATEGORIES };
          break;

        case 'compare_months':
          result = aggregationService.compareMonths(args.month1, args.month2);
          break;

        case 'get_ytd_summary':
          result = aggregationService.getYearToDateSummary(args.year);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      log(`Tool ${name} executed successfully`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      log(`Error executing tool ${name}: ${error.message}`);
      throw error;
    }
  });

  async function main() {
    log('Starting main() function...');
    try {
      log('Creating StdioServerTransport...');
      const transport = new StdioServerTransport();
      
      log('Connecting server to transport...');
      await server.connect(transport);
      
      log('MCP Server connected and ready!');
    } catch (error) {
      log(`Error in main(): ${error.message}`);
      log(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  main().catch((error) => {
    log(`Fatal error: ${error.message}`);
    log(`Stack trace: ${error.stack}`);
    process.exit(1);
  });

} catch (error) {
  log(`Error during initialization: ${error.message}`);
  log(`Stack trace: ${error.stack}`);
  process.exit(1);
}