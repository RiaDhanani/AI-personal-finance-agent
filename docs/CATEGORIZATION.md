# AI Categorization System Prompt

This document explains the system prompt used by the AI to categorize expenses.

## System Prompt

```
You are a financial expense categorization expert. Your job is to categorize expenses into one of these categories:

1. Food & Dining
2. Groceries
3. Rent
4. Utilities
5. Transport
6. Travel
7. Entertainment
8. Shopping
9. Health
10. Subscriptions
11. Other

Rules:
- Choose exactly ONE category from the list above
- Base your decision on the description, amount, and context (group/notes)
- Be strict: if unsure, use "Other"
- Provide a confidence score (0.0 to 1.0)
- Explain your reasoning briefly (1 sentence)

Examples:
- "Uber to airport" → Transport (0.95) - Ride-sharing service
- "Whole Foods" → Groceries (0.98) - Supermarket chain
- "Netflix subscription" → Subscriptions (1.0) - Monthly streaming service
- "Dinner at Olive Garden" → Food & Dining (0.95) - Restaurant meal
- "Gas bill" → Utilities (0.95) - Monthly utility payment
- "Flight to NYC" → Travel (0.98) - Air transportation
- "Aspirin" → Health (0.85) - Medical/pharmaceutical purchase
- "Rent payment" → Rent (1.0) - Monthly housing cost

Return your response as JSON in this exact format:
{
  "category": "one of the predefined categories",
  "confidence": 0.95,
  "reason": "brief explanation"
}
```

## Design Decisions

### Why These Categories?

The 11 categories cover the most common personal expense types while remaining:
- **Mutually exclusive**: Each expense clearly belongs to one category
- **Comprehensive**: "Other" catches edge cases
- **Actionable**: Users can make budgeting decisions based on these groupings

### Category Definitions

1. **Food & Dining**: Restaurants, takeout, coffee shops, bars
2. **Groceries**: Supermarkets, food delivery, meal kits
3. **Rent**: Monthly housing payments, lease fees
4. **Utilities**: Electricity, gas, water, internet, phone
5. **Transport**: Uber, Lyft, gas, parking, public transit
6. **Travel**: Flights, hotels, vacation expenses
7. **Entertainment**: Movies, concerts, streaming (non-subscription), games
8. **Shopping**: Retail purchases, clothing, electronics, furniture
9. **Health**: Medical, dental, pharmacy, insurance, fitness
10. **Subscriptions**: Netflix, Spotify, gym memberships, software
11. **Other**: Anything that doesn't fit above

### Confidence Scoring

The AI provides confidence scores to help identify:
- **High confidence (0.9-1.0)**: Clear, unambiguous categorization
- **Medium confidence (0.7-0.89)**: Reasonable categorization with some ambiguity
- **Low confidence (0.5-0.69)**: Uncertain, user should review
- **Very low (<0.5)**: Defaults to "Other"

### Context Usage

The AI considers multiple signals:

1. **Description**: Primary signal (e.g., "Whole Foods" → Groceries)
2. **Amount**: Helps disambiguate (e.g., $1200 likely rent, not shopping)
3. **Group**: Provides context (e.g., "Vegas Trip" group → Travel)
4. **Notes**: Additional details for edge cases

### Caching Strategy

The system caches results based on:
- Normalized description (lowercased, trimmed)
- Amount bucket (rounded to nearest $10)
- Group name

This means:
- "Uber to airport" at $25 and $28 → same cache entry
- "Uber to airport" at $25 and $125 → different entries (long vs short trip)

### Handling Edge Cases

**Ambiguous expenses:**
- "Amazon" → Could be Shopping, Groceries, Entertainment
- AI uses amount and notes to decide
- Defaults to Shopping if still unclear

**Split categories:**
- "Target" → Often groceries + shopping
- Categorize based on primary purpose or amount
- User can manually adjust if needed

**Recurring vs one-time:**
- System doesn't distinguish
- "Spotify" → Subscriptions regardless of frequency
- Monthly gym payment → Subscriptions (not Health)

## Improving Categorization Accuracy

### User Feedback Loop

To improve accuracy:
1. Export expenses to Excel
2. Review categorizations
3. Note patterns in errors
4. Adjust prompts or add examples

### Custom Categories

To add new categories:

1. Edit `EXPENSE_CATEGORIES` in `src/services/categorization.js`
2. Update the system prompt with the new category
3. Add examples for the new category
4. Clear cache if needed: delete `category_cache` table

### Fine-Tuning

For better results:
- Add domain-specific examples (your common merchants)
- Include edge cases you encounter
- Adjust confidence thresholds
- Use more specific category names

## Example Categorizations

### High Confidence

```json
{
  "description": "Netflix subscription",
  "amount": 15.99,
  "category": "Subscriptions",
  "confidence": 1.0,
  "reason": "Monthly streaming service"
}
```

### Medium Confidence

```json
{
  "description": "Target purchase",
  "amount": 45.67,
  "category": "Groceries",
  "confidence": 0.75,
  "reason": "Likely groceries based on amount"
}
```

### Low Confidence (edge case)

```json
{
  "description": "Annual membership",
  "amount": 299.00,
  "category": "Other",
  "confidence": 0.5,
  "reason": "Unclear what membership is for"
}
```

## Testing Categorization

To test the categorization logic:

```bash
node -e "
import { CategorizationService } from './src/services/categorization.js';

const service = new CategorizationService();
const result = await service.categorizeExpense({
  description: 'Whole Foods',
  amount: 87.43,
  currency: 'USD',
  group_name: null,
  notes: null
});

console.log(JSON.stringify(result, null, 2));
"
```

## Performance Metrics

Track these metrics to evaluate categorization quality:

- **Cache hit rate**: Higher is better (lower API costs)
- **Average confidence**: Should be >0.85 for good categorization
- **Manual corrections**: Track how often you override the AI

Monitor in the categorization summary:
```
📊 Categorization Summary:
   - Total processed: 150
   - Cache hits: 95 (63.3%)
   - API calls: 55
```