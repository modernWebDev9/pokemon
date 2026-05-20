/**
 * Edit Team Dialog Component - Modal dialog for editing team details
 * Allows editing team name, competitive mode, and battle tier
 */
import { Component, input, output, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Team } from '../../../state/trainer/trainer.store';

@Component({
  selector: 'app-edit-team-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-team-dialog.component.html',
  styleUrls: ['./edit-team-dialog.component.scss']
})
export class EditTeamDialogComponent implements OnInit {
  team = input.required<Team>();
  save = output<Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId' | 'pokemonIds'>>>();
  close = output<void>();
  
  editName = signal('');
  editCompetitiveMode = signal(false);
  editTier = signal<'OU' | 'UU' | 'RU' | 'NU' | null>(null);
  
  ngOnInit(): void {
    // Initialize with team data
    const team = this.team();
    this.editName.set(team.name);
    this.editCompetitiveMode.set(team.competitiveMode);
    this.editTier.set(team.tier);
  }
  
  /**
   * Validates form inputs
   */
  isValid = computed(() => {
    const name = this.editName().trim();
    const nameValid = name.length >= 3 && name.length <= 30;
    
    // If competitive mode is on, tier must be selected
    if (this.editCompetitiveMode() && !this.editTier()) {
      return false;
    }
    
    return nameValid;
  });
  
  /**
   * Handles competitive mode change
   * Resets tier when competitive mode is disabled
   */
  onCompetitiveModeChange(isCompetitive: boolean): void {
    if (!isCompetitive) {
      this.editTier.set(null);
    }
  }
  
  /**
   * Saves changes and emits update event
   */
  onSave(): void {
    if (!this.isValid()) return;
    
    const updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId' | 'pokemonIds'>> = {
      name: this.editName().trim(),
      competitiveMode: this.editCompetitiveMode(),
      tier: this.editCompetitiveMode() ? this.editTier() : null
    };
    
    this.save.emit(updates);
  }
  
  /**
   * Closes the dialog
   */
  onClose(): void {
    this.close.emit();
  }
}