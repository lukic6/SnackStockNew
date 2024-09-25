import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../shared/services/supabase.service';
import { Meal, MealItem } from '../../../app-interfaces';
import notify from 'devextreme/ui/notify';

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

  constructor(private supabaseService: SupabaseService) {}

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
      console.log(this.selectedMeal);
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

  cookMeal(meal: Meal): void {
    // Functionality to be implemented later
    console.log('Cook the Meal:', meal);
    notify('Cook Meal functionality to be implemented.', 'info', 2000);
  }

  deleteMeal(meal: Meal): void {
    // Functionality to be implemented later
    console.log('Delete Meal:', meal);
    notify('Delete Meal functionality to be implemented.', 'info', 2000);
  }

  planAgain(meal: Meal): void {
    // Functionality to be implemented later
    console.log('Plan Again:', meal);
    notify('Plan Again functionality to be implemented.', 'info', 2000);
  }
}