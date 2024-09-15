import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../shared/services/supabase.service';
import { StockItem } from '../../../app-interfaces';

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
      return [];
    }
  }
  quantity_measurement(rowData: StockItem){
    return `${rowData.quantity} ${rowData.measurement}`;
  }

  async addItem(stockItem: StockItem): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    try {
      const newItem = await this.supabaseService.addStockItem(stockItem, householdId);
      this.stockItems.push(newItem);
    } catch (error) {
      console.error('Failed to add stock item:', error);
    }
  }

  async modifyItem(stockItem: StockItem): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    try {
      await this.supabaseService.modifyStockItem(stockItem, householdId);
      const index = this.stockItems.findIndex(item => item.id === stockItem.id);
      if (index > -1) {
        this.stockItems[index] = stockItem;
      }
    } catch (error) {
      console.error('Failed to modify stock item:', error);
    }
  }

  async deleteItem(stockItem: StockItem): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    try {
      await this.supabaseService.deleteStockItem(stockItem.id, householdId);
      this.stockItems = this.stockItems.filter(item => item.id !== stockItem.id);
    } catch (error) {
      console.error('Failed to delete stock item:', error);
    }
  }

  onAddItemClick(): void {
    this.isEditMode = false;
    this.selectedItem = { id: '', item: '', quantity: 0, measurement: '' };  // Reset the selected item
    this.popupVisible = true;  // Show the popup
  }

  async onRowRemoving(event: any): Promise<void> {
    const item = event.data as StockItem;
    const householdId = localStorage.getItem('householdId');
    try {
      await this.supabaseService.deleteStockItem(item.id, householdId);
    } catch (error) {
      console.error('Failed to delete stock item:', error);
    }
  }

  async onRowUpdating(event: any): Promise<void> {
    const updatedItem = {...event.oldData, ...event.newData} as StockItem;
    const householdId = localStorage.getItem('householdId');
    try {
      await this.supabaseService.modifyStockItem(updatedItem, householdId);
    } catch (error) {
      console.error('Failed to update stock item:', error);
    }
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

    this.popupVisible = false;  // Hide the popup after saving
  }

  onPopupClose(): void {
    this.popupVisible = false;
  }
}