import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../shared/services/supabase.service';
import notify from 'devextreme/ui/notify';
import { ShoppingListItem } from '../../../app-interfaces';
import { HttpClient } from '@angular/common/http';
import { SPOONACULAR_API_KEY, SPOONACULAR_AUTOCOMPLETE_URL } from '../../../api-creds';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-shopping-list',
  templateUrl: './shopping-list.component.html',
  styleUrl: './shopping-list.component.scss'
})
export class ShoppingListComponent implements OnInit {
  activeShoppingItems: ShoppingListItem[] = [];
  inactiveShoppingLists: any[] = [];
  selectedShoppingListItems: any[] = [];
  selectedShoppingList: any;
  popupVisible = false;
  archivePopupVisible = false;

  selectedItem: ShoppingListItem = { id: '', shoppingListId: '', item: '', quantity: 0, unit: '' };
  isEditMode: boolean = false;
  ingredientSuggestions: any[] = [];
  ingredientUnits: string[] = [];
  searchSubject: Subject<string> = new Subject<string>();
  shoppingListId: string = '';
  handleFocusIn = (e: any) => {
    if (e.component.option('value') === 0) {
      e.component.option('value', '');
    }
  };
  handleFocusOut = (e: any) => {
    if (!e.component.option('value')) {
      e.component.option('value', 0);
    }
  };
  handleKeyDown = (e: any) => {
    const event = e.event;
    if (event.key === ',') {
      event.preventDefault();
      event.stopPropagation();
      const input = e.element.querySelector('input.dx-texteditor-input');
      e.component._setInputText(input.value + '.');
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  constructor(private supabaseService: SupabaseService, private http: HttpClient) {
    this.onSaveItem = this.onSaveItem.bind(this);
  }

  async ngOnInit(): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (householdId) {
      await this.loadShoppingLists(householdId);
    }

    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(query => {
      this.fetchIngredientSuggestions(query);
    });
  }

  async loadShoppingLists(householdId: string) {
    try {
      const { activeItems, inactiveLists, activeShoppingListId } = await this.supabaseService.getShoppingLists(householdId);
      this.activeShoppingItems = activeItems;
      this.inactiveShoppingLists = inactiveLists;
      this.shoppingListId = activeShoppingListId;
      if (!this.shoppingListId) {
        const newShoppingListId = await this.supabaseService.createShoppingList(householdId);
        this.shoppingListId = newShoppingListId;
      }
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
      notify('Failed to load shopping lists. Please try again later.', 'error', 2000);
    }
  }

  item_quantity_unit(rowData: ShoppingListItem) {
    return `${rowData.item} ${rowData.quantity} ${rowData.unit}`;
  }

  onAddItemClick(): void {
    this.isEditMode = false;
    this.selectedItem = { id: '', shoppingListId: this.shoppingListId, item: '', quantity: 0, unit: '' };
    this.popupVisible = true;
  }

  async onShoppingBoughtClick(): Promise<void> {
    if (!this.shoppingListId) {
      notify('No active shopping list found.', 'error', 2000);
      return;
    }
    try {
      // Archive the current active shopping list
      await this.supabaseService.archiveShoppingList(this.shoppingListId);
      notify('Shopping list archived successfully.', 'success', 2000);
  
      const householdId = localStorage.getItem('householdId');
      if (householdId) {
        // Create a new active shopping list
        const newShoppingListId = await this.supabaseService.createShoppingList(householdId);
        this.shoppingListId = newShoppingListId;
        // Reload the shopping lists to reflect changes
        await this.loadShoppingLists(householdId);
      }
    } catch (error) {
      console.error('Error archiving shopping list:', error);
      notify('Failed to archive shopping list. Please try again.', 'error', 2000);
    }
  }
  

  async onRowRemoving(event: any): Promise<void> {
    await this.deleteItem(event.data as ShoppingListItem);
  }

  onEditingStart(event: any): void {
    event.cancel = true; // Cancel the grid's default editing popup
    this.isEditMode = true;
    this.selectedItem = { ...event.data }; // Set the selected item for editing
    this.popupVisible = true;
    this.ingredientUnits = [this.selectedItem.unit]; // Use existing unit
  }

  async onSaveItem(): Promise<void> {
    if (!this.selectedItem.item || !this.selectedItem.quantity || !this.selectedItem.unit) {
      notify('Please fill all required fields.', 'error', 2000);
      return;
    }

    try {
      if (this.isEditMode) {
        await this.modifyItem(this.selectedItem);
        notify('Item updated successfully.', 'success', 2000);
      } else {
        await this.addItem(this.selectedItem);
        notify('Item added successfully.', 'success', 2000);
      }
      this.popupVisible = false;
      await this.loadShoppingLists(localStorage.getItem('householdId')!);
    } catch (error) {
      console.error('Error saving item:', error);
      notify('Failed to save item. Please try again.', 'error', 2000);
    }
  }

  onPopupClose(): void {
    this.popupVisible = false;
    this.selectedItem = { id: '', shoppingListId: this.shoppingListId, item: '', quantity: 0, unit: '' };
  }

  // Methods for handling ingredient autocomplete and units
  async onItemInput(event: any) {
    const query = event.component.option('text');
    if (query.length > 1) {
      this.searchSubject.next(query);
    }
  }

  async fetchIngredientSuggestions(query: string) {
    const url = `${SPOONACULAR_AUTOCOMPLETE_URL}?query=${query}&number=5&metaInformation=true&apiKey=${SPOONACULAR_API_KEY}`;

    try {
      const data: any = await this.http.get(url).toPromise();
      this.ingredientSuggestions = data.map((ingredient: any) => ({
        name: ingredient.name,
        image: ingredient.image,
        id: ingredient.id,
        possibleUnits: ingredient.possibleUnits
      }));
    } catch (error) {
      console.error('Error fetching ingredient suggestions:', error);
      notify('Failed to fetch ingredient suggestions. Please try again later.', 'error', 2000);
    }
  }

  onItemSelected(event: any) {
    const selectedItemName = event.value;
    const selectedIngredient = this.ingredientSuggestions.find((ingredient: any) => ingredient.name === selectedItemName);
    if (selectedIngredient) {
      // Set the item name
      this.selectedItem.item = selectedIngredient.name;

      // Set possible units if available
      if (selectedIngredient.possibleUnits && selectedIngredient.possibleUnits.length > 0) {
        this.selectedItem.unit = selectedIngredient.possibleUnits[0]; // Default to the first unit
        this.ingredientUnits = selectedIngredient.possibleUnits; // Store all possible units for the select box
      } else {
        this.selectedItem.unit = ''; // Default to empty if no units are found
        this.ingredientUnits = [];   // Empty the units list
      }
    }
  }

  onItemFocusOut(event: any) {
    const selectedItemName = event.component.option('text');

    const selectedIngredient = this.ingredientSuggestions.find((ingredient: any) => ingredient.name === selectedItemName);
    if (selectedIngredient) {
      this.selectedItem.item = selectedIngredient.name;

      if (!this.selectedItem.unit && selectedIngredient.possibleUnits && selectedIngredient.possibleUnits.length > 0) {
        this.selectedItem.unit = selectedIngredient.possibleUnits[0]; // Default to the first unit
        this.ingredientUnits = selectedIngredient.possibleUnits; // Update the select box options
      }
    }
  }

  // Methods for adding, modifying, and deleting items
  async addItem(item: ShoppingListItem): Promise<void> {
    if (item.quantity == 0) {
      notify('Quantity must be greater than zero!', 'warning', 2000);
    } else {
      try {
        await this.supabaseService.addShoppingListItems(item);
        this.activeShoppingItems.push(item);
        this.popupVisible = false;
      } catch (error) {
        console.error('Failed to add shopping list item:', error);
        notify('Failed to add item. Please try again.', 'error', 2000);
      }
    }
  }

  async modifyItem(item: ShoppingListItem): Promise<void> {
    if (item.quantity == 0) {
      await this.deleteItem(item);
    } else {
      try {
        await this.supabaseService.modifyShoppingListItem(item);
        const index = this.activeShoppingItems.findIndex(i => i.id === item.id);
        if (index > -1) {
          this.activeShoppingItems[index] = item;
          this.popupVisible = false;
        }
      } catch (error) {
        console.error('Failed to modify shopping list item:', error);
        notify('Failed to update item. Please try again.', 'error', 2000);
      }
    }
  }

  async deleteItem(item: ShoppingListItem): Promise<void> {
    try {
      if (!item.id) {
        console.error('Cannot delete item: missing item id.');
        return;
      }
      await this.supabaseService.deleteShoppingListItem(item.id);
      this.activeShoppingItems = this.activeShoppingItems.filter(i => i.id !== item.id);
      this.popupVisible = false;
      notify('Item deleted successfully.', 'success', 2000);
    } catch (error) {
      console.error('Failed to delete shopping list item:', error);
      notify('Failed to delete item. Please try again.', 'error', 2000);
    }
  }

  openPopup(shoppingList: any): void {
    this.selectedShoppingList = shoppingList;
    this.selectedShoppingListItems = shoppingList.ShoppingListItems;
    this.archivePopupVisible = true;
  }
}
