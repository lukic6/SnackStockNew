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
  householdId: string | null = localStorage.getItem('householdId'); 

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
}