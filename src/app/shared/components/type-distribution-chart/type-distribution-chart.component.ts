/**
 * Type Distribution Chart Component - Doughnut chart for team type distribution
 * Displays Pokémon type distribution within a team using Chart.js
 */
import { Component, input, ElementRef, ViewChild, AfterViewInit, OnDestroy, PLATFORM_ID, inject, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';

Chart.register(...registerables);

export interface TypeData {
  type: string;
  count: number;
  color: string;
}

@Component({
  selector: 'app-type-distribution-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-wrapper">
      <canvas #chartCanvas></canvas>
      <div class="chart-legend" *ngIf="types().length > 0">
        <div class="legend-items">
          @for (item of types(); track item.type) {
            <div class="legend-item">
              <span class="legend-color" [style.backgroundColor]="item.color"></span>
              <span class="legend-label">{{ item.type }}</span>
              <span class="legend-count">({{ item.count }})</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-wrapper {
      position: relative;
      width: 100%;
      margin: 0 auto;
      background: var(--bg-secondary, #0f0f0f);
      border-radius: 20px;
      padding: 20px;
      transition: all 0.3s ease;
    }
    
    .chart-wrapper:hover {
      transform: translateY(-2px);
      background: var(--bg-tertiary, #252525);
    }
    
    canvas {
      max-height: 250px;
      width: 100% !important;
    }
    
    .chart-legend {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border-light, rgba(255, 255, 255, 0.08));
    }
    
    .legend-items {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 20px;
    }
    
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      padding: 4px 8px;
      background: var(--bg-secondary, #0f0f0f);
      border-radius: 30px;
      transition: all 0.2s;
    }
    
    .legend-item:hover {
      transform: translateY(-2px);
      background: rgba(0, 245, 255, 0.05);
    }
    
    .legend-color {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      display: inline-block;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    
    .legend-label {
      color: var(--text-primary, white);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: capitalize;
    }
    
    .legend-count {
      color: var(--text-secondary, #a0a0a0);
      font-size: 0.7rem;
      font-weight: 500;
    }
    
    /* Light Theme */
    [data-theme="light"] .chart-wrapper {
      background: #f8f9fa;
    }
    
    [data-theme="light"] .chart-wrapper:hover {
      background: #f0f0f0;
    }
    
    [data-theme="light"] .legend-item {
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    
    [data-theme="light"] .legend-item:hover {
      background: #f0f0f0;
    }
    
    [data-theme="light"] .legend-label {
      color: #1a1a1a;
    }
    
    [data-theme="light"] .legend-count {
      color: #666;
    }
    
    [data-theme="light"] .chart-legend {
      border-top-color: #e0e0e0;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .chart-wrapper {
        padding: 16px;
      }
      
      .legend-items {
        gap: 12px;
      }
      
      .legend-item {
        padding: 3px 6px;
        gap: 6px;
      }
      
      .legend-label, .legend-count {
        font-size: 0.65rem;
      }
      
      canvas {
        max-height: 200px;
      }
    }
  `]
})
export class TypeDistributionChartComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private chartInstance: Chart | null = null;
  
  @ViewChild('chartCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  types = input<TypeData[]>([]);
  
  // Chart data
  private chartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderWidth: 0,
      hoverOffset: 10
    }]
  };
  
  // Chart options
  private chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '60%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw as number;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#ccc',
        borderColor: '#00f5ff',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    layout: {
      padding: 10
    }
  };
  
  constructor() {
    // Effect to update chart when types change
    effect(() => {
      const types = this.types();
      if (this.chartInstance && types.length > 0) {
        this.updateChart(types);
      } else if (this.chartInstance && types.length === 0) {
        this.clearChart();
      }
    });
  }
  
  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId) && this.canvasRef) {
      this.createChart();
    }
  }
  
  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
  
  private createChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: this.chartData,
      options: this.chartOptions
    });
    
    const types = this.types();
    if (types.length > 0) {
      this.updateChart(types);
    }
  }
  
  private updateChart(types: TypeData[]): void {
    if (!this.chartInstance) return;
    
    const sortedTypes = [...types].sort((a, b) => b.count - a.count);
    
    this.chartInstance.data.labels = sortedTypes.map(t => t.type);
    this.chartInstance.data.datasets[0].data = sortedTypes.map(t => t.count);
    this.chartInstance.data.datasets[0].backgroundColor = sortedTypes.map(t => t.color);
    
    this.chartInstance.update();
  }
  
  private clearChart(): void {
    if (!this.chartInstance) return;
    
    this.chartInstance.data.labels = [];
    this.chartInstance.data.datasets[0].data = [];
    this.chartInstance.data.datasets[0].backgroundColor = [];
    this.chartInstance.update();
  }
}