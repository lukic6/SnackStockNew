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
import { DxButtonModule, DxDataGridModule, DxFormModule, DxPopupModule, DxTextBoxModule } from 'devextreme-angular';

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
    DxButtonModule,
    DxDataGridModule,
    DxPopupModule,
    DxiButtonModule,
    DxoButtonOptionsModule,
    DxiValidationRuleModule,
    DxiItemModule,
    DxFormModule,
    DxTextBoxModule
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
