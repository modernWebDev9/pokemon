/**
 * Battle Log Component - Real-time battle log feed with polling simulation
 * Displays battle logs grouped by date with severity filtering and auto-scroll
 * Shows detailed battle records with team Pokémon details (nicknames & held items)
 */
import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BattlePollingService, BattleLogEntry } from '../../core/services/battle-polling.service';
import { TrainerStore, Battle, Team, PokemonDetail } from '../../state/trainer/trainer.store';
import { PokemonStore, Pokemon } from '../../state/pokemon/pokemon.store';
import { BattleChartComponent, MonthlyBattleData } from './battle-chart/battle-chart.component';

export interface BattleWithTeamName extends Battle {
  teamName: string;
}

export interface PokemonWithDetails {
  id: number;
  nickname: string;
  heldItem: string;
  pokemon: Pokemon | undefined;
}

export interface TeamWithPokemonDetails extends Team {
  pokemonDetailsList: PokemonWithDetails[];
}

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
  private pokemonStore = inject(PokemonStore);
  
  private pollingSubscription: Subscription | null = null;
  
  // State signals
  battleLogs = signal<BattleLogEntry[]>([]);
  allBattles = signal<Battle[]>([]);
  allTeams = signal<Team[]>([]);
  allPokemon = signal<Pokemon[]>([]);
  selectedSeverity = signal<string>('all');
  loading = signal(true);
  autoScroll = signal(true);
  selectedBattle = signal<BattleWithTeamName | null>(null);
  selectedTeam = signal<TeamWithPokemonDetails | null>(null);
  showBattleDetail = signal(false);
  showTeamPokemonModal = signal(false);
  
  // Pagination signals - Default: 10 items per page
  currentPage = signal(1);
  itemsPerPage = signal(10);
  itemsPerPageOptions = [5, 10, 25, 50];
  
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
   * Gets team name by team ID from the teams array
   */
  getTeamName(teamId: string): string {
    const team = this.allTeams().find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  }
  
  /**
   * Gets team icon based on team name
   */
  getTeamIcon(teamName: string): string {
    const icons: Record<string, string> = {
      'Kanto Starters': '🔥',
      'Johto Squad': '⚡',
      'Water Specialists': '💧',
      'Rock Solid': '🪨',
      'MyTeam': '⭐'
    };
    return icons[teamName] || '⚔️';
  }
  
  /**
   * Gets Pokémon sprite URL by ID
   */
  getPokemonSprite(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }
  
  /**
   * Gets held item label by value
   */
  getHeldItemLabel(value: string): string {
    const heldItemsMap: Record<string, string> = {
      'leftovers': 'Leftovers',
      'choice_scarf': 'Choice Scarf',
      'choice_band': 'Choice Band',
      'choice_specs': 'Choice Specs',
      'life_orb': 'Life Orb',
      'focus_sash': 'Focus Sash',
      'assault_vest': 'Assault Vest',
      'eviolite': 'Eviolite',
      'black_sludge': 'Black Sludge',
      'toxic_orb': 'Toxic Orb',
      'flame_orb': 'Flame Orb',
      'weakness_policy': 'Weakness Policy',
      'expert_belt': 'Expert Belt',
      'muscle_band': 'Muscle Band',
      'wise_glasses': 'Wise Glasses',
      'rocky_helmet': 'Rocky Helmet',
      'red_card': 'Red Card',
      'air_balloon': 'Air Balloon',
      'light_clay': 'Light Clay'
    };
    return heldItemsMap[value] || value || 'None';
  }
  
  /**
   * Gets nickname for a Pokémon from team details
   */
  getPokemonNickname(team: Team, pokemonId: number): string {
    const detail = team.pokemonDetails?.find((d: PokemonDetail) => d.pokemonId === pokemonId);
    return detail?.nickname || '';
  }
  
  /**
   * Gets held item for a Pokémon from team details
   */
  getPokemonHeldItem(team: Team, pokemonId: number): string {
    const detail = team.pokemonDetails?.find((d: PokemonDetail) => d.pokemonId === pokemonId);
    return detail?.heldItem || '';
  }
  
  /**
   * Gets team with full Pokémon details (nicknames and held items)
   */
  getTeamWithPokemonDetails(team: Team): TeamWithPokemonDetails {
    const pokemonDetailsList: PokemonWithDetails[] = team.pokemonIds.map(pokemonId => {
      const pokemon = this.allPokemon().find(p => p.id === pokemonId);
      const detail = team.pokemonDetails?.find((d: PokemonDetail) => d.pokemonId === pokemonId);
      return {
        id: pokemonId,
        nickname: detail?.nickname || '',
        heldItem: detail?.heldItem || '',
        pokemon: pokemon
      };
    }).filter(item => item.pokemon);
    
    return {
      ...team,
      pokemonDetailsList
    };
  }
  
  /**
   * Opens team Pokémon modal with detailed information
   */
  viewTeamPokemon(team: Team): void {
    const teamWithDetails = this.getTeamWithPokemonDetails(team);
    this.selectedTeam.set(teamWithDetails);
    this.showTeamPokemonModal.set(true);
  }
  
  /**
   * Closes team Pokémon modal
   */
  closeTeamPokemonModal(): void {
    this.showTeamPokemonModal.set(false);
    this.selectedTeam.set(null);
  }
  
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
   * Computed signal for battles with team names attached
   */
  battlesWithTeamNames = computed<BattleWithTeamName[]>(() => {
    const battles = this.allBattles();
    const teams = this.allTeams();
    return battles.map(battle => ({
      ...battle,
      teamName: teams.find(team => team.id === battle.teamId)?.name || 'Unknown Team'
    }));
  });
  
  /**
   * Computed signal for battles sorted by date
   */
  sortedBattles = computed<BattleWithTeamName[]>(() => {
    const battles = this.battlesWithTeamNames();
    return [...battles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });
  
  /**
   * Computed signal for paginated battles
   */
  paginatedBattles = computed<BattleWithTeamName[]>(() => {
    const battles = this.sortedBattles();
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    const end = start + this.itemsPerPage();
    return battles.slice(start, end);
  });
  
  /**
   * Computed signal for total pages
   */
  totalPages = computed(() => Math.ceil(this.sortedBattles().length / this.itemsPerPage()));
  
  /**
   * Computed signal for page range display
   */
  pageRange = computed(() => {
    const total = this.sortedBattles().length;
    const start = (this.currentPage() - 1) * this.itemsPerPage() + 1;
    const end = Math.min(start + this.itemsPerPage() - 1, total);
    return { start, end, total };
  });
  
  /**
   * Computed signal for win/loss record by team
   */
  teamRecords = computed(() => {
    const battles = this.battlesWithTeamNames();
    const records = new Map<string, { wins: number; losses: number; teamName: string; team: Team | undefined }>();
    
    battles.forEach(battle => {
      const teamId = battle.teamId;
      const team = this.allTeams().find(t => t.id === teamId);
      const current = records.get(teamId) || { wins: 0, losses: 0, teamName: battle.teamName, team };
      
      if (battle.result === 'win') {
        current.wins++;
      } else {
        current.losses++;
      }
      records.set(teamId, current);
    });
    
    return Array.from(records.entries()).map(([teamId, record]) => ({
      teamId,
      teamName: record.teamName,
      team: record.team,
      wins: record.wins,
      losses: record.losses,
      total: record.wins + record.losses,
      winRate: record.wins + record.losses > 0 ? Math.round((record.wins / (record.wins + record.losses)) * 100) : 0
    }));
  });
  
  /**
   * Computed signal for monthly battle statistics
   */
  monthlyBattleData = computed<MonthlyBattleData[]>(() => {
    const battles = this.allBattles();
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
    const battles = this.allBattles();
    return {
      totalWins: battles.filter(b => b.result === 'win').length,
      totalLosses: battles.filter(b => b.result === 'loss').length,
      total: battles.length
    };
  });
  
  /**
   * Computed signal for win rate percentage
   */
  winRate = computed(() => {
    const battles = this.allBattles();
    if (battles.length === 0) return 0;
    return Math.round((battles.filter(b => b.result === 'win').length / battles.length) * 100);
  });
  
  /**
   * Computed signal for battle statistics
   */
  battleStats = computed(() => {
    const battles = this.allBattles();
    return {
      wins: battles.filter(b => b.result === 'win').length,
      losses: battles.filter(b => b.result === 'loss').length,
      total: battles.length,
      winRate: this.winRate()
    };
  });
  
  /**
   * Gets CSS class for result badge
   */
  getResultClass(result: string): string {
    return result === 'win' ? 'result-win' : 'result-loss';
  }
  
  /**
   * Gets result icon
   */
  getResultIcon(result: string): string {
    return result === 'win' ? '🏆' : '💔';
  }
  
  /**
   * Formats date for display
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  
  /**
   * Changes current page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
  
  /**
   * Changes items per page
   */
  onItemsPerPageChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.itemsPerPage.set(Number(select.value));
    this.currentPage.set(1);
  }
  
  /**
   * Opens battle detail modal
   */
  viewBattleDetail(battle: BattleWithTeamName): void {
    this.selectedBattle.set(battle);
    this.showBattleDetail.set(true);
  }
  
  /**
   * Closes battle detail modal
   */
  closeBattleDetail(): void {
    this.showBattleDetail.set(false);
    this.selectedBattle.set(null);
  }
  
  /**
   * Initializes component
   */
  ngOnInit(): void {
    console.log('BattleLogComponent initialized');
    this.loadInitialLogs();
    this.loadBattles();
    this.loadTeams();
    this.loadPokemon();
    
    this.pollingSubscription = this.battlePolling.subscribeToBattleLogs((newLogs: BattleLogEntry[]) => {
      this.battleLogs.update(logs => [...newLogs, ...logs]);
      if (this.autoScroll()) {
        this.scrollToTop();
      }
    });
  }
  
  /**
   * Cleans up subscriptions
   */
  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    this.battlePolling.stopPolling();
  }
  
  private loadInitialLogs(): void {
    this.loading.set(true);
    this.battlePolling.fetchAllLogs().subscribe({
      next: (logs: BattleLogEntry[]) => {
        const sortedLogs = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        this.battleLogs.set(sortedLogs);
        this.loading.set(false);
        
        if (sortedLogs.length > 0) {
          const maxTimestamp = Math.max(...sortedLogs.map(l => new Date(l.timestamp).getTime()));
          this.battlePolling.setLastTimestamp(new Date(maxTimestamp));
        }
      },
      error: (error: Error) => {
        console.error('Failed to load battle logs:', error);
        this.loading.set(false);
      }
    });
  }
  
  private loadBattles(): void {
    this.trainerStore.battles$.subscribe((battles: Battle[]) => {
      this.allBattles.set(battles);
    });
  }
  
  private loadTeams(): void {
    this.trainerStore.teams$.subscribe((teams: Team[]) => {
      this.allTeams.set(teams);
    });
  }
  
  private loadPokemon(): void {
    this.pokemonStore.fetchPokemonList(151, 0).subscribe({
      next: (pokemon: Pokemon[]) => {
        this.allPokemon.set(pokemon);
      },
      error: (err: any) => {
        console.error('Failed to load Pokémon:', err);
      }
    });
  }
  
  setSeverityFilter(severity: string): void {
    this.selectedSeverity.set(severity);
  }
  
  clearLogs(): void {
    this.battleLogs.set([]);
  }
  
  refreshLogs(): void {
    this.battlePolling.resetLastTimestamp();
    this.loadInitialLogs();
  }
  
  toggleAutoScroll(): void {
    this.autoScroll.update(val => !val);
  }
  
  private scrollToTop(): void {
    const container = document.querySelector('.log-container');
    if (container) {
      container.scrollTop = 0;
    }
  }
  
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
  
  getSeverityClass(severity: string): string {
    return `log-entry severity-${severity}`;
  }
}