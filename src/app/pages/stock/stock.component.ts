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
  householdId: string | null = localStorage.getItem('householdId'); 
  isEditMode: boolean = false;
  selectedItem: StockItem = { id: '', item: '', quantity: 0, measurement: '' };

  constructor(private supabaseService: SupabaseService) {}
  
  async ngOnInit(): Promise<void> {
    if (!this.householdId) {
      console.error('Household ID is missing from localStorage.');
      return;
    }
    this.stockItems = await this.fetchStock();
  }

  async fetchStock(): Promise<StockItem[]> {
    try {
      const retreivedStock = await this.supabaseService.getStockItems(this.householdId);
      return retreivedStock;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  async addItem(stockItem: StockItem): Promise<void> {
    try {
      const newItem = await this.supabaseService.addStockItem(stockItem, this.householdId);
      this.stockItems.push(newItem);
    } catch (error) {
      console.error('Failed to add stock item:', error);
    }
  }

  async modifyItem(stockItem: StockItem): Promise<void> {
    try {
      await this.supabaseService.modifyStockItem(stockItem, this.householdId);
      const index = this.stockItems.findIndex(item => item.id === stockItem.id);
      if (index > -1) {
        this.stockItems[index] = stockItem;
      }
    } catch (error) {
      console.error('Failed to modify stock item:', error);
    }
  }

  async deleteItem(stockItem: StockItem): Promise<void> {
    try {
      await this.supabaseService.deleteStockItem(stockItem.id, this.householdId);
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

  // Handler for Edit button click - opens the popup in Edit mode
  onEditItemClick(event: any): void {
    const item = event as StockItem;
    this.isEditMode = true;
    this.selectedItem = { ...item };  // Clone the item for editing
    this.popupVisible = true;  // Show the popup
  }

  // Handler for Delete button click
  async onDeleteItemClick(event: any): Promise<void> {
    const item = event as StockItem;
    await this.deleteItem(item);
  }

  // Handler for Save button - adds or modifies the stock item
  async onSaveItem(): Promise<void> {
    if (!this.householdId) return;

    if (this.isEditMode) {
      await this.modifyItem(this.selectedItem);
    } else {
      await this.addItem(this.selectedItem);
    }

    this.popupVisible = false;  // Hide the popup after saving
  }
}