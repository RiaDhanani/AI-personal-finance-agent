import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SPLITWISE_API_BASE = 'https://secure.splitwise.com/api/v3.0';

export class SplitwiseClient {
  constructor() {
    if (!process.env.SPLITWISE_API_KEY) {
      throw new Error('SPLITWISE_API_KEY not found in environment variables');
    }

    this.apiKey = process.env.SPLITWISE_API_KEY;
    this.client = axios.create({
      baseURL: SPLITWISE_API_BASE,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Fetch all expenses from Splitwise
   * @param {Object} options
   * @param {string} options.dated_after
   * @param {string} options.dated_before
   * @param {number} options.limit
   */
  async fetchExpenses(options = {}) {
    try {
      const params = {
        limit: options.limit || 0,
        offset: 0
      };

      if (options.dated_after) {
        params.dated_after = options.dated_after;
      }
      if (options.dated_before) {
        params.dated_before = options.dated_before;
      }

      const response = await this.client.get('/get_expenses', { params });
      return response.data.expenses || [];
    } catch (error) {
      if (error.response) {
        throw new Error(`Splitwise API error: ${error.response.status} - ${error.response.data?.error || error.message}`);
      }
      throw new Error(`Error fetching Splitwise expenses: ${error.message}`);
    }
  }

  async getCurrentUser() {
    try {
      const response = await this.client.get('/get_current_user');
      return response.data.user;
    } catch (error) {
      if (error.response) {
        throw new Error(`Splitwise API error: ${error.response.status} - ${error.response.data?.error || error.message}`);
      }
      throw new Error(`Error fetching current user: ${error.message}`);
    }
  }

  normalizeExpense(swExpense, currentUserId) {
    // Find user's share in the expense
    const userShare = swExpense.users?.find(u => u.user_id === currentUserId);
    const userOwedShare = userShare ? Math.abs(parseFloat(userShare.owed_share)) : 0;

    if (userOwedShare <= 0) {
      return null;
    }

    // Ensure date is in YYYY-MM-DD format
    let normalizedDate = swExpense.date;
    if (normalizedDate.includes('T')) {
      normalizedDate = normalizedDate.split('T')[0];
    }

    return {
      id: `sw_${swExpense.id}`,
      date: swExpense.date,
      description: swExpense.description || 'Unknown expense',
      amount: userOwedShare,
      currency: swExpense.currency_code || 'USD',
      group_name: swExpense.group_id ? 
        (swExpense.friendship_id ? 'Friend' : swExpense.group_id.toString()) : 
        null,
      notes: swExpense.details || null,
      raw_category: swExpense.category?.name || null,
      splitwise_data: {
        original_amount: parseFloat(swExpense.cost),
        created_by: swExpense.created_by?.first_name,
        payment: swExpense.payment,
        deleted: swExpense.deleted_at !== null
      }
    };
  }

  async fetchAndNormalizeExpenses(options = {}) {
    const currentUser = await this.getCurrentUser();
    const expenses = await this.fetchExpenses(options);
    
    return expenses
      .filter(exp => !exp.payment && !exp.deleted_at)
      .map(exp => this.normalizeExpense(exp, currentUser.id))
      .filter(exp => exp !== null);
  }
}

export default SplitwiseClient;