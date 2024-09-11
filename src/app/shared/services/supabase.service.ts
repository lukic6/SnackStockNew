import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseKey, supabaseUrl } from '../../../supabase-creds';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  constructor() { 
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private async createHousehold(): Promise<string> {
    const { data, error } = await this.supabase
      .from('Households')
      .insert({ member: 1 })
      .select();

    if (error) {
      console.error('Error creating household:', error.message);
      throw error;
    }

    return data[0].id;
  }

  async registerUser(username: string, password: string): Promise<string> {
    const householdId = await this.createHousehold();
    const {data, error} = await this.supabase
    .from("Users")
    .insert({username, password, householdId})
    .select();
    if (error) {
      console.log(error);
      throw error;
    }
    return data[0].id;
  }

  async loginUser(username: string, password: string): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from('Users')
      .select('id')
      .eq('username', username)
      .eq('password', password);

      if (error || data.length === 0) {
        console.error('Login failed:', error);
        return null;
      }
      return data[0];
  }

  async getUserById(userId: string): Promise<{ username: string } | null> {
    const { data, error } = await this.supabase
      .from('Users')
      .select('username')
      .eq('id', userId);

    if (error || data.length === 0) {
      console.error('Error fetching user by ID:', error);
      return null;
    }

    return data[0];
  }
}
