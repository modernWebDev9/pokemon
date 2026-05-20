// src/app/app.component.ts
import { Component, ChangeDetectionStrategy, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  private router = inject(Router);
  
  isDarkMode = signal<boolean>(true);
  
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
}