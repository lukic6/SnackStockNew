import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SupabaseService } from '../../shared/services/supabase.service';
import notify from 'devextreme/ui/notify';
import { EDAMAM_APP_ID, EDAMAM_APP_KEY, EDAMAM_RECIPE_SEARCH_URL } from '../../../api-creds'

@Component({
  selector: 'app-recipes',
  templateUrl: './recipes.component.html',
  styleUrl: './recipes.component.scss'
})
export class RecipesComponent implements OnInit {
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

      const url = `${EDAMAM_RECIPE_SEARCH_URL}?q=${encodeURIComponent(
        ingredients
      )}&app_id=${EDAMAM_APP_ID}&app_key=${
        EDAMAM_APP_KEY
      }&to=5`;

      this.http.get(url).subscribe(
        (data: any) => {
          if (data.hits && data.hits.length > 0) {
            this.recommendedRecipes = data.hits.map((hit: any) => hit.recipe);
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
    const url = `${EDAMAM_RECIPE_SEARCH_URL}?q=${encodeURIComponent(
      query
    )}&app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&to=10`;

    this.http.get(url).subscribe(
      (data: any) => {
        if (data.hits && data.hits.length > 0) {
          this.mealSuggestions = data.hits.map((hit: any) => hit.recipe);
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
    // Optionally handle meal selection
  }

  onRecipeClick(event: any): void {
    const recipe = event.itemData;
    // Handle recipe click, e.g., navigate to a recipe details page
    console.log('Selected Recipe:', recipe);
    notify(`Selected Recipe: ${recipe.label}`, 'success', 2000);
  }
}