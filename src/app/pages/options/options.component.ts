import { Component, OnInit } from '@angular/core';
import notify from 'devextreme/ui/notify';
import Clipboard from 'clipboard';
import { SupabaseService } from '../../shared/services/supabase.service';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrl: './options.component.scss'
})
export class OptionsComponent implements OnInit {
  username: string = "";
  householdId: string | null = "";
  newHouseholdId: string = "";
  householdMembers: { username: string }[] = [];

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit(): void {
    // Load the current username and householdId from localStorage or a service
    this.householdId = localStorage.getItem('householdId');
    this.username = localStorage.getItem('username') || '';
    const clipboard = new Clipboard('.copy-button', {
      text: () => this.householdId || ""
    });

    clipboard.on('success', () => {
      notify('Household ID copied to clipboard!', "success", 2000);
      console.log('Household ID copied to clipboard');
    });

    clipboard.on('error', () => {
      console.error('Failed to copy Household ID');
    });

    this.loadHouseholdMembers();
  }

  async onChangeUsername(): Promise<void> {
    if (!this.username.trim()) {
      notify('Please enter a valid username.', 'error', 2000);
      return;
    }

    try {
      // Call Supabase service to update the username
      await this.supabaseService.updateUsername(this.username);
      localStorage.setItem('username', this.username);
      notify('Username successfully updated!', 'success', 2000);
    } catch (error) {
      console.error('Error updating username:', error);
      notify('Failed to update username. Please try again.', 'error', 2000);
    }
  }

  async onChangeHousehold(): Promise<void> {
    if (!this.newHouseholdId.trim()) {
      notify('Please enter a valid household ID.', 'error', 2000);
      return;
    }
  
    try {
      // Verify and update household
      const isValid = await this.supabaseService.verifyHousehold(this.householdId, this.newHouseholdId);
      if (isValid) {
        localStorage.setItem('householdId', this.newHouseholdId);
        this.householdId = this.newHouseholdId;
        notify('Household successfully changed!', 'success', 2000);
        await this.loadHouseholdMembers();
      } else {
        notify('Invalid household ID. Please try again.', 'error', 2000);
      }
    } catch (error) {
      console.error('Error changing household:', error);
      notify('Failed to change household. Please try again.', 'error', 2000);
    }
  }
  
  async loadHouseholdMembers(): Promise<void> {
    try {
      if (!this.householdId) {
        this.householdMembers = [];
        return;
      }

      // Fetch household members from Supabase
      const members = await this.supabaseService.getHouseholdMembers(this.householdId);
      this.householdMembers = members || [];
    } catch (error) {
      console.error('Error loading household members:', error);
      notify('Failed to load household members. Please try again.', 'error', 2000);
    }
  }
}
