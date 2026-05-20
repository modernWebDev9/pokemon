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

  ngOnInit(): void {
    console.log('TrainerProfileComponent initialized');

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

  getInitial(): string {
    const name = this.trainer()?.name;
    if (!name) return 'T';
    return name.charAt(0).toUpperCase();
  }

  getDisplayAvatarUrl(): string {
    const trainer = this.trainer();
    const preview = this.avatarPreviewUrl();
    if (preview) {
      return preview;
    }
    if (trainer?.avatarUrl && trainer.avatarUrl !== '') {
      return trainer.avatarUrl;
    }
    return '';
  }

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
          this.error.set('Avatar image could not be loaded. URL has been cleared.');
          setTimeout(() => this.error.set(null), 3000);
        },
        error: (err) => {
          console.error('Failed to clear avatar:', err);
        }
      });
    }
  }

  triggerFileUpload(): void {
    this.fileInput?.nativeElement.click();
  }

  /**
   * 이미지 압축 함수 - Canvas를 사용하여 이미지 크기 줄이기
   */
  compressImage(file: File, maxWidth: number = 200, maxHeight: number = 200, quality: number = 0.6): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 새 크기 계산 (종횡비 유지)
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          // Canvas로 이미지 리사이즈 및 압축
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // JPEG로 압축 (품질 0.6)
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          console.log(`Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(dataUrl.length / 1024).toFixed(1)}KB, ${width}x${height}`);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Handles file selection - compresses and converts to Base64
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      console.log('File selected:', file.name, file.type, (file.size / 1024).toFixed(1) + 'KB');

      if (!file.type.startsWith('image/')) {
        this.error.set('Please select an image file (JPG, PNG, GIF, WebP)');
        setTimeout(() => this.error.set(null), 3000);
        return;
      }

      // 더 엄격한 크기 제한: 200KB
      if (file.size > 200 * 1024) {
        this.error.set('Image size must be less than 200KB (will be compressed further)');
        setTimeout(() => this.error.set(null), 3000);
        return;
      }

      this.isUploading.set(true);
      this.error.set(null);

      try {
        // 이미지 압축 (200x200, 60% 품질)
        const compressedDataUrl = await this.compressImage(file, 200, 200, 0.6);
        
        // 최종 크기 확인 (100KB 미만 권장)
        if (compressedDataUrl.length > 150000) {
          this.error.set(`Image still too large after compression (${(compressedDataUrl.length / 1024).toFixed(1)}KB). Please use a smaller image.`);
          this.isUploading.set(false);
          setTimeout(() => this.error.set(null), 3000);
          return;
        }
        
        this.avatarPreviewUrl.set(compressedDataUrl);
        this.editAvatarUrl.set(compressedDataUrl);
        this.isUploading.set(false);
        this.success.set('Image compressed and loaded! Click Save to update.');
        setTimeout(() => this.success.set(null), 3000);
      } catch (err) {
        console.error('Compression error:', err);
        this.isUploading.set(false);
        this.error.set('Failed to process image. Please try another file.');
        setTimeout(() => this.error.set(null), 3000);
      }
      
      input.value = '';
    }
  }

  cancelUpload(): void {
    this.avatarPreviewUrl.set(null);
    this.editAvatarUrl.set(this.originalAvatarUrl());
    this.isUploading.set(false);
    this.error.set(null);
  }

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
  }

  cancelEdit(): void {
    this.cancelUpload();
    this.isEditing.set(false);
    this.error.set(null);
    this.success.set(null);
  }

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
      
      // 최종 크기 확인 (100KB 미만 권장)
      if (updates.avatarUrl && updates.avatarUrl.startsWith('data:image/')) {
        const sizeKB = updates.avatarUrl.length / 1024;
        console.log(`Final avatar size: ${sizeKB.toFixed(1)}KB`);
        if (sizeKB > 150) {
          this.error.set(`Avatar too large (${sizeKB.toFixed(1)}KB). Maximum allowed is 150KB.`);
          this.saving.set(false);
          return;
        }
      }
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
        
        // 더 자세한 에러 메시지
        if (err.message?.includes('500') || err.message?.includes('payload') || err.message?.includes('large')) {
          this.error.set('Avatar too large for server. Please use a very small image (max 100KB original).');
        } else {
          this.error.set(err.message || 'Failed to update profile');
        }
        
        this.editAvatarUrl.set(this.originalAvatarUrl());
        this.avatarPreviewUrl.set(null);
        
        setTimeout(() => this.error.set(null), 5000);
      }
    });
  }

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