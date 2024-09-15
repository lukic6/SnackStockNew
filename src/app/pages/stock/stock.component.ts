import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../shared/services/supabase.service';
import { StockItem } from '../../../app-interfaces';
import notify from 'devextreme/ui/notify';

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss'
})
export class StockComponent implements OnInit {
  stockItems: StockItem[] = [];
  popupVisible: boolean = false;
  isEditMode: boolean = false;
  selectedItem: StockItem = { id: '', item: '', quantity: 0, measurement: '' };

  constructor(private supabaseService: SupabaseService) {
    this.onSaveItem = this.onSaveItem.bind(this);
  }
  
  async ngOnInit(): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (!householdId) {
      console.error('Household ID is missing from localStorage.');
      return;
    }
    this.stockItems = await this.fetchStock();
  }

  async fetchStock(): Promise<StockItem[]> {
    const householdId = localStorage.getItem('householdId');
    try {
      const retreivedStock = await this.supabaseService.getStockItems(householdId);
      return retreivedStock;
    } catch (err) {
      console.error(err);
      notify("Failed to retrieve the stock. Please reload the page.", "error", 2000);
      return [];
    }
  }

  item_quantity_measurement(rowData: StockItem){
    return `${rowData.item} ${rowData.quantity} ${rowData.measurement}`;
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
    this.selectedItem = { id: '', item: '', quantity: 0, measurement: '' };
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

  // Handler for Save button - adds or modifies the stock item
  async onSaveItem(): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (!householdId) return;

    if (this.isEditMode) {
      await this.modifyItem(this.selectedItem);
    } else {
      await this.addItem(this.selectedItem);
    }
  }

  onPopupClose(): void {
    this.popupVisible = false;
  }
}