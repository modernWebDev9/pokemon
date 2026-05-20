// src/app/features/team-builder/edit-team-dialog/edit-team-dialog.component.ts
import { Component, input, output, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Team } from '../../../state/trainer/trainer.store';

@Component({
  selector: 'app-edit-team-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-overlay" (click)="close()">
      <div class="dialog-panel" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h3>Edit Team</h3>
          <button class="close-btn" (click)="close()">✕</button>
        </div>
        
        <div class="dialog-body">
          <div class="form-group">
            <label>Team Name *</label>
            <input 
              type="text" 
              [(ngModel)]="teamName"
              placeholder="Enter team name"
              class="form-input" />
            @if (teamName().length > 0 && !isNameValid()) {
              <div class="error-hint">Name must be 3-30 characters</div>
            }
          </div>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="competitiveMode" />
              Competitive Mode
            </label>
          </div>
          
          @if (competitiveMode()) {
            <div class="form-group">
              <label>Tier</label>
              <select [(ngModel)]="selectedTier" class="form-input">
                <option [value]="null">Select Tier</option>
                <option value="OU">OU (OverUsed)</option>
                <option value="UU">UU (UnderUsed)</option>
                <option value="RU">RU (RarelyUsed)</option>
                <option value="NU">NU (NeverUsed)</option>
              </select>
            </div>
          }
        </div>
        
        <div class="dialog-footer">
          <button class="cancel-btn" (click)="close()">Cancel</button>
          <button class="save-btn" (click)="save()" [disabled]="!isNameValid()">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    .dialog-panel {
      background: white;
      border-radius: 16px;
      width: 450px;
      max-width: 90vw;
      box-shadow: 0 20px 35px rgba(0,0,0,0.2);
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
    }
    .dialog-header h3 { margin: 0; color: #2c3e50; }
    .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #999;
    }
    .close-btn:hover { color: #e74c3c; }
    .dialog-body { padding: 20px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    .form-input:focus { outline: none; border-color: #667eea; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .error-hint { font-size: 12px; color: #e74c3c; margin-top: 4px; }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid #eee;
    }
    .cancel-btn {
      padding: 8px 20px;
      background: #f0f0f0;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .cancel-btn:hover { background: #e0e0e0; }
    .save-btn {
      padding: 8px 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn:hover:not(:disabled) { transform: translateY(-2px); }
  `]
})
export class EditTeamDialogComponent implements OnInit {
  team = input<Team | null>(null);
  onSave = output<Partial<Team>>();
  onClose = output<void>();
  
  teamName = signal('');
  competitiveMode = signal(false);
  selectedTier = signal<'OU' | 'UU' | 'RU' | 'NU' | null>(null);
  
  isNameValid = computed(() => {
    const name = this.teamName().trim();
    return name.length >= 3 && name.length <= 30;
  });
  
  ngOnInit(): void {
    const teamData = this.team();
    if (teamData) {
      this.teamName.set(teamData.name);
      this.competitiveMode.set(teamData.competitiveMode);
      this.selectedTier.set(teamData.tier);
    }
  }
  
  save(): void {
    if (!this.isNameValid()) return;
    
    this.onSave.emit({
      name: this.teamName().trim(),
      competitiveMode: this.competitiveMode(),
      tier: this.competitiveMode() ? this.selectedTier() : null,
    });
  }
  
  close(): void {
    this.onClose.emit();
  }
}