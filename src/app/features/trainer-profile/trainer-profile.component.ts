// src/app/features/trainer-profile/trainer-profile.component.ts
import { Component, OnInit, inject, signal, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainerStore, Trainer, Battle } from '../../state/trainer/trainer.store';
import { HttpClient } from '@angular/common/http';

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
  private http = inject(HttpClient);

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

  // Avatar upload
  selectedFile = signal<File | null>(null);
  avatarPreviewUrl = signal<string | null>(null);
  avatarRefreshKey = signal(0);
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

  ngOnInit(): void {
    console.log('TrainerProfileComponent initialized');

    this.trainerStore.trainer$.subscribe(trainer => {
      console.log('Trainer updated:', trainer);
      this.trainer.set(trainer);
      if (trainer) {
        this.editName.set(trainer.name);
        this.editRegion.set(trainer.region);
        this.editRank.set(trainer.rank);
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
   * Gets the initial letter from trainer name for avatar placeholder
   */
  getInitial(): string {
    const name = this.trainer()?.name;
    if (!name) return 'T';
    return name.charAt(0).toUpperCase();
  }

  /**
   * Gets the display URL for trainer avatar
   * Returns preview URL for newly selected file or saved avatar URL
   */
  getDisplayAvatarUrl(): string {
    const trainer = this.trainer();
    if (!trainer) return '';

    // Show preview first if file is selected
    const preview = this.avatarPreviewUrl();
    if (preview) {
      console.log('Showing preview image');
      return preview;
    }

    // Show saved avatar
    if (trainer.avatarUrl && trainer.avatarUrl !== '') {
      console.log('=== Avatar Debug Info ===');
      console.log('Raw avatarUrl from store:', trainer.avatarUrl);

      // avatarUrl이 /avatars/로 시작하면 그대로 사용
      // Angular proxy가 /avatars를 http://localhost:3000/avatars로 프록시함
      console.log('Returning avatar URL:', trainer.avatarUrl);
      return trainer.avatarUrl;
    }

    console.log('No avatar URL found');
    return '';
  }

  /**
   * Gets avatar URL with cache buster to force reload
   */
  getAvatarWithCacheBuster(): string {
    const url = this.getDisplayAvatarUrl();
    if (!url) return '';

    if (url.startsWith('data:')) {
      return url;
    }

    return `${url}?t=${this.avatarRefreshKey()}`;
  }

  /**
   * Handles image loading errors
   */
  onImageError(event: Event): void {
    console.log('Image load error, falling back to initial');
    const trainer = this.trainer();
    if (trainer && trainer.avatarUrl) {
      // Clear invalid avatar URL using GraphQL mutation
      this.trainerStore.updateTrainer(trainer.id, { avatarUrl: '' }).subscribe({
        next: () => {
          this.avatarRefreshKey.update(v => v + 1);
        },
        error: (err) => {
          console.error('Failed to clear avatar:', err);
        }
      });
    }
  }

  /**
   * Triggers file input click for avatar upload
   */
  triggerFileUpload(): void {
    console.log('Triggering file upload');
    this.fileInput?.nativeElement.click();
  }

  /**
   * Handles file selection from input
   */
  onFileSelected(event: Event): void {
    console.log('File selected event triggered');
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      console.log('File selected:', file.name, file.type, file.size);

      if (!file.type.startsWith('image/')) {
        this.error.set('Please select an image file');
        setTimeout(() => this.error.set(null), 3000);
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        this.error.set('Image size must be less than 2MB');
        setTimeout(() => this.error.set(null), 3000);
        return;
      }

      this.selectedFile.set(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        console.log('Preview created');
        this.avatarPreviewUrl.set(previewUrl);
        this.avatarRefreshKey.update(v => v + 1);
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        this.error.set('Failed to read image file');
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Uploads avatar and updates via GraphQL mutation
   */
  uploadAvatar(): void {
    const file = this.selectedFile();
    const trainer = this.trainer();

    console.log('uploadAvatar called', { file: !!file, trainer: !!trainer, trainerId: trainer?.id });

    if (!file || !trainer) {
      console.error('Missing file or trainer');
      return;
    }

    this.isUploading.set(true);
    this.error.set(null);

    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('trainerId', trainer.id);

    console.log('Uploading file to avatar server...');
    console.log('FormData entries:');
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }

    // 1. 파일 업로드
    this.http.post('http://localhost:3000/api/upload-avatar', formData).subscribe({
      next: (response: any) => {
        console.log('Upload response received:', response);

        // avatarUrl만 있으면 성공으로 간주
        if (response.avatarUrl) {
          // 2. GraphQL mutation으로 avatar_url 업데이트
          console.log('Updating avatar URL via GraphQL mutation...', response.avatarUrl);
          this.trainerStore.updateTrainer(trainer.id, { avatarUrl: response.avatarUrl }).subscribe({
            next: (updatedTrainer) => {
              console.log('Trainer avatar updated successfully:', updatedTrainer);
              this.trainer.set(updatedTrainer);
              this.avatarRefreshKey.update(v => v + 1);

              this.isUploading.set(false);
              this.selectedFile.set(null);
              this.avatarPreviewUrl.set(null);
              this.success.set('Avatar updated successfully!');
              setTimeout(() => this.success.set(null), 3000);
            },
            error: (err) => {
              console.error('GraphQL update failed:', err);
              this.isUploading.set(false);
              this.error.set('Avatar uploaded but failed to update profile');
              setTimeout(() => this.error.set(null), 3000);
            }
          });
        } else {
          console.error('Invalid response - no avatarUrl:', response);
          this.isUploading.set(false);
          this.error.set(response.error || 'Upload failed');
          setTimeout(() => this.error.set(null), 3000);
        }
      },
      error: (err) => {
        console.error('Upload HTTP error:', err);
        this.isUploading.set(false);
        this.error.set('Upload failed. Make sure avatar server is running on port 3000');
        setTimeout(() => this.error.set(null), 3000);
      }
    });
  }

  /**
   * Cancels pending avatar upload
   */
  cancelUpload(): void {
    console.log('Cancel upload');
    this.selectedFile.set(null);
    this.avatarPreviewUrl.set(null);
    this.avatarRefreshKey.update(v => v + 1);
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  /**
   * Removes current avatar
   */
  removeAvatar(): void {
    const trainer = this.trainer();
    if (!trainer) return;

    // GraphQL mutation으로 avatar_url 제거
    this.trainerStore.updateTrainer(trainer.id, { avatarUrl: '' }).subscribe({
      next: (updatedTrainer) => {
        this.success.set('Avatar removed!');
        this.avatarRefreshKey.update(v => v + 1);
        this.trainer.set(updatedTrainer);
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err) => {
        console.error('Failed to remove avatar:', err);
        this.error.set('Failed to remove avatar');
        setTimeout(() => this.error.set(null), 3000);
      }
    });
  }

  /**
   * Enables edit mode
   */
  startEdit(): void {
    const current = this.trainer();
    if (current) {
      this.editName.set(current.name);
      this.editRegion.set(current.region);
      this.editRank.set(current.rank);
    }
    this.isEditing.set(true);
    this.error.set(null);
    this.success.set(null);
    console.log('Edit mode started');
  }

  /**
   * Cancels edit mode
   */
  cancelEdit(): void {
    this.cancelUpload();
    this.isEditing.set(false);
    this.error.set(null);
    console.log('Edit mode cancelled');
  }

  /**
   * Saves profile changes (name, region, rank)
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

    if (Object.keys(updates).length === 0) {
      this.isEditing.set(false);
      this.saving.set(false);
      return;
    }

    this.trainerStore.updateTrainer(trainer.id, updates).subscribe({
      next: (updatedTrainer) => {
        this.saving.set(false);
        this.isEditing.set(false);
        this.success.set('Profile updated successfully!');
        setTimeout(() => this.success.set(null), 3000);
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.error.set(err.message || 'Failed to update profile');
        setTimeout(() => this.error.set(null), 3000);
      }
    });
  }

  /**
   * Gets CSS class for rank badge styling
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