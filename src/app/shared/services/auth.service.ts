// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, CanActivate } from '@angular/router';
import { SupabaseService } from './supabase.service';

export interface IUser {
  username: string;
  avatarUrl?: string;
}

const defaultPath = '/';
const defaultUser = {
  username: 'defaultUser',
  avatarUrl: 'https://js.devexpress.com/Demos/WidgetsGallery/JSDemos/images/employees/06.png'
};

@Injectable()
export class AuthService {
  private _user: IUser | null = null;

  get loggedIn(): boolean {
    return !!localStorage.getItem('userId');
  }

  private _lastAuthenticatedPath: string = defaultPath;

  set lastAuthenticatedPath(value: string) {
    this._lastAuthenticatedPath = value;
  }

  constructor(private router: Router, private supabaseService: SupabaseService) {}

  // Log in method using Supabase service
  async logIn(username: string, password: string) {
    try {
      const user = await this.supabaseService.loginUser(username, password);
      
      if (!user) {
        return { isOk: false, message: "Authentication failed" };
      }

      // Store the UUID in localStorage
      localStorage.setItem('userId', user.id);
      localStorage.setItem('username', user.username);
      localStorage.setItem('householdId', user.householdId);
      
      // Set the user information
      this._user = { username, avatarUrl: defaultUser.avatarUrl };
      
      // Navigate to the last authenticated path
      this.router.navigate([this._lastAuthenticatedPath]);
      return { isOk: true, data: this._user };
    } catch {
      return { isOk: false, message: "Authentication failed" };
    }
  }

  // Fetch the user based on UUID from localStorage
  async getUser() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      return { isOk: false, data: null };
    }

    const user = await this.supabaseService.getUserById(userId);
    
    if (user) {
      this._user = { username: user.username, avatarUrl: defaultUser.avatarUrl };
      return { isOk: true, data: this._user };
    }

    return { isOk: false, data: null };
  }

  // Create account method using Supabase service
  async createAccount(username: string, password: string) {
    try {
      const userId = await this.supabaseService.registerUser(username, password);

      // Store the user ID in localStorage
      localStorage.setItem('userId', userId.userId);
      localStorage.setItem('username', userId.username);
      localStorage.setItem('householdId', userId.householdId);

      // Set the user information
      this._user = { username, avatarUrl: defaultUser.avatarUrl };

      // Navigate to the login form or another route
      this.router.navigate(['/login-form']);
      return { isOk: true };
    } catch (error) {
      return { isOk: false, message: "Failed to create account" };
    }
  }

  // Log out method to clear session
  async logOut() {
    this._user = null;
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('householdId');
    this.router.navigate(['/login-form']);
  }
}

@Injectable()
export class AuthGuardService implements CanActivate {
  constructor(private router: Router, private authService: AuthService) { }

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const isLoggedIn = this.authService.loggedIn;
    const isAuthForm = [
      'login-form',
      'reset-password',
      'create-account',
      'change-password/:recoveryCode'
    ].includes(route.routeConfig?.path || defaultPath);

    if (isLoggedIn && isAuthForm) {
      this.authService.lastAuthenticatedPath = defaultPath;
      this.router.navigate([defaultPath]);
      return false;
    }

    if (!isLoggedIn && !isAuthForm) {
      this.router.navigate(['/login-form']);
    }

    if (isLoggedIn) {
      this.authService.lastAuthenticatedPath = route.routeConfig?.path || defaultPath;
    }

    return isLoggedIn || isAuthForm;
  }
}