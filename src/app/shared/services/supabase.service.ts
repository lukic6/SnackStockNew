import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from '../../../supabase-creds';
import { StockItem } from '../../../app-interfaces';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  constructor() { 
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /// AUTH region 
  private async createHousehold(): Promise<string> {
    const { data, error } = await this.supabase
      .from('Households')
      .insert({ member: 1 })
      .select();

    if (error) {
      console.error('Error creating household:', error.message);
      throw error;
    }

    return data[0].id;
  }

  async registerUser(username: string, password: string): Promise<{ userId: string, username: string, householdId: string }> {
    const householdId = await this.createHousehold();
    const {data, error} = await this.supabase
    .from("Users")
    .insert({username, password, householdId})
    .select();
    if (error) {
      console.log(error);
      throw error;
    }
    return { userId: data[0].id, username: data[0].username, householdId };
  }

  async loginUser(username: string, password: string): Promise<{ id: string, username: string, householdId: string } | null> {
    const { data, error } = await this.supabase
      .from('Users')
      .select('id, username, householdId')
      .eq('username', username)
      .eq('password', password);

      if (error || data.length === 0) {
        console.error('Login failed:', error);
        return null;
      }
      return { id: data[0].id, username: data[0].username, householdId: data[0].householdId };
  }

  async getUserById(userId: string): Promise<{ username: string } | null> {
    const { data, error } = await this.supabase
      .from('Users')
      .select('username')
      .eq('id', userId);

    if (error || data.length === 0) {
      console.error('Error fetching user by ID:', error);
      return null;
    }

    return data[0];
  }
  /// AUTH endregion
  /// STOCK region
  async getStockItems(householdId: string | null): Promise<StockItem[]> {
    const { data, error } = await this.supabase
      .from('Stocks')
      .select('*')
      .eq('householdId', householdId);

    if (error) {
      console.error('Error fetching stock items:', error.message);
      throw error;
    }

    return data as StockItem[];
  }

  async addStockItem(stockItem: StockItem, householdId: string | null): Promise<StockItem> {
    const { data, error } = await this.supabase
      .from('Stocks')
      .insert({
        householdId,
        item: stockItem.item,
        quantity: stockItem.quantity,
        measurement: stockItem.measurement
      })
      .select();

    if (error) {
      console.error('Error adding stock item:', error.message);
      throw error;
    }

    return data[0] as StockItem;
  }

  async modifyStockItem(stockItem: StockItem, householdId: string | null): Promise<void> {
    const { error } = await this.supabase
      .from('Stocks')
      .update({
        item: stockItem.item,
        quantity: stockItem.quantity,
        measurement: stockItem.measurement
      })
      .eq('id', stockItem.id)
      .eq('householdId', householdId);

    if (error) {
      console.error('Error modifying stock item:', error.message);
      throw error;
    }
  }

  async deleteStockItem(itemId: string, householdId: string | null): Promise<void> {
    const { error } = await this.supabase
      .from('Stocks')
      .delete()
      .eq('id', itemId)
      .eq('householdId', householdId);

    if (error) {
      console.error('Error deleting stock item:', error.message);
      throw error;
    }
  }
  /// STOCK endregion
  /// OPTIONS region
  async updateUsername(newUsername: string): Promise<void> {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      throw new Error('User is not authenticated');
    }

    const { error } = await this.supabase
      .from('Users')  // Assuming your table is named 'users'
      .update({ username: newUsername })
      .eq('id', userId);

    if (error) {
      console.error('Error updating username:', error.message);
      throw new Error('Failed to update username');
    }

    // Optionally update the localStorage with the new username
    localStorage.setItem('username', newUsername);
  }

  async verifyHousehold(householdId: string | null, newHouseholdId: string): Promise<boolean> {
    // Verify if the new household ID exists
    const { data: householdData, error: householdError } = await this.supabase
      .from('Households')
      .select('id')
      .eq('id', newHouseholdId)
      .single();
  
    if (householdError || !householdData) {
      console.error('Error verifying household:', householdError?.message);
      return false;
    }
  
    // The household exists, now proceed to update all relevant tables
    try {
      const userId = localStorage.getItem('userId');
  
      // Update user's household ID in the Users table
      const { error: userError } = await this.supabase
        .from('users')
        .update({ household_id: newHouseholdId })
        .eq('id', userId);
  
      if (userError) {
        console.error('Error updating household ID in users:', userError.message);
        throw new Error('Failed to update household ID for the user.');
      }
  
      // Update household ID in the Stocks table
      const { error: stockError } = await this.supabase
        .from('Stocks')
        .update({ household_id: newHouseholdId })
        .eq('household_id', householdId);
  
      if (stockError) {
        console.error('Error updating household ID in stocks:', stockError.message);
        throw new Error('Failed to update household ID for stocks.');
      }
  
      // Update household ID in the ShoppingLists table
      const { error: shoppingListError } = await this.supabase
        .from('ShoppingLists')
        .update({ household_id: newHouseholdId })
        .eq('household_id', householdId);
  
      if (shoppingListError) {
        console.error('Error updating household ID in shopping lists:', shoppingListError.message);
        throw new Error('Failed to update household ID for shopping lists.');
      }
  
      // Update household ID in the Meals table
      const { error: mealsError } = await this.supabase
        .from('Meals')
        .update({ household_id: newHouseholdId })
        .eq('household_id', householdId);
  
      if (mealsError) {
        console.error('Error updating household ID in meals:', mealsError.message);
        throw new Error('Failed to update household ID for meals.');
      }
  
      // If all updates succeeded, return true
      return true;
    } catch (error) {
      console.error('Error updating household ID across tables:', error);
      return false;
    }
  }
  

  /// OPTIONS endregion
}
