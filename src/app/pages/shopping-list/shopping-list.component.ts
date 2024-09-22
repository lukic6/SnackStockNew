import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../shared/services/supabase.service';
import notify from 'devextreme/ui/notify';

@Component({
  selector: 'app-shopping-list',
  templateUrl: './shopping-list.component.html',
  styleUrl: './shopping-list.component.scss'
})
export class ShoppingListComponent implements OnInit {
  activeShoppingItems: any[] = [];
  inactiveShoppingLists: any[] = [];
  selectedShoppingListItems: any[] = [];
  selectedShoppingList: any;
  popupVisible = false;

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit(): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (householdId) {
      await this.loadShoppingLists(householdId);
    }
  }

  async loadShoppingLists(householdId: string) {
    try {
      // Fetch active and inactive shopping lists from the service
      const { activeItems, inactiveLists } = await this.supabaseService.getShoppingLists(householdId);
      this.activeShoppingItems = activeItems;
      this.inactiveShoppingLists = inactiveLists;
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
      notify('Failed to load shopping lists. Please try again later.', 'error', 2000);
    }
  }

  openPopup(shoppingList: any): void {
    this.selectedShoppingList = shoppingList;
    this.selectedShoppingListItems = shoppingList.items;
    this.popupVisible = true;
  }

  async onItemDeleted(e: any): Promise<void> {
    const itemId = e.itemData.id;
    try {
      await this.supabaseService.deleteShoppingListItem(itemId);
      notify('Item removed from the shopping list.', 'success', 2000);
      this.activeShoppingItems = this.activeShoppingItems.filter(item => item.id !== itemId);
    } catch (error) {
      console.error('Error deleting item:', error);
      notify('Failed to delete item. Please try again.', 'error', 2000);
    }
  }
}
