// src/app/features/battle-log/battle-chart/battle-chart.component.ts
import { Component, input, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';

export interface MonthlyBattleData {
  month: string;
  wins: number;
  losses: number;
}

@Component({
  selector: 'app-battle-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-container">
      <canvas #battleCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      height: 400px;
      width: 100%;
      background: transparent;
      border-radius: 16px;
      padding: 16px;
    }
  `]
})
export class BattleChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('battleCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  battles = input<MonthlyBattleData[]>([]);
  
  private chart: Chart | null = null;
  private isViewInitialized = false;
  private currentTheme: string = 'dark';
  
  constructor() {
    // Effect to update chart when battle data changes
    effect(() => {
      const data = this.battles();
      if (data && data.length > 0 && this.isViewInitialized) {
        setTimeout(() => {
          this.updateChart(data);
        });
      }
    });
  }
  
  /**
   * Initializes the chart after the view is ready and starts observing theme changes
   */
  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    this.observeThemeChanges();
    setTimeout(() => {
      this.initChart();
    }, 100);
  }
  
  /**
   * Sets up a MutationObserver to detect data-theme attribute changes
   * and recreate the chart with updated colors
   */
  private observeThemeChanges(): void {
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      if (newTheme !== this.currentTheme) {
        this.currentTheme = newTheme;
        this.recreateChart();
      }
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }
  
  /**
   * Destroys and recreates the chart to apply new theme colors
   */
  private recreateChart(): void {
    const data = this.battles();
    if (data && data.length > 0) {
      this.initChart();
    }
  }
  
  /**
   * Returns color configuration based on the current theme
   *
   * @returns Object containing grid, text, wins, and losses color values
   */
  private getChartColors() {
    const isDark = this.currentTheme === 'dark';
    return {
      gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      textColor: isDark ? '#a0a0a0' : '#475569',
      winsColor: 'rgba(16, 185, 129, 0.8)',
      winsBorder: '#10b981',
      lossesColor: 'rgba(239, 68, 68, 0.8)',
      lossesBorder: '#ef4444'
    };
  }
  
  /**
   * Creates and renders the Chart.js bar chart with wins/losses data
   */
  private initChart(): void {
    this.destroyChart();
    
    if (!this.canvasRef?.nativeElement) return;
    
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    const data = this.battles();
    const colors = this.getChartColors();
    
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: 'Wins',
            data: data.map(d => d.wins),
            backgroundColor: colors.winsColor,
            borderColor: colors.winsBorder,
            borderWidth: 2,
            borderRadius: 8,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          },
          {
            label: 'Losses',
            data: data.map(d => d.losses),
            backgroundColor: colors.lossesColor,
            borderColor: colors.lossesBorder,
            borderWidth: 2,
            borderRadius: 8,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 13, weight: 'bold' },
              color: colors.textColor,
              usePointStyle: true,
              pointStyle: 'circle',
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#ddd',
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.raw as number;
                return `${label}: ${value} battle${value !== 1 ? 's' : ''}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Battles',
              font: { weight: 'bold', size: 12 },
              color: colors.textColor
            },
            grid: {
              color: colors.gridColor
            },
            ticks: {
              stepSize: 1,
              precision: 0,
              color: colors.textColor
            }
          },
          x: {
            title: {
              display: true,
              text: 'Month',
              font: { weight: 'bold', size: 12 },
              color: colors.textColor
            },
            grid: {
              display: false
            },
            ticks: {
              color: colors.textColor
            }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeOutQuad',
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        hover: {
          mode: 'index',
          intersect: false,
        }
      }
    });
  }
  
  /**
   * Updates the existing chart with new battle data
   *
   * @param data - Array of monthly battle statistics
   */
  private updateChart(data: MonthlyBattleData[]): void {
    if (!this.chart) {
      this.initChart();
      return;
    }
    
    this.chart.data.labels = data.map(d => d.month);
    this.chart.data.datasets[0].data = data.map(d => d.wins);
    this.chart.data.datasets[1].data = data.map(d => d.losses);
    this.chart.update();
  }
  
  /**
   * Destroys the Chart.js instance and frees its resources
   */
  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
  
  /**
   * Cleans up the chart instance on component destruction
   */
  ngOnDestroy(): void {
  }
}