import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SupabaseService } from '../../shared/services/supabase.service';
import notify from 'devextreme/ui/notify';
import { SPOONACULAR_API_KEY, SPOONACULAR_RECIPES_URL } from '../../../api-creds';
import { MealItem } from '../../../app-interfaces';

@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.component.html',
  styleUrl: './recipes.component.scss'
})
export class RecipesComponent implements OnInit {
  selectedRecipe: any;
  recommendedRecipes: any[] = [];
  mealSuggestions: any[] = [];
  popupVisible: boolean = false;
  searchQuery: string = '';
  numberOfServings: number = 1;

  private searchSubject: Subject<string> = new Subject<string>();

  constructor(
    private http: HttpClient,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.fetchRecommendedRecipes();
    // Set up debouncing for meal suggestions input
    this.searchSubject.pipe(
      debounceTime(250), // Wait for 250ms after the user stops typing
      distinctUntilChanged() // Only emit if the query has changed
    ).subscribe((query) => {
      this.fetchMealSuggestions(query);
    });
  }

  async fetchRecommendedRecipes(): Promise<void> {
    try {
      const householdId = localStorage.getItem('householdId');
      if (!householdId) {
        console.error('Household ID is missing from localStorage.');
        return;
      }
  
      const stockItems = await this.supabaseService.getStockItems(householdId);
      if (stockItems.length === 0) {
        // No stock items, do not fetch recommended recipes
        return;
      }
  
      // Get the list of ingredients from the stock
      const ingredients = stockItems.map((item) => item.item).join(',');
  
      const url = `${SPOONACULAR_RECIPES_URL}/findByIngredients?ingredients=${encodeURIComponent(
        ingredients
      )}&number=5&ranking=1&apiKey=${SPOONACULAR_API_KEY}`;
  
      this.http.get(url).subscribe(
        (data: any) => {
          if (data && data.length > 0) {
            this.recommendedRecipes = data;
          } else {
            this.recommendedRecipes = [];
          }
        },
        (error) => {
          console.error('Error fetching recommended recipes:', error);
          notify(
            'Failed to fetch recommended recipes. Please try again later.',
            'error',
            2000
          );
        }
      );
    } catch (error) {
      console.error('Error fetching stock items:', error);
      notify(
        'Failed to retrieve stock items. Please try again later.',
        'error',
        2000
      );
    }
  }

  onOtherMealsClick(): void {
    this.popupVisible = true;
  }

  onPopupClose(): void {
    this.popupVisible = false;
    this.searchQuery = '';
    this.mealSuggestions = [];
  }

  onMealInput(event: any): void {
    const query = event.component.option('text');
    if (query.length > 2) {
      this.searchSubject.next(query);
    }
  }

  fetchMealSuggestions(query: string): void {
    const url = `${SPOONACULAR_RECIPES_URL}/autocomplete?query=${encodeURIComponent(
      query
    )}&number=5&apiKey=${SPOONACULAR_API_KEY}&metaInformation=true`;
  
    this.http.get(url).subscribe(
      (data: any) => {
        if (data && data.length > 0) {
          this.mealSuggestions = data;
        } else {
          this.mealSuggestions = [];
        }
      },
      (error) => {
        console.error('Error fetching meal suggestions:', error);
        notify(
          'Failed to fetch meal suggestions. Please try again later.',
          'error',
          2000
        );
      }
    );
  }

  onMealSelected(event: any): void {
    const selectedRecipe = this.mealSuggestions.find(
      (recipe) => recipe.title === event.component.option('value')
    );
  
    if (selectedRecipe) {
      this.fetchRecipeDetails(selectedRecipe.id);
    }
  }
  

  onRecipeClick(event: any): void {
    const recipe = event.itemData;
    this.fetchRecipeDetails(recipe.id);
  }
  onMealSuggestionClick(event: any): void {
    const recipe = event.itemData;
    this.fetchRecipeDetails(recipe.id);
  }

  fetchRecipeDetails(recipeId: number): void {
    const url = `${SPOONACULAR_RECIPES_URL}/${recipeId}/information?includeNutrition=false&apiKey=${SPOONACULAR_API_KEY}`;
  
    this.http.get(url).subscribe(
      (data: any) => {
        // Handle the recipe details (e.g., display in a new popup or navigate to a detail page)
        console.log('Recipe Details:', data);
        // For example, you might store it in a variable and display it in the template
        this.selectedRecipe = data;
      },
      (error) => {
        console.error('Error fetching recipe details:', error);
        notify(
          'Failed to fetch recipe details. Please try again later.',
          'error',
          2000
        );
      }
    );
  }

  async startPlanning(): Promise<void> {
    if (!this.selectedRecipe) return;
    
    const householdId = localStorage.getItem('householdId');
    if (!householdId) {
      console.error('Household ID is missing from localStorage.');
      return;
    }
  
    try {
      // 1. Save Meal to Meals Table
      const meal = {
        householdId,
        mealName: this.selectedRecipe.title,
        servings: this.numberOfServings
      };
  
      const mealData = await this.supabaseService.addMeal(meal);
      const mealId = mealData.id;
  
      // 2. Get Ingredients and Calculate Quantities
      const ingredients = this.selectedRecipe.extendedIngredients.map((ingredient: any) => {
        return {
          mealId,
          item: ingredient.name,
          quantity: ingredient.measures.metric.amount * this.numberOfServings / this.selectedRecipe.servings,
          unit: ingredient.measures.metric.unitShort,
        };
      });
  
      // 3. Save Ingredients to MealItems Table
      for (const ingredient of ingredients) {
        await this.supabaseService.addMealItem(ingredient);
      }
  
      // 4. Update Stock and Shopping List
      await this.updateStockAndShoppingList(ingredients, householdId);
  
      notify('Meal planned successfully!', 'success', 2000);
      this.selectedRecipe = null; // Close the popup
    } catch (error) {
      console.error('Error planning meal:', error);
      notify('Failed to plan meal. Please try again later.', 'error', 2000);
    }
  }
  
  async updateStockAndShoppingList(ingredients: MealItem[], householdId: string): Promise<void> {
    // Fetch current stock items
    const stockItems = await this.supabaseService.getStockItems(householdId);
  
    for (const ingredient of ingredients) {
      const stockItem = stockItems.find(item => item.item.toLowerCase() === ingredient.item.toLowerCase());
  
      if (stockItem) {
        // Stock item exists
        if (stockItem.quantity >= ingredient.quantity) {
          // Sufficient stock, deduct quantity
          stockItem.quantity -= ingredient.quantity;
          await this.supabaseService.modifyStockItem(stockItem, householdId);
        } else {
          // Insufficient stock, deduct available quantity and add the rest to shopping list
          const missingQuantity = ingredient.quantity - stockItem.quantity;
          stockItem.quantity = 0;
          await this.supabaseService.modifyStockItem(stockItem, householdId);
  
          // Add missing quantity to shopping list
          await this.supabaseService.addShoppingListItem({
            householdId,
            item: ingredient.item,
            quantity: missingQuantity,
            unit: ingredient.unit,
            active: true
          });
        }
      } else {
        // Stock item does not exist, add entire quantity to shopping list
        await this.supabaseService.addShoppingListItem({
          householdId,
          item: ingredient.item,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          active: true
        });
      }
    }
  }
}