import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../shared/services/supabase.service';
import { Meal, MealItem } from '../../../app-interfaces';
import notify from 'devextreme/ui/notify';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { SPOONACULAR_API_KEY, SPOONACULAR_RECIPES_URL } from '../../../api-creds';
import Fuse from 'fuse.js';

@Component({
  selector: 'app-my-meals',
  templateUrl: './my-meals.component.html',
  styleUrl: './my-meals.component.scss'
})
export class MyMealsComponent implements OnInit {
  plannedMeals: Meal[] = [];
  mealHistory: Meal[] = [];
  selectedMeal: Meal | null = null;
  mealItems: MealItem[] = [];
  popupVisible: boolean = false;
  numberOfServings: number = 1;
  confirmationPopupVisible: boolean = false;
  popupResponse: boolean = false;  // To handle the popup response
  missingItems: { item: string; needed: number; available: number }[] = [];  // Missing ingredients
  matchedItems: { mealItem: MealItem; stockItem: any; convertedQuantity: number }[] = [];  // Matched ingredients
  currentMealId: string = '';  // Current meal being cooked
  currentMealName: string = '';  // Name of the current meal being cooked

  constructor(private supabaseService: SupabaseService, private http: HttpClient) {}

  async ngOnInit(): Promise<void> {
    const householdId = localStorage.getItem('householdId');
    if (householdId) {
      try {
        const meals = await this.supabaseService.getMeals(householdId);
        // Sort meals into planned and history based on 'active' field
        this.plannedMeals = meals.filter(meal => meal.active);
        this.mealHistory = meals.filter(meal => !meal.active);
      } catch (error) {
        console.error('Error fetching meals:', error);
        notify('Failed to load meals. Please try again later.', 'error', 2000);
      }
    }
  }

  async openMealPopup(meal: Meal): Promise<void> {
    this.selectedMeal = meal;
    // Fetch MealItems for the selected meal
    try {
      this.mealItems = await this.supabaseService.getMealItems(meal.id);
      this.popupVisible = true;
    } catch (error) {
      console.error('Error fetching meal items:', error);
      notify('Failed to load meal details. Please try again later.', 'error', 2000);
    }
  }

  closePopup(): void {
    this.popupVisible = false;
    this.selectedMeal = null;
    this.mealItems = [];
  }

  // Part 1: Pre-popup logic
  async cookMeal(meal: Meal): Promise<void> {
    try {
      this.currentMealId = meal.id;
      this.currentMealName = meal.mealName;
      // 1. Fetch Meal Items
      const mealItems: MealItem[] = await this.supabaseService.getMealItems(meal.id);
      
      // 2. Fetch Stock Items
      const householdId = localStorage.getItem('householdId');
      const stockItems = await this.supabaseService.getStockItems(householdId);

      // 3. Initialize Fuse.js for fuzzy matching
      const fuseOptions = {
        includeScore: true,
        threshold: 0.5,
        keys: ['item']
      };
      const fuse = new Fuse(stockItems, fuseOptions);

      // Normalize function for ingredient names
      const normalize = (str: string) => {
        return str
          .toLowerCase()
          .replace(/s$/, '') // Remove plural 's'
          .replace(/\b(fresh|dried|ground|organic|large|small|medium|whole|fat-free)\b/g, '') // Remove stop words
          .trim();
      };

      // 4. Match Meal Items with Stock Items (fuzzy matching + substitutes)
      this.missingItems = [];
      this.matchedItems = [];

      await Promise.all(
        mealItems.map(async (mealItem) => {
          // First attempt to find an exact match
          let stockItem = stockItems.find(item => item.item.toLowerCase() === mealItem.item.toLowerCase());

          // **Second Matching Step: Fuzzy Matching**
          if (!stockItem) {
            const normalizedIngredientName = normalize(mealItem.item);
            const results = fuse.search(normalizedIngredientName);
            if (results.length > 0) {
              stockItem = results[0].item;
            }
          }

          // **Third Matching Step: Use Substitutes**
          if (!stockItem) {
            const substitutes = await this.getIngredientSubstitutes(mealItem.item);
            for (const substitute of substitutes) {
              const normalizedSubstitute = normalize(substitute);

              // Try exact match with substitute
              stockItem = stockItems.find(item => normalize(item.item) === normalizedSubstitute);
              if (stockItem) {
                break;
              }

              // If still no match, try fuzzy matching with substitute
              const substituteResults = fuse.search(normalizedSubstitute);
              if (substituteResults.length > 0) {
                stockItem = substituteResults[0].item;
                break;
              }
            }
          }

          if (stockItem) {
            // Perform unit conversion before deduction
            const convertedQuantity = await this.supabaseService.convertUnits(
              mealItem.quantity,
              mealItem.unit,
              stockItem.unit,
              mealItem.item
            );

            // Check if stock is sufficient after conversion
            if (stockItem.quantity >= convertedQuantity) {
              this.matchedItems.push({ mealItem, stockItem, convertedQuantity });
            } else {
              // Insufficient stock
              this.missingItems.push({
                item: mealItem.item,
                needed: convertedQuantity,
                available: stockItem.quantity,
              });
            }
          } else {
            // Item not found in stock
            this.missingItems.push({
              item: mealItem.item,
              needed: mealItem.quantity,
              available: 0,
            });
          }
        })
      );

      // 5. Show the missing items popup
      this.missingItems = this.missingItems; // Bind missing items to the popup
      this.confirmationPopupVisible = true; // Show the popup

      // Wait for user action in the popup (OK or Cancel will set the popupResponse)
    } catch (error) {
      console.error('Error fetching meal and stock data:', error);
      notify('Failed to fetch meal and stock data. Please try again later.', 'error', 2000);
    }
  }

  // Part 2: Post-popup logic (called after user interaction with the popup)
  async proceedWithCooking(): Promise<void> {
    try {
      if (!this.popupResponse) {
        // User canceled the process
        return;
      }

      const householdId = localStorage.getItem('householdId');

      // 6. Deduct matched items from stock
      await Promise.all(
        this.matchedItems.map(async ({ mealItem, stockItem, convertedQuantity }) => {
          stockItem.quantity -= convertedQuantity;

          if (stockItem.quantity === 0) {
            await this.supabaseService.deleteStockItem(stockItem.id, householdId);
          } else {
            await this.supabaseService.modifyStockItem(stockItem, householdId);
          }
        })
      );

      // 7. Set the meal to inactive
      await this.supabaseService.updateMealStatus(this.currentMealId, false);

      // Notify the user that the meal was cooked successfully
      notify(`Meal "${this.currentMealName}" cooked successfully!`, 'success', 2000);

      // Move the meal from plannedMeals to mealHistory
      const cookedMeal = this.plannedMeals.find(m => m.id === this.currentMealId);
      this.plannedMeals = this.plannedMeals.filter(m => m.id !== this.currentMealId);
      if (cookedMeal) {
        this.mealHistory = [cookedMeal, ...this.mealHistory];
        cookedMeal.active = false;
      }
    } catch (error) {
      console.error('Error deducting stock or updating meal status:', error);
      notify('Failed to complete the cooking process. Please try again later.', 'error', 2000);
    }
  }


  async deleteMeal(meal: Meal): Promise<void> {
    try {
      await this.supabaseService.deleteMeal(meal.id);
      notify(`Meal ${meal.mealName} deleted!`, 'success', 2000);
      this.plannedMeals = this.plannedMeals.filter(m => m.id !== meal.id);
    } catch (error) {
      console.error('Error deleting meal:', error);
      notify('Failed to delete the meal. Please try again later.', 'error', 2000);
    }
  }

  async planAgain(meal: Meal): Promise<void> {
    try {
      const multiplier = Math.round(this.numberOfServings / meal.servings);
      if (this.mealItems && this.mealItems.length > 0) {
        this.mealItems.forEach(item => {
          item.quantity *= multiplier;
        });
        await this.supabaseService.planMealAgain(meal, this.mealItems, this.numberOfServings);
        const householdId = localStorage.getItem('householdId');
        if (householdId) {
          this.plannedMeals = await this.supabaseService.getMeals(householdId);
          this.plannedMeals = this.plannedMeals.filter(m => m.active);
        }
        this.popupVisible = false;
        notify(`Meal "${meal.mealName}" has been planned again!`, 'success', 2000);
      } else {
        notify('No ingredients found for this meal.', 'error', 2000);
        return;
      }
    } catch (error) {
      console.error('Error planning again:', error);
      notify('Failed to plan again. Please try again later.', 'error', 2000);
    }
  }

  async getIngredientSubstitutes(ingredientName: string): Promise<string[]> {
    const url = `https://api.spoonacular.com/food/ingredients/substitutes?ingredientName=${encodeURIComponent(ingredientName)}&apiKey=${SPOONACULAR_API_KEY}`;
    try {
      const response: any = await lastValueFrom(this.http.get(url));
      if (response && response.substitutes) {
        // Parse the substitutes to extract ingredient names
        const substitutes = response.substitutes.flatMap((substitute: string) => {
          // Remove quantity and measurement from the substitute string
          const parts = substitute.split('=');
          const substitutePart = parts.length === 2 ? parts[1].trim() : substitute.trim();

          // Split at '+' to handle combinations
          return substitutePart.split('+').map(part => {
            // Remove quantity and units (e.g., "1 cup")
            return part.replace(/^\d+(\.\d+)?\s*\w*\s*/, '').trim();
          });
        });
        return substitutes;
      } else {
        return [];
      }
    } catch (error) {
      console.error(`Error fetching substitutes for ingredient ${ingredientName}:`, error);
      return [];
    }
  }
}