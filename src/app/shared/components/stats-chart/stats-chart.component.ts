import { Component, input, OnChanges, SimpleChanges, signal, effect, inject, ElementRef, ViewChild, AfterViewInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface Pokemon {
  id: number;
  name: string;
  stats: PokemonStats;
}

@Component({
  selector: 'app-stats-chart',
  standalone: true,
  imports: [],
  template: `
    <div class="stats-chart-container">
      <canvas #statsCanvas width="400" height="400"></canvas>
      @if (statsLabels.length) {
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-color"></span>
            <span class="legend-label">{{ (pokemon()?.name || 'Pokémon') + ' Stats' }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .stats-chart-container {
      position: relative;
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
      padding: 16px;
      background: var(--bg-secondary, #0f0f0f);
      border-radius: 24px;
      border: 1px solid var(--border-light, rgba(255, 255, 255, 0.08));
      transition: all 0.3s ease;
    }
    
    .stats-chart-container:hover {
      transform: translateY(-2px);
      border-color: rgba(0, 245, 255, 0.3);
    }
    
    canvas {
      display: block;
      width: 100% !important;
      height: auto !important;
      max-height: 300px;
    }
    
    .chart-legend {
      text-align: center;
      margin-top: 16px;
    }
    
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary, #a0a0a0);
    }
    
    .legend-color {
      width: 16px;
      height: 16px;
      background: linear-gradient(135deg, #00f5ff, #b300ff);
      border-radius: 4px;
      display: inline-block;
    }
    
    .legend-label {
      font-weight: 500;
    }
    
    /* Light Theme */
    [data-theme="light"] .stats-chart-container {
      background: #f8f9fa;
      border-color: rgba(0, 0, 0, 0.08);
    }
    
    [data-theme="light"] .stats-chart-container:hover {
      border-color: rgba(0, 245, 255, 0.5);
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .stats-chart-container {
        padding: 12px;
      }
      
      canvas {
        max-height: 250px;
      }
    }
  `]
})
export class StatsChartComponent implements AfterViewInit, OnChanges {
  private platformId = inject(PLATFORM_ID);
  private chartInstance: Chart | null = null;
  
  @ViewChild('statsCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  pokemon = input<Pokemon | null>(null);
  
  statsLabels = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
  private animationProgress = signal(0);
  
  constructor() {
    // Set up animation effect
    effect(() => {
      const progress = this.animationProgress();
      const pokemon = this.pokemon();
      if (pokemon && this.chartInstance && progress < 1) {
        this.updateChartData(progress);
      }
    });
  }
  
  /**
   * Initializes the radar chart after the view is ready
   */
  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.createChart();
    }
  }
  
  /**
   * Responds to Pokémon input changes by triggering a chart animation
   *
   * @param changes - Angular SimpleChanges object
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pokemon'] && this.chartInstance) {
      this.startAnimation();
    } else if (changes['pokemon'] && !this.chartInstance && this.canvasRef) {
      this.createChart();
    }
  }
  
  /**
   * Returns stat values normalized to a 0–100 percentage scale for the radar chart
   *
   * @returns Array of 6 percentage values [hp, atk, def, spAtk, spDef, spd]
   */
  private getStatValues(): number[] {
    const pokemon = this.pokemon();
    if (!pokemon || !pokemon.stats) {
      return [0, 0, 0, 0, 0, 0];
    }
    
    const maxStat = 255;
    const s = pokemon.stats;
    return [
      (s.hp / maxStat) * 100,
      (s.attack / maxStat) * 100,
      (s.defense / maxStat) * 100,
      (s.specialAttack / maxStat) * 100,
      (s.specialDefense / maxStat) * 100,
      (s.speed / maxStat) * 100
    ];
  }
  
  /**
   * Returns the raw (non-normalized) stat values for tooltip display
   *
   * @returns Array of 6 raw stat values [hp, atk, def, spAtk, spDef, spd]
   */
  private getFullStatValues(): number[] {
    const pokemon = this.pokemon();
    if (!pokemon || !pokemon.stats) {
      return [0, 0, 0, 0, 0, 0];
    }
    
    const s = pokemon.stats;
    return [s.hp, s.attack, s.defense, s.specialAttack, s.specialDefense, s.speed];
  }
  
  /**
   * Get current theme mode by checking data-theme attribute on document body
   */
  private isDarkTheme(): boolean {
    if (typeof window === 'undefined') return true;
    const htmlElement = document.documentElement;
    const theme = htmlElement.getAttribute('data-theme');
    // Default to dark theme check if no attribute is set
    if (!theme) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  }
  
  /**
   * Listen for theme changes and update chart colors
   */
  private setupThemeObserver(): void {
    if (typeof window === 'undefined') return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          this.updateChartColors();
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
  }
  
  /**
   * Update chart colors based on current theme
   */
  private updateChartColors(): void {
    if (!this.chartInstance) return;
    
    const isDark = this.isDarkTheme();
    
    // Update grid colors
    if (this.chartInstance.options.scales?.['r']) {
      const rScale = this.chartInstance.options.scales['r'] as any;
      if (rScale.grid) {
        rScale.grid.color = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
      }
      if (rScale.angleLines) {
        rScale.angleLines.color = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
      }
      if (rScale.ticks) {
        rScale.ticks.color = isDark ? '#a0a0a0' : '#666';
      }
      if (rScale.pointLabels) {
        rScale.pointLabels.color = isDark ? '#a0a0a0' : '#666';
      }
    }
    
    // Update dataset border and point colors for better visibility in dark mode
    if (this.chartInstance.data.datasets[0]) {
      const dataset = this.chartInstance.data.datasets[0];
      if (isDark) {
        dataset.borderColor = '#00f5ff';
        dataset.backgroundColor = 'rgba(0, 245, 255, 0.25)';
        dataset.borderWidth = 3;
      } else {
        dataset.borderColor = 'rgba(0, 245, 255, 1)';
        dataset.backgroundColor = 'rgba(0, 245, 255, 0.2)';
        dataset.borderWidth = 2;
      }
    }
    
    this.chartInstance.update('none');
  }
  
  /**
   * Creates the Chart.js radar chart instance with full configuration
   */
  private createChart(): void {
    if (!this.canvasRef || !this.canvasRef.nativeElement) return;
    
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    const isDark = this.isDarkTheme();
    
    const config: ChartConfiguration = {
      type: 'radar' as ChartType,
      data: {
        labels: this.statsLabels,
        datasets: [
          {
            label: this.pokemon()?.name || 'Pokémon Stats',
            data: [0, 0, 0, 0, 0, 0],
            backgroundColor: isDark ? 'rgba(0, 245, 255, 0.25)' : 'rgba(0, 245, 255, 0.2)',
            borderColor: isDark ? '#00f5ff' : 'rgba(0, 245, 255, 1)',
            borderWidth: isDark ? 3 : 2,
            pointBackgroundColor: isDark ? '#b300ff' : 'rgba(179, 0, 255, 1)',
            pointBorderColor: '#ffffff',
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: isDark ? '#b300ff' : 'rgba(179, 0, 255, 1)',
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1
          } as any  // Type assertion to avoid Chart.js type strictness
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 0
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: {
              stepSize: 20,
              backdropColor: 'transparent',
              color: isDark ? '#a0a0a0' : '#666',
              display: true
            },
            grid: {
              color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
              circular: false,
              lineWidth: 1
            },
            angleLines: {
              color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
              lineWidth: 1
            },
            pointLabels: {
              font: {
                size: 11,
                weight: 'bold'
              },
              color: isDark ? '#a0a0a0' : '#666'
            },
            title: {
              display: false
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const index = context.dataIndex;
                const percentage = context.raw as number;
                const actualValue = this.getFullStatValues()[index];
                return `${this.statsLabels[index]}: ${actualValue} (${percentage.toFixed(0)}%)`;
              }
            },
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            titleColor: '#fff',
            bodyColor: '#ddd',
            borderColor: '#00f5ff',
            borderWidth: 1
          },
          legend: {
            display: false
          }
        },
        elements: {
          line: {
            borderWidth: isDark ? 3 : 2
          },
          point: {
            hoverBorderWidth: 2
          }
        }
      }
    };
    
    this.chartInstance = new Chart(ctx, config);
    this.setupThemeObserver();
    this.startAnimation();
  }
  
  /**
   * Resets animation progress and starts the eased animation sequence
   */
  private startAnimation(): void {
    this.animationProgress.set(0);
    this.animate(0);
  }
  
  /**
   * Runs a requestAnimationFrame loop with ease-out cubic easing
   *
   * @param startTime - The timestamp when the animation began
   */
  private animate(startTime: number): void {
    const duration = 1000;
    const step = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic animation
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.animationProgress.set(easedProgress);
      
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    
    requestAnimationFrame((timestamp) => {
      startTime = timestamp;
      requestAnimationFrame(step);
    });
  }
  
  /**
   * Updates the chart dataset with interpolated values based on animation progress
   *
   * @param progress - Animation progress value between 0 and 1
   */
  private updateChartData(progress: number): void {
    if (!this.chartInstance) return;
    
    const targetValues = this.getStatValues();
    const currentValues = targetValues.map(v => v * progress);
    
    this.chartInstance.data.datasets[0].data = currentValues;
    this.chartInstance.data.datasets[0].label = this.pokemon()?.name || 'Pokémon Stats';
    this.chartInstance.update('none');
  }
}