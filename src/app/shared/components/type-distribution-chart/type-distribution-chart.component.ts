// src/app/shared/components/type-distribution-chart/type-distribution-chart.component.ts
import { Component, input, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectionStrategy, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';

export interface TypeData {
  type: string;
  count: number;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC'
};

@Component({
  selector: 'app-type-distribution-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-container">
      <canvas #pieCanvas></canvas>
      <div class="chart-placeholder" *ngIf="types().length === 0">
        <span>🎯 No Pokémon selected</span>
        <p>Add Pokémon to see type distribution</p>
      </div>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      height: 350px;
      width: 100%;
      background: white;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chart-placeholder {
      text-align: center;
      color: #999;
    }
    .chart-placeholder span {
      font-size: 48px;
      display: block;
      margin-bottom: 8px;
    }
    .chart-placeholder p {
      margin: 0;
      font-size: 14px;
    }
  `]
})
export class TypeDistributionChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pieCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  types = input<TypeData[]>([]);
  
  private chart: Chart | null = null;
  private isViewInitialized = false;
  
  private updateEffect = effect(() => {
    const data = this.types();
    if (this.isViewInitialized) {
      setTimeout(() => {
        if (data && data.length > 0) {
          this.updateChart(data);
        } else {
          this.destroyChart();
        }
      });
    }
  });
  
  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    setTimeout(() => {
      const data = this.types();
      if (data && data.length > 0) {
        this.initChart(data);
      }
    }, 100);
  }
  
  private initChart(data: TypeData[]): void {
    this.destroyChart();
    
    if (!this.canvasRef || !this.canvasRef.nativeElement) return;
    
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.type),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => d.color),
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 15,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { size: 11 },
              usePointStyle: true,
              pointStyle: 'circle',
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw as number;
                const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeOutBounce',
        }
      }
    });
  }
  
  private updateChart(data: TypeData[]): void {
    if (!this.chart) {
      this.initChart(data);
      return;
    }
    
    this.chart.data.labels = data.map(d => d.type);
    this.chart.data.datasets[0].data = data.map(d => d.count);
    this.chart.data.datasets[0].backgroundColor = data.map(d => d.color);
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