export interface StockItem {
    id: string;
    item: string;
    quantity: number;
    unit: string;
}

export interface MealItem {
    id: string;
    householdId: string;
    item: string;
    quantity: number;
    unit: string;
}

export interface ShoppingListItem {
    id?: string | undefined;
    shoppingListId: string;
    item: string;
    quantity: number;
    unit: string;
}