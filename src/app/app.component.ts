/**
 * App Component - Main application component with navigation and theme management
 */
import { Component, ChangeDetectionStrategy, signal, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TrainerStore, Trainer } from './state/trainer/trainer.store';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private trainerStore = inject(TrainerStore);
  
  isDarkMode = signal<boolean>(true);
  
  // Trainer data from store
  trainer = toSignal(this.trainerStore.trainer$, { initialValue: null });
  
  constructor() {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    this.isDarkMode.set(savedTheme === 'dark' || (!savedTheme && prefersDark));
    this.applyTheme();
    
    // Effect to save theme preference
    effect(() => {
      localStorage.setItem('theme', this.isDarkMode() ? 'dark' : 'light');
      this.applyTheme();
    });
  }
  
  ngOnInit(): void {
    // Load trainer data on component initialization
    this.trainerStore.setCurrentTrainer('1');
  }
  
  /**
   * Navigate to home page (Pokédex)
   */
  goToHome(): void {
    this.router.navigate(['/pokedex']);
  }
  
  /**
   * Navigate to profile page
   */
  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
  
  /**
   * Toggle between dark and light theme
   */
  toggleTheme(): void {
    this.isDarkMode.update(value => !value);
  }
  
  /**
   * Apply theme to document
   */
  private applyTheme(): void {
    const theme = this.isDarkMode() ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.style.backgroundColor = theme === 'dark' ? '#0a0a0a' : '#f8fafc';
  }
  
  /**
   * Handle avatar image loading errors
   * Shows fallback initial when image fails to load
   *
   * @param event - Image error event
   */
  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    // The fallback initial will be shown by the @else block in the template
  }
}