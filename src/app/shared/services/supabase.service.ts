import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from '../../../supabase-creds';
import { StockItem, MealItem } from '../../../app-interfaces';

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

    const householdId = data[0].id;

    // Create a Stocks record for the new household
    const { error: stocksError } = await this.supabase
      .from('Stocks')
      .insert({ householdId });

    if (stocksError) {
      console.error('Error creating Stocks record:', stocksError.message);
      throw stocksError;
    }

    return householdId;
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
    const { data: stocksData, error: stocksError, status } = await this.supabase
      .from('Stocks')
      .select('id')
      .eq('householdId', householdId)
      .maybeSingle(); // Use maybeSingle to allow for no results
  
    if (stocksError && status !== 406) { // 406 Not Acceptable - no rows found
      console.error('Error fetching Stocks record:', stocksError?.message);
      throw stocksError;
    }
    if (!stocksData) {
      return [];
    }
    const stockId = stocksData.id;
    const { data: stockItemsData, error: stockItemsError } = await this.supabase
      .from('StockItems')
      .select('id, item, quantity, unit')
      .eq('stockId', stockId);
  
    if (stockItemsError) {
      console.error('Error fetching stock items:', stockItemsError.message);
      throw stockItemsError;
    }
  
    return stockItemsData as StockItem[];
  }  

  async addStockItem(stockItem: StockItem, householdId: string | null): Promise<StockItem> {
    let { data: stocksData, error: stocksError, status } = await this.supabase
    .from('Stocks')
    .select('id')
    .eq('householdId', householdId)
    .maybeSingle();

  if (stocksError && status !== 406) {
    console.error('Error fetching Stocks record:', stocksError?.message);
    throw stocksError;
  }

  if (!stocksData) {
    // No Stocks record exists, create one
    const { data: newStocksData, error: newStocksError } = await this.supabase
      .from('Stocks')
      .insert({ householdId })
      .select();

    if (newStocksError || !newStocksData) {
      console.error('Error creating Stocks record:', newStocksError?.message);
      throw newStocksError || new Error('Failed to create Stocks record.');
    }

    stocksData = newStocksData[0];
  }

  const stockId = stocksData?.id;

  // Now insert into StockItems
  const { data, error } = await this.supabase
    .from('StockItems')
    .insert({
      stockId,
      item: stockItem.item,
      quantity: stockItem.quantity,
      unit: stockItem.unit
    })
    .select();

  if (error) {
    console.error('Error adding stock item:', error.message);
    throw error;
  }

  return data[0] as StockItem;
}

  async modifyStockItem(stockItem: StockItem, householdId: string | null): Promise<void> {
    const { data: stocksData, error: stocksError, status } = await this.supabase
      .from('Stocks')
      .select('id')
      .eq('householdId', householdId)
      .maybeSingle();

    if (stocksError && status !== 406) {
      console.error('Error fetching Stocks record:', stocksError?.message);
      throw stocksError;
    }

    if (!stocksData) {
      throw new Error('Stocks record not found for this household.');
    }

    const stockId = stocksData.id;

    // Update the StockItem
    const { data, error } = await this.supabase
      .from('StockItems')
      .update({
        item: stockItem.item,
        quantity: stockItem.quantity,
        unit: stockItem.unit
      })
      .eq('id', stockItem.id)
      .eq('stockId', stockId); // Ensure it belongs to the correct stock

    if (error) {
      console.error('Error modifying stock item:', error.message);
      throw error;
    }
  }


  async deleteStockItem(itemId: string, householdId: string | null): Promise<void> {
    const { data: stocksData, error: stocksError, status } = await this.supabase
      .from('Stocks')
      .select('id')
      .eq('householdId', householdId)
      .maybeSingle();
  
    if (stocksError && status !== 406) {
      console.error('Error fetching Stocks record:', stocksError?.message);
      throw stocksError;
    }
  
    if (!stocksData) {
      throw new Error('Stocks record not found for this household.');
    }
  
    const stockId = stocksData.id;
  
    // Delete the StockItem
    const { data, error } = await this.supabase
      .from('StockItems')
      .delete()
      .eq('id', itemId)
      .eq('stockId', stockId); // Ensure it belongs to the correct stock
  
    if (error) {
      console.error('Error deleting stock item:', error.message);
      throw error;
    }
  }  
  /// STOCK endregion
  /// RECIPES region
  async addMeal(meal: any): Promise<any> {
    const { data, error } = await this.supabase
      .from('Meals')
      .insert([meal])
      .select();
  
    return { data, error };
  }

  async addMealItem(mealItem: MealItem): Promise<any> {
    const { data, error } = await this.supabase
      .from('MealItems')
      .insert([mealItem]);
  
    return { data, error };
  }

  async addShoppingListItem(shoppingItem: { householdId: string; item: string; quantity: number; unit: string; active: boolean }): Promise<void> {
    const { data, error } = await this.supabase
      .from('ShoppingLists')
      .insert([shoppingItem]);
  
      if (error) {
        console.error('Error adding item to shopping list:', error.message);
        throw error;
      }
  }
  /// RECIPES endregion
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
    const { data: newHouseholdData, error: newHouseholdError } = await this.supabase
      .from('Households')
      .select('id, member')
      .eq('id', newHouseholdId)
      .single();
  
    if (newHouseholdError || !newHouseholdData) {
      console.error('Error verifying new household:', newHouseholdError?.message);
      return false;
    }
  
    try {
      const userId = localStorage.getItem('userId');
  
      // Update user's household ID in the Users table
      const { error: userError } = await this.supabase
        .from('Users')
        .update({ householdId: newHouseholdId })
        .eq('id', userId);
  
      if (userError) {
        console.error('Error updating household ID in users:', userError.message);
        throw new Error('Failed to update household ID for the user.');
      }
  
      // Increment the member count of the new household
      const newHouseholdMemberCount = newHouseholdData.member + 1;
      const { error: incrementError } = await this.supabase
        .from('Households')
        .update({ member: newHouseholdMemberCount })
        .eq('id', newHouseholdId);
  
      if (incrementError) {
        console.error('Error incrementing member count in new household:', incrementError.message);
        throw new Error('Failed to update member count in new household.');
      }
  
      // Decrement the member count of the previous household
      if (householdId) {
        const { data: previousHouseholdData, error: previousHouseholdError } = await this.supabase
          .from('Households')
          .select('member')
          .eq('id', householdId)
          .single();
  
        if (previousHouseholdError) {
          console.error('Error retrieving previous household data:', previousHouseholdError.message);
          throw new Error('Failed to retrieve previous household data.');
        }
  
        const previousHouseholdMemberCount = previousHouseholdData.member - 1;
        const { error: decrementError } = await this.supabase
          .from('Households')
          .update({ member: previousHouseholdMemberCount })
          .eq('id', householdId);
  
        if (decrementError) {
          console.error('Error decrementing member count in previous household:', decrementError.message);
          throw new Error('Failed to update member count in previous household.');
        }
  
        if (previousHouseholdMemberCount === 0) {
          // Transfer data from old household to new household
  
          // **Transfer Stocks and StockItems**
          await this.transferStocks(householdId, newHouseholdId);
  
          // **Transfer ShoppingLists and ShoppingListItems**
          await this.transferShoppingLists(householdId, newHouseholdId);
  
          // **Transfer Meals and MealItems**
          await this.transferMeals(householdId, newHouseholdId);
  
          // **Delete the old household record if necessary**
          // (Optional) You can decide to delete the old household record since it has no members
        }
      }
  
      // If all updates succeeded, return true
      return true;
    } catch (error) {
      console.error('Error updating household ID across tables:', error);
      return false;
    }
  }
  
  private async transferStocks(oldHouseholdId: string, newHouseholdId: string): Promise<void> {
    // Fetch the Stocks record associated with the old household
    const { data: oldStockData, error: oldStockError } = await this.supabase
      .from('Stocks')
      .select('id')
      .eq('householdId', oldHouseholdId)
      .single();
  
    if (oldStockError || !oldStockData) {
      console.error('Error fetching old Stocks record:', oldStockError?.message);
      // Proceed even if no Stocks record exists
      return;
    }
  
    const oldStockId = oldStockData.id;
  
    // Check if the new household already has a Stocks record
    const { data: newStocksData, error: newStocksError } = await this.supabase
      .from('Stocks')
      .select('id')
      .eq('householdId', newHouseholdId)
      .maybeSingle();
  
    if (newStocksError && newStocksError.code !== 'PGRST116') {
      console.error('Error checking Stocks record for new household:', newStocksError.message);
      throw new Error('Failed to check Stocks record for new household.');
    }
  
    if (newStocksData) {
      // **New household already has a Stocks record**
      const newStockId = newStocksData.id;
  
      // **Transfer StockItems from old to new Stocks record**
      const { error: updateStockItemsError } = await this.supabase
        .from('StockItems')
        .update({ stockId: newStockId })
        .eq('stockId', oldStockId);
  
      if (updateStockItemsError) {
        console.error('Error transferring StockItems:', updateStockItemsError.message);
        throw new Error('Failed to transfer StockItems.');
      }
  
      // **Delete the old Stocks record**
      const { error: deleteOldStocksError } = await this.supabase
        .from('Stocks')
        .delete()
        .eq('id', oldStockId);
  
      if (deleteOldStocksError) {
        console.error('Error deleting old Stocks record:', deleteOldStocksError.message);
        throw new Error('Failed to delete old Stocks record.');
      }
    } else {
      // **New household does not have a Stocks record**
      // Update the householdId of the old Stocks record to the newHouseholdId
      const { error: updateStockError } = await this.supabase
        .from('Stocks')
        .update({ householdId: newHouseholdId })
        .eq('id', oldStockId);
  
      if (updateStockError) {
        console.error('Error updating Stocks record:', updateStockError.message);
        throw new Error('Failed to update Stocks record.');
      }
    }
  }

  private async transferShoppingLists(oldHouseholdId: string, newHouseholdId: string): Promise<void> {
    // Check if the new household already has ShoppingLists
    const { data: existingShoppingLists, error: shoppingListsError } = await this.supabase
      .from('ShoppingLists')
      .select('id')
      .eq('householdId', newHouseholdId);
  
    if (shoppingListsError) {
      console.error('Error checking ShoppingLists for new household:', shoppingListsError.message);
      throw new Error('Failed to check ShoppingLists for new household.');
    }
  
    if (existingShoppingLists && existingShoppingLists.length > 0) {
      // **Handle merging or decide not to transfer**
      // For simplicity, let's update the householdId of old ShoppingLists if there are no conflicts
      const { error: updateShoppingListsError } = await this.supabase
        .from('ShoppingLists')
        .update({ householdId: newHouseholdId })
        .eq('householdId', oldHouseholdId);
  
      if (updateShoppingListsError) {
        console.error('Error updating ShoppingLists:', updateShoppingListsError.message);
        throw new Error('Failed to update ShoppingLists.');
      }
    } else {
      // **No existing ShoppingLists in new household, safe to transfer**
      const { error: updateShoppingListsError } = await this.supabase
        .from('ShoppingLists')
        .update({ householdId: newHouseholdId })
        .eq('householdId', oldHouseholdId);
  
      if (updateShoppingListsError) {
        console.error('Error updating ShoppingLists:', updateShoppingListsError.message);
        throw new Error('Failed to update ShoppingLists.');
      }
    }
  }
  
  private async transferMeals(oldHouseholdId: string, newHouseholdId: string): Promise<void> {
    // Check if the new household already has Meals
    const { data: existingMeals, error: mealsError } = await this.supabase
      .from('Meals')
      .select('id')
      .eq('householdId', newHouseholdId);
  
    if (mealsError) {
      console.error('Error checking Meals for new household:', mealsError.message);
      throw new Error('Failed to check Meals for new household.');
    }
  
    if (existingMeals && existingMeals.length > 0) {
      // **Handle merging or decide not to transfer**
      // For simplicity, let's update the householdId of old Meals if there are no conflicts
      const { error: updateMealsError } = await this.supabase
        .from('Meals')
        .update({ householdId: newHouseholdId })
        .eq('householdId', oldHouseholdId);
  
      if (updateMealsError) {
        console.error('Error updating Meals:', updateMealsError.message);
        throw new Error('Failed to update Meals.');
      }
    } else {
      // **No existing Meals in new household, safe to transfer**
      const { error: updateMealsError } = await this.supabase
        .from('Meals')
        .update({ householdId: newHouseholdId })
        .eq('householdId', oldHouseholdId);
  
      if (updateMealsError) {
        console.error('Error updating Meals:', updateMealsError.message);
        throw new Error('Failed to update Meals.');
      }
    }
  }
  
  /// OPTIONS endregion
}
