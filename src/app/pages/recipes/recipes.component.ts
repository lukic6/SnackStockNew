import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SupabaseService } from '../../shared/services/supabase.service';
import notify from 'devextreme/ui/notify';
import { EDAMAM_APP_ID, EDAMAM_APP_KEY, EDAMAM_RECIPE_SEARCH_URL, SPOONACULAR_API_KEY } from '../../../api-creds'

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
  private searchSubject: Subject<string> = new Subject<string>();

  constructor(
    private http: HttpClient,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.fetchRecommendedRecipes();
    // Set up debouncing for meal suggestions input
    this.searchSubject.pipe(
      debounceTime(500), // Wait for 500ms after the user stops typing
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
  
      const url = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(
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
    const url = `https://api.spoonacular.com/recipes/autocomplete?query=${encodeURIComponent(
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
    console.log('Selected Recipe:', recipe);
    notify(`Selected Recipe: ${recipe.title}`, 'success', 2000);
  }
  onMealSuggestionClick(event: any): void {
    const recipe = event.itemData;
    this.fetchRecipeDetails(recipe.id);
  }

  fetchRecipeDetails(recipeId: number): void {
    const url = `https://api.spoonacular.com/recipes/${recipeId}/information?includeNutrition=false&apiKey=${SPOONACULAR_API_KEY}`;
  
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
  
}