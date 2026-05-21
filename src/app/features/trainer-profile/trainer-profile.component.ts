import { Component, OnInit, inject, signal, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainerStore, Trainer, Battle } from '../../state/trainer/trainer.store';

@Component({
  selector: 'app-trainer-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trainer-profile.component.html',
  styleUrls: ['./trainer-profile.component.scss']
})
export class TrainerProfileComponent implements OnInit {
  private trainerStore = inject(TrainerStore);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  trainer = signal<Trainer | null>(null);

  wins = signal(0);
  losses = signal(0);
  totalBattles = signal(0);
  winRate = signal(0);

  // Edit mode
  isEditing = signal(false);
  isUploading = signal(false);
  saving = signal(false);

  editName = signal('');
  editRegion = signal('');
  editRank = signal('');
  editAvatarUrl = signal('');
  
  // Avatar preview for newly selected file
  avatarPreviewUrl = signal<string | null>(null);
  originalAvatarUrl = signal<string>('');

  error = signal<string | null>(null);
  success = signal<string | null>(null);

  regions = [
    'Kanto', 'Johto', 'Hoenn', 'Sinnoh',
    'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'
  ];

  ranks = [
    'Trainer', 'Gym Leader', 'Elite Four',
    'Champion', 'Master', 'Legend'
  ];

  // Max file size: 500KB = 500 * 1024 = 512,000 bytes
  private readonly MAX_FILE_SIZE = 500 * 1024;

  /**
   * Initializes the component by loading trainer and battle data from the store
   */
  ngOnInit(): void {

    this.trainerStore.trainer$.subscribe(trainer => {
      console.log('Trainer updated:', trainer);
      this.trainer.set(trainer);
      if (trainer) {
        this.editName.set(trainer.name);
        this.editRegion.set(trainer.region);
        this.editRank.set(trainer.rank);
        this.editAvatarUrl.set(trainer.avatarUrl || '');
        this.originalAvatarUrl.set(trainer.avatarUrl || '');
        
        if (trainer.avatarUrl && trainer.avatarUrl.startsWith('data:image/')) {
          this.avatarPreviewUrl.set(trainer.avatarUrl);
        } else {
          this.avatarPreviewUrl.set(null);
        }
      }
    });

    this.trainerStore.battles$.subscribe((battles: Battle[]) => {
      const winsCount = battles.filter((b: Battle) => b.result === 'win').length;
      const lossesCount = battles.filter((b: Battle) => b.result === 'loss').length;
      const total = battles.length;
      const rate = total > 0 ? Math.round((winsCount / total) * 100) : 0;

      this.wins.set(winsCount);
      this.losses.set(lossesCount);
      this.totalBattles.set(total);
      this.winRate.set(rate);
    });
  }

  /**
   * Returns the first letter of the trainer's name as an avatar fallback initial
   *
   * @returns Single uppercase character
   */
  getInitial(): string {
    const name = this.trainer()?.name;
    if (!name) return 'T';
    return name.charAt(0).toUpperCase();
  }

  /**
   * Returns the URL to display for the trainer avatar.
   * Prefers a newly selected preview over the stored URL.
   *
   * @returns Avatar URL string, or empty string if none
   */
  getDisplayAvatarUrl(): string {
    const preview = this.avatarPreviewUrl();
    if (preview) {
      return preview;
    }
    if (this.trainer()?.avatarUrl) {
      return this.trainer()!.avatarUrl;
    }
    return '';
  }

  /**
   * Handles avatar image load errors by clearing the stored URL
   * and showing an error message to the user
   *
   * @param event - The image error event
   */
  onImageError(event: Event): void {
    console.log('Image load error, clearing avatar URL');
    const trainer = this.trainer();
    if (trainer && trainer.avatarUrl) {
      this.trainerStore.updateTrainer(trainer.id, { avatarUrl: '' }).subscribe({
        next: (updatedTrainer) => {
          this.trainer.set(updatedTrainer);
          this.editAvatarUrl.set('');
          this.avatarPreviewUrl.set(null);
          this.originalAvatarUrl.set('');
          this.error.set('Avatar image could not be loaded. Please upload a new image.');
          setTimeout(() => this.error.set(null), 3000);
        },
        error: (err) => {
          console.error('Failed to clear avatar:', err);
        }
      });
    }
  }

  /**
   * Programmatically triggers the hidden file input element
   */
  triggerFileUpload(): void {
    this.fileInput?.nativeElement.click();
  }

  /**
   * Handles file selection - Max file size: 100KB
   * No Base64 size limit check - only original file size matters
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const fileSizeKB = (file.size / 1024).toFixed(1);
      console.log('File selected:', file.name, file.type, fileSizeKB + 'KB');

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.error.set('Please select an image file (JPG, PNG, GIF, WebP)');
        setTimeout(() => this.error.set(null), 3000);
        return;
      }

      // Check file size against 500KB limit only
      if (file.size > this.MAX_FILE_SIZE) {
        this.error.set(`Image size must be less than 70KB (Current: ${fileSizeKB}KB). Please compress your image.`);
        setTimeout(() => this.error.set(null), 3000);
        return;
      }

      this.isUploading.set(true);
      this.error.set(null);

      // Convert to Base64 Data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64SizeKB = (dataUrl.length / 1024).toFixed(1);
        console.log('Base64 size:', base64SizeKB + 'KB');
        
        // Store the Base64 Data URL - no additional size check
        this.avatarPreviewUrl.set(dataUrl);
        this.editAvatarUrl.set(dataUrl);
        
        this.isUploading.set(false);
        this.success.set('Image loaded! Click Save to update your avatar.');
        setTimeout(() => this.success.set(null), 3000);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        this.isUploading.set(false);
        this.error.set('Failed to read image file');
        setTimeout(() => this.error.set(null), 3000);
      };
      reader.readAsDataURL(file);
      
      input.value = '';
    }
  }

  /**
   * Cancels a pending avatar upload and restores the original avatar URL
   */
  cancelUpload(): void {
    this.avatarPreviewUrl.set(null);
    this.editAvatarUrl.set(this.originalAvatarUrl());
    this.isUploading.set(false);
    this.error.set(null);
  }

  /**
   * Enters edit mode and pre-populates form fields with current trainer data
   */
  startEdit(): void {
    const current = this.trainer();
    if (current) {
      this.editName.set(current.name);
      this.editRegion.set(current.region);
      this.editRank.set(current.rank);
      this.editAvatarUrl.set(current.avatarUrl || '');
      this.originalAvatarUrl.set(current.avatarUrl || '');
      
      if (current.avatarUrl && current.avatarUrl.startsWith('data:image/')) {
        this.avatarPreviewUrl.set(current.avatarUrl);
      } else {
        this.avatarPreviewUrl.set(null);
      }
    }
    this.isEditing.set(true);
    this.error.set(null);
    this.success.set(null);
    console.log('Edit mode started');
  }

  /**
   * Exits edit mode without saving changes
   */
  cancelEdit(): void {
    this.cancelUpload();
    this.isEditing.set(false);
    this.error.set(null);
    this.success.set(null);
    console.log('Edit mode cancelled');
  }

  /**
   * Saves changed profile fields to the server.
   * Only sends fields that have actually changed.
   */
  saveProfile(): void {
    const trainer = this.trainer();
    if (!trainer) return;

    this.saving.set(true);
    this.error.set(null);

    const updates: Partial<Trainer> = {};

    if (this.editName() !== trainer.name) {
      updates.name = this.editName();
    }
    if (this.editRegion() !== trainer.region) {
      updates.region = this.editRegion();
    }
    if (this.editRank() !== trainer.rank) {
      updates.rank = this.editRank();
    }
    if (this.editAvatarUrl() !== (trainer.avatarUrl || '')) {
      updates.avatarUrl = this.editAvatarUrl();
    }

    if (Object.keys(updates).length === 0) {
      this.isEditing.set(false);
      this.saving.set(false);
      return;
    }

    this.trainerStore.updateTrainer(trainer.id, updates).subscribe({
      next: (updatedTrainer) => {
        this.saving.set(false);
        this.isEditing.set(false);
        this.avatarPreviewUrl.set(null);
        this.originalAvatarUrl.set(updatedTrainer.avatarUrl || '');
        this.success.set('Profile updated successfully!');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err: Error) => {
        this.saving.set(false);
        console.error('Save error:', err);
        
        if (err.message?.includes('413') || err.message?.includes('payload') || err.message?.includes('large')) {
          this.error.set('Avatar too large. Please use an image smaller than 100KB.');
        } else {
          this.error.set(err.message || 'Failed to update profile');
        }
        
        this.editAvatarUrl.set(this.originalAvatarUrl());
        this.avatarPreviewUrl.set(null);
        
        setTimeout(() => this.error.set(null), 5000);
      }
    });
  }

  /**
   * Returns the CSS class corresponding to the trainer's rank
   *
   * @param rank - The trainer rank string
   * @returns CSS class name for the rank badge
   */
  getRankClass(rank: string): string {
    const rankMap: Record<string, string> = {
      'Trainer': 'rank-trainer',
      'Gym Leader': 'rank-gym',
      'Elite Four': 'rank-elite',
      'Champion': 'rank-champion',
      'Master': 'rank-master',
      'Legend': 'rank-legend'
    };
    return rankMap[rank] || 'rank-trainer';
  }
}