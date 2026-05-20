/**
 * Battle Log Component - Real-time battle log feed with polling simulation
 * Displays battle logs grouped by date with severity filtering and auto-scroll
 */
import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BattlePollingService, BattleLogEntry } from '../../core/services/battle-polling.service';
import { TrainerStore, Battle } from '../../state/trainer/trainer.store';
import { BattleChartComponent, MonthlyBattleData } from './battle-chart/battle-chart.component';

@Component({
  selector: 'app-battle-log',
  standalone: true,
  imports: [CommonModule, FormsModule, BattleChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './battle-log.component.html',
  styleUrls: ['./battle-log.component.scss']
})
export class BattleLogComponent implements OnInit, OnDestroy {
  private battlePolling = inject(BattlePollingService);
  private trainerStore = inject(TrainerStore);
  
  private pollingSubscription: Subscription | null = null;
  
  // State signals
  battleLogs = signal<BattleLogEntry[]>([]);
  allBattles = signal<Battle[]>([]);
  selectedSeverity = signal<string>('all');
  loading = signal(true);
  autoScroll = signal(true);
  
  // UI configuration
  severityOptions = [
    { value: 'all', label: 'All', icon: '📋' },
    { value: 'info', label: 'Info', icon: 'ℹ️', color: '#3498db' },
    { value: 'success', label: 'Success', icon: '✅', color: '#2ecc71' },
    { value: 'warning', label: 'Warning', icon: '⚠️', color: '#f39c12' },
    { value: 'danger', label: 'Danger', icon: '❌', color: '#e74c3c' }
  ];
  
  severityIcon: Record<string, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    danger: '❌'
  };
  
  /**
   * Computed signal for filtered battle logs by severity
   */
  filteredLogs = computed(() => {
    const logs = this.battleLogs();
    const severity = this.selectedSeverity();
    
    if (severity === 'all') return logs;
    return logs.filter(log => log.severity === severity);
  });
  
  /**
   * Computed signal for logs grouped by date
   * Groups logs by their date and sorts groups by date descending
   */
  groupedLogs = computed(() => {
    const logs = this.filteredLogs();
    const groups: { date: string; logs: BattleLogEntry[] }[] = [];
    const map = new Map<string, BattleLogEntry[]>();
    
    logs.forEach(log => {
      const date = new Date(log.timestamp).toLocaleDateString();
      if (!map.has(date)) {
        map.set(date, []);
      }
      map.get(date)!.push(log);
    });
    
    map.forEach((logs, date) => {
      groups.push({ date, logs });
    });
    
    return groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });
  
  /**
   * Computed signal for monthly battle statistics
   * Aggregates wins and losses by month for chart visualization
   */
  monthlyBattleData = computed<MonthlyBattleData[]>(() => {
    const battles = this.allBattles();
    console.log('Computing monthly data from battles:', battles.length);
    
    if (battles.length === 0) return [];
    
    const monthlyMap = new Map<string, { wins: number; losses: number }>();
    
    battles.forEach((battle: Battle) => {
      const date = new Date(battle.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { wins: 0, losses: 0 });
      }
      
      const current = monthlyMap.get(monthKey)!;
      if (battle.result === 'win') {
        current.wins++;
      } else {
        current.losses++;
      }
    });
    
    const sortedMonths = Array.from(monthlyMap.keys()).sort();
    
    return sortedMonths.map(monthKey => ({
      month: monthKey,
      wins: monthlyMap.get(monthKey)!.wins,
      losses: monthlyMap.get(monthKey)!.losses
    }));
  });
  
  /**
   * Computed signal for total battle summary
   */
  totalBattlesSummary = computed(() => {
    const data = this.monthlyBattleData();
    const totalWins = data.reduce((sum, d) => sum + d.wins, 0);
    const totalLosses = data.reduce((sum, d) => sum + d.losses, 0);
    return { totalWins, totalLosses, total: totalWins + totalLosses };
  });
  
  /**
   * Computed signal for win rate percentage
   */
  winRate = computed(() => {
    const battles = this.allBattles();
    if (battles.length === 0) return 0;
    const wins = battles.filter(b => b.result === 'win').length;
    return Math.round((wins / battles.length) * 100);
  });
  
  /**
   * Computed signal for battle statistics
   */
  battleStats = computed(() => {
    const battles = this.allBattles();
    const wins = battles.filter(b => b.result === 'win').length;
    const losses = battles.filter(b => b.result === 'loss').length;
    const total = battles.length;
    
    console.log('Battle stats computed:', { wins, losses, total, winRate: this.winRate() });
    
    return { wins, losses, total, winRate: this.winRate() };
  });
  
  /**
   * Initializes component by loading data and starting polling
   */
  ngOnInit(): void {
    console.log('BattleLogComponent initialized');
    this.loadInitialLogs();
    this.loadBattles();
    
    // Subscribe to polling service for real-time updates
    // Polling is used instead of WebSocket subscriptions because:
    // 1. The mock server doesn't support WebSocket subscriptions
    // 2. Polling is simpler to implement and debug
    // 3. For a real application, WebSocket would be preferred for true real-time updates
    this.pollingSubscription = this.battlePolling.subscribeToBattleLogs((newLogs: BattleLogEntry[]) => {
      console.log('New battle logs received:', newLogs.length);
      this.battleLogs.update(logs => [...newLogs, ...logs]);
      
      if (this.autoScroll()) {
        this.scrollToTop();
      }
    });
  }
  
  /**
   * Cleans up subscriptions and stops polling
   */
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    this.battlePolling.stopPolling();
  }
  
  /**
   * Loads initial battle logs from the polling service
   */
  private loadInitialLogs(): void {
    this.loading.set(true);
    console.log('Loading initial battle logs...');
    
    this.battlePolling.fetchAllLogs().subscribe({
      next: (logs: BattleLogEntry[]) => {
        console.log('Initial logs received:', logs.length);
        const sortedLogs = logs.sort((a: BattleLogEntry, b: BattleLogEntry) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        this.battleLogs.set(sortedLogs);
        this.loading.set(false);
      },
      error: (error: Error) => {
        console.error('Failed to load battle logs:', error);
        this.loading.set(false);
      }
    });
  }
  
  /**
   * Loads battle data from the trainer store
   */
  private loadBattles(): void {
    console.log('Subscribing to battles$...');
    this.trainerStore.battles$.subscribe((battles: Battle[]) => {
      console.log('Battles received in component:', battles);
      console.log('Number of battles:', battles.length);
      this.allBattles.set(battles);
    });
  }
  
  /**
   * Sets severity filter for battle logs
   *
   * @param severity - Severity level to filter by
   */
  setSeverityFilter(severity: string): void {
    this.selectedSeverity.set(severity);
  }
  
  /**
   * Clears all battle logs
   */
  clearLogs(): void {
    this.battleLogs.set([]);
  }
  
  /**
   * Refreshes battle logs by resetting polling timestamp
   */
  refreshLogs(): void {
    this.battlePolling.resetLastTimestamp();
    this.loadInitialLogs();
  }
  
  /**
   * Toggles auto-scroll behavior
   */
  toggleAutoScroll(): void {
    this.autoScroll.update(val => !val);
  }
  
  /**
   * Scrolls log container to top
   */
  private scrollToTop(): void {
    const container = document.querySelector('.log-container');
    if (container) {
      container.scrollTop = 0;
    }
  }
  
  /**
   * Converts timestamp to relative time string
   *
   * @param timestamp - ISO timestamp string
   * @returns Relative time string (e.g., "2 hours ago")
   */
  getRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  
  /**
   * Gets CSS class for severity level
   *
   * @param severity - Severity level
   * @returns CSS class string
   */
  getSeverityClass(severity: string): string {
    return `log-entry severity-${severity}`;
  }
}