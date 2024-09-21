import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../shared/services/supabase.service';
import { SPOONACULAR_API_KEY, SPOONACULAR_AUTOCOMPLETE_URL } from '../../../api-creds';
import { StockItem } from '../../../app-interfaces';
import notify from 'devextreme/ui/notify';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss'
})
export class StockComponent implements OnInit {
  stockItems: StockItem[] = [];
  popupVisible: boolean = false;
  isEditMode: boolean = false;
  selectedItem: StockItem = { id: '', item: '', quantity: 0, unit: '' };
  ingredientSuggestions: any[] = [];
  ingredientUnits: string[] = [];
  searchSubject: Subject<string> = new Subject<string>();

  constructor(private supabaseService: SupabaseService, private http: HttpClient) {
    this.onSaveItem = this.onSaveItem.bind(this);
  }
  
  async ngOnInit(): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (!householdId) {
      console.error('Household ID is missing from localStorage.');
      return;
    }
    this.stockItems = await this.fetchStock();
    this.searchSubject.pipe(
      debounceTime(250), // Wait 250ms after the last input
      distinctUntilChanged() // Only trigger if the input value has changed
    ).subscribe(query => {
      this.fetchIngredientSuggestions(query); // Call the fetch function after debounce
    });
  }

  async fetchStock(): Promise<StockItem[]> {
    const householdId = localStorage.getItem('householdId');
    try {
      const retrievedStock = await this.supabaseService.getStockItems(householdId);
      return retrievedStock;
    } catch (err) {
      console.error(err);
      notify("Failed to retrieve the stock. Please reload the page.", "error", 2000);
      return [];
    }
  }

  item_quantity_unit(rowData: StockItem){
    return `${rowData.item} ${rowData.quantity} ${rowData.unit}`;
  }

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
      notify("Failed to fetch ingredient suggestions. Please try again later.", "error", 2000);
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

  async addItem(stockItem: StockItem): Promise<void> {
    if (stockItem.quantity == 0) {
      notify("Stock quantity must be greater than zero!", "warning", 2000);
    } else {
      const householdId = localStorage.getItem('householdId');
      try {
        const newItem = await this.supabaseService.addStockItem(stockItem, householdId);
        this.stockItems.push(newItem);
        this.popupVisible = false;
        notify("Item successfully added!", "success", 2000);
      } catch (error) {
        console.error('Failed to add stock item:', error);
        notify("Failed to added stock item. Please try again.", "error", 2000);
      }
    }
  }

  async modifyItem(stockItem: StockItem): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (stockItem.quantity == 0) {
      return await this.deleteItem(stockItem);
    } else {
      try {
        await this.supabaseService.modifyStockItem(stockItem, householdId);
        const index = this.stockItems.findIndex(item => item.id === stockItem.id);
        if (index > -1) {
          this.stockItems[index] = stockItem;
          this.popupVisible = false;
          notify("Item successfully updated!", "success", 2000);
        }
      } catch (error) {
        console.error('Failed to modify stock item:', error);
        notify("Failed to update stock item. Please try again.", "error", 2000);
      }
    }
  }

  async deleteItem(stockItem: StockItem): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    try {
      await this.supabaseService.deleteStockItem(stockItem.id, householdId);
      this.stockItems = this.stockItems.filter(item => item.id !== stockItem.id);
      this.popupVisible = false;
      notify("Item successfully deleted!", "success", 2000);
    } catch (error) {
      console.error('Failed to delete stock item:', error);
      notify("Failed to delete stock item. Please try again.", "error", 2000);
    }
  }

  onAddItemClick(): void {
    this.isEditMode = false;
    this.selectedItem = { id: '', item: '', quantity: 0, unit: '' };
    this.popupVisible = true;
  }

  async onRowRemoving(event: any): Promise<void> {
    await this.deleteItem(event.data as StockItem);
  }

  onEditingStart(event: any): void {
    event.cancel = true; // Cancel the grid's default editing popup
    this.isEditMode = true;
    this.selectedItem = { ...event.data }; // Set the selected item for editing
    this.popupVisible = true;
  }

  handleFocusIn(e: any) {
    if (e.component.option('value') === 0) {
      e.component.option('value', '');
    }
  }
  
  handleFocusOut(e: any) {
    if (!e.component.option('value')) {
      e.component.option('value', 0); // Set it back to 0 if empty
    }
  }
  
  handleKeyDown(e: any) {
    const event = e.event;
    if (event.key === ",") {
      event.preventDefault();
      event.stopPropagation();
      var input = e.element.querySelector("input.dx-texteditor-input");
      e.component._setInputText(input.value + ".");
      input.setSelectionRange(input.value.length, input.value.length);    
    }
  }

  // Handler for Save button - adds or modifies the stock item
  async onSaveItem(): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (!householdId) return;

    if (this.isEditMode) {
      await this.modifyItem(this.selectedItem);
    } else {
      const existingItem = this.stockItems.find(item => item.item.toLowerCase() === this.selectedItem.item.toLowerCase());
      if (existingItem) {
        // If item exists, add the quantity to the existing one
        existingItem.quantity += this.selectedItem.quantity;
    
        // Call modifyItem to update the existing item in the database
        await this.modifyItem(existingItem);
      } else {
        // If item doesn't exist, add a new one
        await this.addItem(this.selectedItem);
      }
    }
  }

  onPopupClose(): void {
    this.popupVisible = false;
  }
}