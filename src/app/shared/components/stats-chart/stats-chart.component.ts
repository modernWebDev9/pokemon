// src/app/shared/components/stats-chart/stats-chart.component.ts
import { Component, input, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { Pokemon } from '../../../state/pokemon/pokemon.store';

@Component({
  selector: 'app-stats-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-container">
      <canvas #statsCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      height: 350px;
      width: 100%;
      background: transparent;
      border-radius: 16px;
      padding: 16px;
    }
  `]
})
export class StatsChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('statsCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  pokemon = input<Pokemon | null>(null);
  
  private chart: Chart | null = null;
  private isViewInitialized = false;
  private currentTheme: string = 'dark';
  
  private updateEffect = effect(() => {
    const pokemon = this.pokemon();
    if (pokemon && this.isViewInitialized) {
      setTimeout(() => {
        this.updateChart(pokemon);
      }, 50);
    }
  });
  
  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    this.observeThemeChanges();
    setTimeout(() => {
      const pokemon = this.pokemon();
      if (pokemon) {
        this.initChart(pokemon);
      }
    }, 100);
  }
  
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
  
  private getChartColors() {
    const isDark = this.currentTheme === 'dark';
    return {
      gridColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
      labelColor: isDark ? '#a0a0a0' : '#475569',
      backgroundColor: isDark ? 'rgba(0, 245, 255, 0.15)' : 'rgba(102, 126, 234, 0.15)',
      borderColor: isDark ? '#00f5ff' : '#667eea',
      pointColor: isDark ? '#00f5ff' : '#667eea',
      tooltipBg: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      tooltipText: isDark ? '#ffffff' : '#1a1a1a'
    };
  }
  
  private recreateChart(): void {
    const pokemon = this.pokemon();
    if (pokemon && this.isViewInitialized) {
      this.initChart(pokemon);
    }
  }
  
  private initChart(pokemon: Pokemon): void {
    this.destroyChart();
    
    if (!this.canvasRef?.nativeElement) return;
    
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    const stats = pokemon.stats;
    const colors = this.getChartColors();
    
    this.chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'],
        datasets: [{
          label: 'Base Stats',
          data: [
            stats.hp,
            stats.attack,
            stats.defense,
            stats.specialAttack,
            stats.specialDefense,
            stats.speed
          ],
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 2,
          pointBackgroundColor: colors.pointColor,
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: colors.pointColor,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 255,
            ticks: {
              stepSize: 50,
              backdropColor: 'transparent',
              color: colors.labelColor,
            },
            grid: {
              color: colors.gridColor,
              circular: true,
            },
            pointLabels: {
              color: colors.labelColor,
              font: {
                size: 11,
                weight: 'bold' as const,
              }
            }
          }
        },
        plugins: {
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw as number;
                return `${label}: ${value}`;
              }
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 12, weight: 'bold' as const },
              color: colors.labelColor,
              usePointStyle: true,
              pointStyle: 'circle',
            }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeOutBounce',
        }
      }
    });
  }
  
  private updateChart(pokemon: Pokemon): void {
    if (!this.chart) {
      this.initChart(pokemon);
      return;
    }
    
    const stats = pokemon.stats;
    const colors = this.getChartColors();
    
    // Update chart data
    this.chart.data.datasets[0].data = [
      stats.hp,
      stats.attack,
      stats.defense,
      stats.specialAttack,
      stats.specialDefense,
      stats.speed
    ];
    
    // Update colors for theme
    if (this.chart.options.scales && this.chart.options.scales['r']) {
      const rScale = this.chart.options.scales['r'] as any;
      if (rScale.ticks) rScale.ticks.color = colors.labelColor;
      if (rScale.pointLabels) rScale.pointLabels.color = colors.labelColor;
      if (rScale.grid) rScale.grid.color = colors.gridColor;
    }
    
    if (this.chart.options.plugins?.legend?.labels) {
      this.chart.options.plugins.legend.labels.color = colors.labelColor;
    }
    
    // Update dataset colors
    this.chart.data.datasets[0].backgroundColor = colors.backgroundColor;
    this.chart.data.datasets[0].borderColor = colors.borderColor;
    (this.chart.data.datasets[0] as any).pointBackgroundColor = colors.pointColor;
    (this.chart.data.datasets[0] as any).pointHoverBorderColor = colors.pointColor;
    
    this.chart.update();
  }
  
  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
  
  ngOnDestroy(): void {
    this.destroyChart();
    this.isViewInitialized = false;
  }
}