import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from '../../../supabase-creds';
import { StockItem, ShoppingListItem } from '../../../app-interfaces';
import { SPOONACULAR_API_KEY } from '../../../api-creds';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  constructor(private http: HttpClient) { 
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
  async addMeal(meal: { householdId: string; mealName: string; servings: number; instructions: string }): Promise<{ id: string }> {
    const { data, error } = await this.supabase
    .from('Meals')
    .insert(meal)
    .select();

    if (error) {
      console.error('Error adding meal:', error.message);
      throw error;
    }

    return data[0];
  }

  async addMealItems(mealItems: { mealId: string; item: string; quantity: number; unit: string }[]): Promise<void> {
    const { error } = await this.supabase
      .from('MealItems')
      .insert(mealItems);
  
    if (error) {
      console.error('Error adding meal item:', error.message);
      throw error;
    }
  }

  async addShoppingListItems(item: ShoppingListItem): Promise<void> {
    const { error } = await this.supabase
    .from('ShoppingListItems')
    .insert({
      shoppingListId: item.shoppingListId,
      item: item.item,
      quantity: item.quantity,
      unit: item.unit,
    });

    if (error) {
      console.error('Error adding shopping list item:', error.message);
      throw error;
    }
  }

  async archiveShoppingList(shoppingListId: string): Promise<void> {
    try {
      // Step 1: Fetch all items from the ShoppingListItems for the current shopping list
      const { data: shoppingItems, error: fetchError } = await this.supabase
        .from('ShoppingListItems')
        .select('*')
        .eq('shoppingListId', shoppingListId);
  
      if (fetchError) {
        console.error('Error fetching shopping list items:', fetchError.message);
        throw fetchError;
      }
  
      if (!shoppingItems || shoppingItems.length === 0) {
        console.warn('No items found in shopping list');
        return;
      }
  
      // Step 2: Fetch householdId from the associated ShoppingList
      const { data: shoppingList, error: listError } = await this.supabase
        .from('ShoppingLists')
        .select('householdId')
        .eq('id', shoppingListId)
        .single();
  
      if (listError || !shoppingList) {
        console.error('Error fetching shopping list:', listError?.message || 'No shopping list found');
        throw listError || new Error('No shopping list found');
      }
  
      const householdId = shoppingList.householdId;
  
      // Step 2a: Fetch stockId from the Stocks table for the household
      const { data: stocksData, error: stocksError } = await this.supabase
        .from('Stocks')
        .select('id')
        .eq('householdId', householdId)
        .single();
  
      if (stocksError || !stocksData) {
        console.error('Error fetching Stocks record:', stocksError?.message || 'No Stocks record found');
        throw stocksError || new Error('No Stocks record found');
      }
  
      const stockId = stocksData.id;
  
      // Step 3: For each shopping item, add it to the StockItems of the household
      for (const item of shoppingItems) {
        // Check if the item already exists in StockItems for the household
        const { data: existingStockItem, error: stockFetchError } = await this.supabase
          .from('StockItems')
          .select('*')
          .eq('stockId', stockId)
          .eq('item', item.item)
          .maybeSingle(); // Use maybeSingle to allow for no results
  
        if (stockFetchError && stockFetchError.code !== 'PGRST116') {
          console.error('Error fetching stock item:', stockFetchError.message);
          throw stockFetchError;
        }
  
        if (existingStockItem) {
          // If item exists, update the quantity
          let totalQuantity = existingStockItem.quantity + item.quantity;
  
          // Handle unit conversion if necessary
          if (existingStockItem.unit !== item.unit) {
            // Attempt to convert units
            const convertedQuantity = await this.convertUnits(
              item.quantity,
              item.unit,
              existingStockItem.unit,
              item.item
            );
  
            // If conversion is successful, add to total quantity
            if (convertedQuantity !== item.quantity) {
              totalQuantity = existingStockItem.quantity + convertedQuantity;
            } else {
              console.warn(`Unit conversion failed for ${item.item}. Adding as a new stock item.`);
              // Decide how to handle this case. For now, we'll insert as a new stock item.
              const { error: insertError } = await this.supabase
                .from('StockItems')
                .insert({
                  stockId,
                  item: item.item,
                  quantity: item.quantity,
                  unit: item.unit,
                });
  
              if (insertError) {
                console.error('Error adding new stock item:', insertError.message);
                throw insertError;
              }
              continue; // Move to the next item
            }
          }
  
          // Update the existing stock item's quantity
          const { error: updateError } = await this.supabase
            .from('StockItems')
            .update({ quantity: totalQuantity })
            .eq('id', existingStockItem.id);
  
          if (updateError) {
            console.error('Error updating stock item:', updateError.message);
            throw updateError;
          }
        } else {
          // If item does not exist, insert it into StockItems
          const { error: insertError } = await this.supabase
            .from('StockItems')
            .insert({
              stockId,
              item: item.item,
              quantity: item.quantity,
              unit: item.unit,
            });
  
          if (insertError) {
            console.error('Error adding new stock item:', insertError.message);
            throw insertError;
          }
        }
      }
  
      // Step 4: Archive the shopping list by setting active to false
      const { error: archiveError } = await this.supabase
        .from('ShoppingLists')
        .update({ active: false })
        .eq('id', shoppingListId);
  
      if (archiveError) {
        console.error('Error archiving shopping list:', archiveError.message);
        throw archiveError;
      }
  
    } catch (error) {
      console.error('Error in archiveShoppingList:', error);
      throw error;
    }
  }
  
  
  async createShoppingList(householdId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('ShoppingLists')
      .insert({ householdId, active: true })
      .select('id')
      .single();
  
    if (error) {
      console.error('Error creating new shopping list:', error.message);
      throw error;
    }
  
    return data.id;
  }  
  /// RECIPES endregion
  /// SHOPPING-LIST region
  async getShoppingLists(householdId: string): Promise<{ activeItems: any[], inactiveLists: any[], activeShoppingListId: string }> {
    // Fetch active shopping list
    const { data: activeLists, error: activeListsError } = await this.supabase
      .from('ShoppingLists')
      .select('id')
      .eq('householdId', householdId)
      .eq('active', true);
  
    if (activeListsError) {
      console.error('Error fetching active shopping list IDs:', activeListsError);
      throw activeListsError;
    }
  
    let activeShoppingListId: string = '';
    let activeItems: any[] = [];
  
    if (activeLists && activeLists.length > 0) {
      activeShoppingListId = activeLists[0].id;
  
      // Fetch active shopping list items
      const { data: activeItemsData, error: activeItemsError } = await this.supabase
        .from('ShoppingListItems')
        .select('id, item, quantity, unit, shoppingListId')
        .eq('shoppingListId', activeShoppingListId);
  
      if (activeItemsError) {
        console.error('Error fetching active shopping items:', activeItemsError);
        throw activeItemsError;
      }
  
      activeItems = activeItemsData;
    }
  
    // Fetch inactive shopping lists and their items
    const { data: inactiveLists, error: inactiveListsError } = await this.supabase
      .from('ShoppingLists')
      .select('id, ShoppingListItems(id, item, quantity, unit)')
      .eq('householdId', householdId)
      .eq('active', false);
  
    if (inactiveListsError) {
      console.error('Error fetching inactive shopping lists:', inactiveListsError);
      throw inactiveListsError;
    }
  
    return { activeItems, inactiveLists, activeShoppingListId };
  }
  
  async getActiveShoppingListId(householdId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('ShoppingLists')
      .select('id')
      .eq('householdId', householdId)
      .eq('active', true)
      .single();
  
    if (error && error.code !== 'PGRST116') { // Ignore "No rows" error
      console.error('Error fetching active shopping list ID:', error.message);
      throw error;
    }
  
    return data ? data.id : null;
  }

  async addShoppingListItem(item: ShoppingListItem): Promise<void> {
    try {
      // Check if the item already exists in the active shopping list
      const { data: existingItem, error: fetchError } = await this.supabase
        .from('ShoppingListItems')
        .select('*')
        .eq('shoppingListId', item.shoppingListId)
        .eq('item', item.item)
        .single();
  
      if (fetchError && fetchError.code !== 'PGRST116') {
        // If it's not a "No record found" error, handle it
        console.error('Error fetching shopping list item:', fetchError.message);
        throw fetchError;
      }
  
      if (existingItem) {
        // If the item exists, update its quantity by adding the new quantity
        const updatedQuantity = existingItem.quantity + item.quantity;
        const { error: updateError } = await this.supabase
          .from('ShoppingListItems')
          .update({ quantity: updatedQuantity })
          .eq('id', existingItem.id);
  
        if (updateError) {
          console.error('Error updating shopping list item:', updateError.message);
          throw updateError;
        }
      } else {
        // If the item does not exist, insert a new item into the shopping list
        const { error: insertError } = await this.supabase
          .from('ShoppingListItems')
          .insert({
            shoppingListId: item.shoppingListId,
            item: item.item,
            quantity: item.quantity,
            unit: item.unit,
          });
  
        if (insertError) {
          console.error('Error adding shopping list item:', insertError.message);
          throw insertError;
        }
      }
    } catch (error) {
      console.error('Error in addShoppingListItem:', error);
      throw error;
    }
  }
  
  
  async modifyShoppingListItem(item: any): Promise<void> {
    const { error } = await this.supabase
      .from('ShoppingListItems')
      .update({
        item: item.item,
        quantity: item.quantity,
        unit: item.unit,
      })
      .eq('id', item.id);
  
    if (error) {
      console.error('Error updating shopping list item:', error.message);
      throw error;
    }
  }
  
  async deleteShoppingListItem(itemId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ShoppingListItems')
      .delete()
      .eq('id', itemId);
  
    if (error) {
      console.error('Error deleting shopping list item:', error.message);
      throw error;
    }
  }    
  /// SHOPPING-LIST endregion
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
  
  async getHouseholdMembers(householdId: string): Promise<{ username: string }[]> {
    const { data, error } = await this.supabase
      .from('Users')
      .select('username')
      .eq('householdId', householdId);
  
    if (error) {
      console.error('Error fetching household members:', error.message);
      throw error;
    }
  
    return data || [];
  }
  /// OPTIONS endregion
  /// SHARED FUNCTIONS
  async convertUnits(amount: number, fromUnit: string, toUnit: string, ingredientName: string): Promise<number> {
    const url = `https://api.spoonacular.com/recipes/convert?ingredientName=${encodeURIComponent(ingredientName)}&sourceAmount=${amount}&sourceUnit=${encodeURIComponent(fromUnit)}&targetUnit=${encodeURIComponent(toUnit)}&apiKey=${SPOONACULAR_API_KEY}`;
    if (!fromUnit || fromUnit.trim() === "") {
      console.warn(`Missing source unit for ${ingredientName}. Returning original amount.`);
      return amount; // No conversion is possible, return original amount
    } else if (!toUnit || toUnit.trim() === "")
        return amount; // No conversion is possible, return original amount
    try {
      const response : any = await this.http.get(url).toPromise();
      if (response && response.targetAmount) {
        return response.targetAmount;
      } else {
        console.warn(`Conversion failed for ${ingredientName}: from ${fromUnit} to ${toUnit}`, response);
        return amount; // Fallback to original amount
      }
    } catch (error) {
      console.error(`Error converting units for ${ingredientName} from ${fromUnit} to ${toUnit}:`, error);
      return amount; // Fallback to original amount
    }
  }
}
