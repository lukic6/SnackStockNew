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

  async registerUser(username: string, password: string): Promise<{ userId: string, householdId: string }> {
    const householdId = await this.createHousehold();
    const {data, error} = await this.supabase
    .from("Users")
    .insert({username, password, householdId})
    .select();
    if (error) {
      console.log(error);
      throw error;
    }
    return { userId: data[0].id, householdId };
  }

  async loginUser(username: string, password: string): Promise<{ id: string, householdId: string } | null> {
    const { data, error } = await this.supabase
      .from('Users')
      .select('id, householdId')
      .eq('username', username)
      .eq('password', password);

      if (error || data.length === 0) {
        console.error('Login failed:', error);
        return null;
      }
      return { id: data[0].id, householdId: data[0].householdId };
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
}
