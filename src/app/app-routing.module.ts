import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginFormComponent, CreateAccountFormComponent } from './shared/components';
import { AuthGuardService } from './shared/services';
import { RecipesComponent } from './pages/recipes/recipes.component';
import { ShoppingListComponent } from './pages/shopping-list/shopping-list.component';
import { HistoryComponent } from './pages/history/history.component';
import { OptionsComponent } from './pages/options/options.component';
import { StockComponent } from './pages/stock/stock.component';
import { DxiButtonModule, DxiItemModule, DxiValidationRuleModule, DxoButtonOptionsModule } from 'devextreme-angular/ui/nested';
import { DxAutocompleteModule, DxButtonModule, DxDataGridModule, DxFormModule, DxListModule, DxNumberBoxModule, DxPopupModule, DxSelectBoxModule, DxTextBoxModule } from 'devextreme-angular';
import { CommonModule } from '@angular/common';

const routes: Routes = [
  {
    path: 'stock',
    component: StockComponent,
    canActivate: [ AuthGuardService ]
  },
  {
    path: 'recipes',
    component: RecipesComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'shopping-list',
    component: ShoppingListComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'history',
    component: HistoryComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'options',
    component: OptionsComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'login-form',
    component: LoginFormComponent,
    canActivate: [ AuthGuardService ]
  },
  {
    path: 'create-account',
    component: CreateAccountFormComponent,
    canActivate: [ AuthGuardService ]
  },
  {
    path: '**',
    redirectTo: 'stock'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes),
    CommonModule,
    DxButtonModule,
    DxDataGridModule,
    DxPopupModule,
    DxiButtonModule,
    DxoButtonOptionsModule,
    DxiValidationRuleModule,
    DxiItemModule,
    DxFormModule,
    DxTextBoxModule,
    DxAutocompleteModule,
    DxListModule,
    DxNumberBoxModule,
    DxSelectBoxModule
  ],
  providers: [AuthGuardService],
  exports: [RouterModule],
  declarations: [
    StockComponent,
    RecipesComponent,
    ShoppingListComponent,
    HistoryComponent,
    OptionsComponent
  ]
})
export class AppRoutingModule { }
