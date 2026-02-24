import OpenAI from 'openai';
import dotenv from 'dotenv';
import { CategoryCacheModel } from '../db/database.js';

dotenv.config();

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Rent',
  'Utilities',
  'Transport',
  'Travel',
  'Entertainment',
  'Shopping',
  'Health',
  'Fitness',
  'Subscriptions',
  'Other'
];

const CATEGORIZATION_PROMPT = `You are a financial expense categorization expert. Your job is to categorize expenses into one of these categories:

${EXPENSE_CATEGORIES.map((cat, i) => `${i + 1}. ${cat}`).join('\n')}

Rules:
- Choose exactly ONE category from the list above
- Base your decision on the description, amount, and context (group/notes)
- Be strict: if unsure, use "Other"
- Provide a confidence score (0.0 to 1.0)
- Explain your reasoning briefly (1 sentence)

CRITICAL: The following stores MUST ALWAYS be categorized as "Groceries":
- Meijer, Costco, Mariano's, Indian Store, Metro Market, Whole Foods, Trader Joe's, Jewel-Osco, Aldi, Instacart, Wee, Sam's Club, Safeway, Food Lion, Publix, Kroger
- Any supermarket, grocery store, or food market
- BUT NOT: Target (Shopping), Walmart (Shopping), CVS (Health), Walgreens (Health)

CRITICAL: Restaurant Detection - If unsure about a description:
- Check if it sounds like a restaurant name (e.g., "Alla Vita", "The Purple Pig", "RPM Steak")
- Italian, Mexican, Asian, American restaurant names → Food & Dining
- Bars, pubs, breweries → Food & Dining
- Coffee shops, cafes → Food & Dining

CRITICAL: Shopping Category - MUST include:
- Gift, gifts, present, birthday gift, wedding gift
- Clothes, clothing, apparel, dress, shirt, pants, shoes, jacket
- Brand names: Nike, Adidas, Zara, H&M, Gap, Old Navy, Macy's, Nordstrom, Amazon (unless clearly something else)
- Target, Walmart, Best Buy, Home Depot
- Any retail purchase

CRITICAL: Fitness Category - MUST include:
- Gym, gym membership, fitness, workout, yoga, pilates, CrossFit
- Planet Fitness, LA Fitness, Equinox, Orangetheory, SoulCycle
- Personal trainer, fitness class
- Sports equipment purchases (sometimes overlaps with Shopping, use context)

Examples:
- "Meijer" → Groceries (1.0) - Major grocery store chain
- "Costco" → Groceries (1.0) - Wholesale grocery store
- "Mariano's" → Groceries (1.0) - Grocery store chain
- "Indian store" → Groceries (1.0) - Grocery/food market
- "Metro Market" → Groceries (1.0) - Grocery store
- "Target" → Shopping (0.95) - General retail store
- "Walmart" → Shopping (0.95) - General retail store
- "Alla Vita" → Food & Dining (0.90) - Italian restaurant
- "The Purple Pig" → Food & Dining (0.90) - Restaurant
- "RPM Steak" → Food & Dining (0.95) - Steakhouse
- "Starbucks" → Food & Dining (0.95) - Coffee shop
- "Uber to airport" → Transport (0.95) - Ride-sharing service
- "Whole Foods" → Groceries (0.98) - Supermarket chain
- "Netflix subscription" → Subscriptions (1.0) - Monthly streaming service
- "Dinner at Olive Garden" → Food & Dining (0.95) - Restaurant meal
- "Gas bill" → Utilities (0.95) - Monthly utility payment
- "Flight to NYC" → Travel (0.98) - Air transportation
- "Aspirin" → Health (0.85) - Medical/pharmaceutical purchase
- "Rent payment" → Rent (1.0) - Monthly housing cost

You must respond with ONLY valid JSON in this exact format:
{
  "category": "one of the predefined categories",
  "confidence": 0.95,
  "reason": "brief explanation"
}`;

export class CategorizationService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in environment variables');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate a cache key for an expense
   */
  getCacheKey(description, amount, groupName) {
    const normalized = description.toLowerCase().trim();
    const amountBucket = Math.floor(amount / 10) * 10;
    return `${normalized}_${amountBucket}_${groupName || 'none'}`;
  }

  /**
   * Categorize a single expense using AI
   */
  async categorizeExpense(expense) {
    // Check cache first
    const cacheKey = this.getCacheKey(
      expense.description, 
      expense.amount, 
      expense.group_name
    );
    
    const cached = CategoryCacheModel.get(cacheKey);
    if (cached) {
      CategoryCacheModel.incrementHitCount(cacheKey);
      return {
        category: cached.ai_category,
        confidence: cached.ai_confidence,
        reason: cached.ai_reason || 'From cache',
        fromCache: true
      };
    }

    const context = {
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      group: expense.group_name || 'none',
      notes: expense.notes || 'none'
    };

    const userMessage = `Categorize this expense:
Description: ${context.description}
Amount: ${context.amount} ${context.currency}
Group: ${context.group}
Notes: ${context.notes}

Return only valid JSON.`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: CATEGORIZATION_PROMPT
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0].message.content;
      const result = JSON.parse(responseText);

      // Validate category
      if (!EXPENSE_CATEGORIES.includes(result.category)) {
        console.warn(`Invalid category "${result.category}" returned, defaulting to Other`);
        result.category = 'Other';
        result.confidence = 0.5;
        result.reason = 'Invalid category returned by AI';
      }

      // Cache the result
      CategoryCacheModel.insert(cacheKey, result.category, result.confidence, result.reason);

      return {
        ...result,
        fromCache: false
      };
    } catch (error) {
      console.error('Error categorizing expense:', error.message);
      return {
        category: 'Other',
        confidence: 0.0,
        reason: `Error: ${error.message}`,
        fromCache: false
      };
    }
  }

  /**
   * Batch categorize multiple expenses
   */
  async categorizeExpenses(expenses, onProgress = null) {
    const results = [];
    let cacheHits = 0;
    let apiCalls = 0;

    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];
      const result = await this.categorizeExpense(expense);
      
      if (result.fromCache) {
        cacheHits++;
      } else {
        apiCalls++;
      }

      results.push({
        expenseId: expense.id,
        ...result
      });

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: expenses.length,
          cacheHits,
          apiCalls
        });
      }

      // Rate limiting: wait 100ms between API calls
      if (!result.fromCache && i < expenses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      results,
      stats: {
        total: expenses.length,
        cacheHits,
        apiCalls,
        cacheHitRate: cacheHits / expenses.length
      }
    };
  }
}

export default CategorizationService;