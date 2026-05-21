/**
 * Team Builder Component - Advanced form for creating and managing Pokémon teams
 * Implements autocomplete search, type coverage analysis, and optimistic updates
 * Each Pokémon can have a nickname, held item, and EV spread (must sum to 510)
 */
import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainerStore, Team, PokemonDetail, CreateTeamInput } from '../../state/trainer/trainer.store';
import { PokemonStore, Pokemon } from '../../state/pokemon/pokemon.store';
import { EditTeamDialogComponent } from './edit-team-dialog/edit-team-dialog.component';
import { TypeDistributionChartComponent, TypeData } from '../../shared/components/type-distribution-chart/type-distribution-chart.component';
import { TYPE_COLORS } from '../../shared/components/type-colors';
import { Subscription, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

// Available held items for dropdown
const HELD_ITEMS = [
  { value: '', label: 'None' },
  { value: 'leftovers', label: 'Leftovers' },
  { value: 'choice_scarf', label: 'Choice Scarf' },
  { value: 'choice_band', label: 'Choice Band' },
  { value: 'choice_specs', label: 'Choice Specs' },
  { value: 'life_orb', label: 'Life Orb' },
  { value: 'focus_sash', label: 'Focus Sash' },
  { value: 'assault_vest', label: 'Assault Vest' },
  { value: 'eviolite', label: 'Eviolite' },
  { value: 'black_sludge', label: 'Black Sludge' },
  { value: 'toxic_orb', label: 'Toxic Orb' },
  { value: 'flame_orb', label: 'Flame Orb' },
  { value: 'weakness_policy', label: 'Weakness Policy' },
  { value: 'expert_belt', label: 'Expert Belt' },
  { value: 'muscle_band', label: 'Muscle Band' },
  { value: 'wise_glasses', label: 'Wise Glasses' },
  { value: 'rocky_helmet', label: 'Rocky Helmet' },
  { value: 'red_card', label: 'Red Card' },
  { value: 'air_balloon', label: 'Air Balloon' },
  { value: 'light_clay', label: 'Light Clay' }
];

export interface EVSpread {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonWithEVs {
  pokemonId: number;
  nickname: string;
  heldItem: string;
  evs: EVSpread;
}

@Component({
  selector: 'app-team-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, EditTeamDialogComponent, TypeDistributionChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-builder.component.html',
  styleUrls: ['./team-builder.component.scss']
})
export class TeamBuilderComponent implements OnInit, OnDestroy {
  private trainerStore = inject(TrainerStore);
  private pokemonStore = inject(PokemonStore);
  private elementRef = inject(ElementRef);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private subscriptions: Subscription[] = [];

  // Form state signals
  teamName = signal('');
  selectedPokemonEVs = signal<Map<number, PokemonWithEVs>>(new Map());
  competitiveMode = signal(false);
  selectedTier = signal<'OU' | 'UU' | 'RU' | 'NU' | null>('OU');

  // UI state signals
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);
  showSuccess = signal(false);

  // Search autocomplete signals
  searchTerm = signal('');
  showDropdown = signal(false);
  isTeamNameUnique = signal(true);
  isCheckingName = signal(false);

  // Edit dialog signals
  editingTeam = signal<Team | null>(null);
  showEditDialog = signal(false);

  // Delete confirmation modal signals
  showDeleteConfirmModal = signal(false);
  teamToDelete = signal<Team | null>(null);

  // Team Pokémon modal signals
  selectedTeam = signal<Team | null>(null);
  showTeamPokemonModal = signal(false);

  // Data signals from stores
  teams = signal<Team[]>([]);
  allPokemon = signal<Pokemon[]>([]);

  // Held items list for dropdown
  heldItems = HELD_ITEMS;

  // Maximum EV total
  readonly MAX_EV_TOTAL = 510;
  readonly MAX_EV_PER_STAT = 252;

  constructor() {
    // Async validator for team name uniqueness
    toObservable(this.teamName).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(name => {
        if (name.length < 3) {
          this.isTeamNameUnique.set(true);
          this.isCheckingName.set(false);
          return of(null);
        }
        this.isCheckingName.set(true);
        return this.checkTeamNameUnique(name);
      })
    ).subscribe(isUnique => {
      if (isUnique !== null) {
        this.isTeamNameUnique.set(isUnique);
        this.isCheckingName.set(false);
      }
    });
  }

  /**
   * Checks if team name is unique among existing teams
   */
  private checkTeamNameUnique(name: string): Observable<boolean> {
    const existingTeams = this.teams();
    const isUnique = !existingTeams.some(team => team.name.toLowerCase() === name.toLowerCase());
    return of(isUnique);
  }

  /**
   * Host listener to close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const searchContainer = this.elementRef.nativeElement.querySelector('.search-container');

    if (searchContainer && !searchContainer.contains(target)) {
      this.showDropdown.set(false);
    }
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
    const item = this.heldItems.find(i => i.value === value);
    return item ? item.label : value;
  }

  /**
   * Initializes default EV spread for a Pokémon
   */
  private getDefaultEVs(): EVSpread {
    return { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  }

  /**
   * Gets EV spread for a Pokémon
   */
  getPokemonEVs(pokemonId: number): EVSpread {
    const data = this.selectedPokemonEVs().get(pokemonId);
    return data?.evs || this.getDefaultEVs();
  }

  /**
   * Gets nickname for a Pokémon
   */
  getPokemonNickname(pokemonId: number): string {
    return this.selectedPokemonEVs().get(pokemonId)?.nickname || '';
  }

  /**
   * Gets held item for a Pokémon
   */
  getPokemonHeldItem(pokemonId: number): string {
    return this.selectedPokemonEVs().get(pokemonId)?.heldItem || '';
  }

  /**
   * Updates EV value for a Pokémon
   */
  updateEV(pokemonId: number, stat: keyof EVSpread, value: number): void {
    const currentData = this.selectedPokemonEVs().get(pokemonId);
    if (!currentData) return;

    const newEVs = { ...currentData.evs, [stat]: Math.min(value, this.MAX_EV_PER_STAT) };
    const newMap = new Map(this.selectedPokemonEVs());
    newMap.set(pokemonId, { ...currentData, evs: newEVs });
    this.selectedPokemonEVs.set(newMap);
  }

  /**
   * Updates nickname for a Pokémon
   */
  updateNickname(pokemonId: number, nickname: string): void {
    const currentData = this.selectedPokemonEVs().get(pokemonId);
    if (!currentData) return;
    
    const newMap = new Map(this.selectedPokemonEVs());
    newMap.set(pokemonId, { ...currentData, nickname });
    this.selectedPokemonEVs.set(newMap);
  }

  /**
   * Updates held item for a Pokémon
   */
  updateHeldItem(pokemonId: number, heldItem: string): void {
    const currentData = this.selectedPokemonEVs().get(pokemonId);
    if (!currentData) return;
    
    const newMap = new Map(this.selectedPokemonEVs());
    newMap.set(pokemonId, { ...currentData, heldItem });
    this.selectedPokemonEVs.set(newMap);
  }

  /**
   * Gets total EV sum for a Pokémon
   */
  getEVTotal(pokemonId: number): number {
    const evs = this.getPokemonEVs(pokemonId);
    return evs.hp + evs.attack + evs.defense + evs.specialAttack + evs.specialDefense + evs.speed;
  }

  /**
   * Checks if EV spread is valid for a Pokémon
   */
  isEVValid(pokemonId: number): boolean {
    const total = this.getEVTotal(pokemonId);
    return total === this.MAX_EV_TOTAL;
  }

  /**
   * Gets EV validation message for a Pokémon
   */
  getEVValidationMessage(pokemonId: number): string {
    const total = this.getEVTotal(pokemonId);
    if (total === this.MAX_EV_TOTAL) return '';
    if (total < this.MAX_EV_TOTAL) return `Total: ${total}/510 (Need ${this.MAX_EV_TOTAL - total} more)`;
    return `Total: ${total}/510 (Exceeds by ${total - this.MAX_EV_TOTAL})`;
  }

  /**
   * Gets selected Pokémon IDs
   */
  selectedPokemonIds = computed(() => {
    return Array.from(this.selectedPokemonEVs().keys());
  });

  /**
   * Gets selected Pokémon with full data (EVs, nickname, held item)
   */
  selectedPokemonWithDetails = computed(() => {
    const evsMap = this.selectedPokemonEVs();
    return Array.from(evsMap.entries()).map(([id, data]) => ({
      id,
      pokemonId: id,
      nickname: data.nickname,
      heldItem: data.heldItem,
      evs: data.evs,
      pokemon: this.allPokemon().find(p => p.id === id)
    })).filter(item => item.pokemon);
  });

  /**
   * Gets selected Pokémon for display (simple list)
   */
  selectedPokemonSimple = computed(() => {
    return this.selectedPokemonWithDetails().map(item => item.pokemon).filter(p => p);
  });

  /**
   * Checks if all EVs are valid (for competitive mode)
   */
  allEVsValid = computed(() => {
    if (!this.competitiveMode()) return true;
    const pokemonIds = this.selectedPokemonIds();
    return pokemonIds.every(id => this.isEVValid(id));
  });

  /**
   * Opens team Pokémon modal
   */
  viewTeamPokemon(team: Team): void {
    this.selectedTeam.set(team);
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
   * Gets Pokémon details for a team
   */
  getTeamPokemonDetails(team: Team): { id: number; nickname: string; heldItem: string; pokemon: Pokemon | undefined }[] {
    return team.pokemonIds.map(id => {
      const detail = team.pokemonDetails?.find(d => d.pokemonId === id);
      return {
        id,
        nickname: detail?.nickname || '',
        heldItem: detail?.heldItem || '',
        pokemon: this.allPokemon().find(p => p.id === id)
      };
    }).filter(item => item.pokemon);
  }

  /**
   * Computed signal for available Pokémon for selection
   */
  availablePokemon = computed(() => {
    const selectedIds = this.selectedPokemonIds();
    if (selectedIds.length >= 6) return [];
    return this.allPokemon().filter(p => !selectedIds.includes(p.id));
  });

  /**
   * Computed signal for filtered search results
   */
  searchResults = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (term.length === 0) {
      return this.availablePokemon().slice(0, 50);
    }
    if (term.length === 1) {
      return [];
    }
    return this.availablePokemon()
      .filter(p => p.name.toLowerCase().includes(term));
  });

  /**
   * Computed signal for team name validation
   */
  isTeamNameValid = computed(() => {
    const name = this.teamName().trim();
    return name.length >= 3 && name.length <= 30;
  });

  /**
   * Computed signal for form submission eligibility
   */
  canSubmit = computed(() => {
    if (this.competitiveMode() && !this.selectedTier()) {
      return false;
    }
    // Check EV validity when competitive mode is on
    if (this.competitiveMode() && !this.allEVsValid()) {
      return false;
    }
    const hasTeamNameError = !this.isTeamNameValid() || !this.isTeamNameUnique();
    return !hasTeamNameError &&
      this.selectedPokemonIds().length >= 1 &&
      this.selectedPokemonIds().length <= 6 &&
      !this.submitting();
  });

  /**
   * Computed signal for type coverage analysis (warning banner)
   */
  typeCoverageWarning = computed(() => {
    const pokemons = this.selectedPokemonSimple();
    const types = new Set<string>();
    pokemons.forEach(p => p?.types.forEach((t: string) => types.add(t)));

    const hasWeakness = types.size < 3;
    return {
      show: pokemons.length > 0 && hasWeakness,
      message: hasWeakness ? '⚠️ Your team has limited type coverage. Consider adding more type variety!' : ''
    };
  });

  /**
   * Computed signal for type distribution data for chart
   */
  typeDistribution = computed<TypeData[]>(() => {
    const pokemons = this.selectedPokemonSimple();
    if (pokemons.length === 0) return [];

    const typeCount = new Map<string, number>();

    pokemons.forEach(pokemon => {
      if (pokemon) {
        pokemon.types.forEach((type: string) => {
          const normalizedType = type.toLowerCase();
          typeCount.set(normalizedType, (typeCount.get(normalizedType) || 0) + 1);
        });
      }
    });

    return Array.from(typeCount.entries())
      .map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        color: TYPE_COLORS[type] || '#999'
      }))
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Initializes component
   */
  ngOnInit(): void {
    this.subscriptions.push(
      this.trainerStore.teams$.subscribe({
        next: (teams: Team[]) => {
          this.teams.set(teams || []);
          this.loading.set(false);
        },
        error: (err: any) => {
          console.error('Error loading teams:', err);
          this.error.set('Failed to load teams');
          this.loading.set(false);
        }
      })
    );

    this.pokemonStore.fetchPokemonList(151, 0).subscribe({
      next: (pokemon: Pokemon[]) => {
        this.allPokemon.set(pokemon || []);
      },
      error: (err: any) => {
        console.error('Failed to load Pokémon:', err);
        this.error.set('Failed to load Pokémon data');
      }
    });

    this.trainerStore.setCurrentTrainer('1');
  }

  /**
   * Cleans up subscriptions
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Adds Pokémon to team selection with default EV spread
   */
  addPokemon(pokemon: Pokemon): void {
    if (this.selectedPokemonIds().length >= 6) return;
    
    const newMap = new Map(this.selectedPokemonEVs());
    newMap.set(pokemon.id, {
      pokemonId: pokemon.id,
      nickname: '',
      heldItem: '',
      evs: this.getDefaultEVs()
    });
    this.selectedPokemonEVs.set(newMap);
    
    this.searchTerm.set('');
    this.showDropdown.set(false);
  }

  /**
   * Removes Pokémon from team selection
   */
  removePokemon(pokemonId: number): void {
    const newMap = new Map(this.selectedPokemonEVs());
    newMap.delete(pokemonId);
    this.selectedPokemonEVs.set(newMap);
  }

  /**
   * Handles search input change
   */
  onSearchChange(): void {
    this.showDropdown.set(this.searchTerm().length >= 2);
  }

  /**
   * Handles search input focus
   */
  onSearchFocus(): void {
    if (this.searchTerm().length === 0 && this.availablePokemon().length > 0) {
      this.showDropdown.set(true);
    }
  }

  /**
   * Creates new team with all details including EVs
   */
  createTeam(): void {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);

    const pokemonIds = this.selectedPokemonIds();
    const pokemonDetails: PokemonDetail[] = Array.from(this.selectedPokemonEVs().entries()).map(([pokemonId, data]) => ({
      pokemonId,
      nickname: data.nickname,
      heldItem: data.heldItem,
      evs: data.evs
    }));

    const teamData: CreateTeamInput = {
      name: this.teamName().trim(),
      trainerId: '1',
      pokemonIds: pokemonIds,
      pokemonDetails: pokemonDetails,
      competitiveMode: this.competitiveMode(),
      tier: this.competitiveMode() ? this.selectedTier() : null
    };

    this.trainerStore.createTeam(teamData).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showSuccess.set(true);

        // Reset form
        this.teamName.set('');
        this.selectedPokemonEVs.set(new Map());
        this.competitiveMode.set(false);
        this.selectedTier.set('OU');

        setTimeout(() => this.showSuccess.set(false), 3000);
      },
      error: (err: any) => {
        console.error('Create team error:', err);
        this.submitting.set(false);
        this.error.set(err.message || 'Failed to create team');
      }
    });
  }

  /**
   * Opens edit dialog for a team
   */
  editTeam(team: Team): void {
    this.editingTeam.set(team);
    this.showEditDialog.set(true);
  }

  /**
   * Updates team with optimistic UI updates
   */
  updateTeam(id: string, updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId'>>): void {
    console.log('Updating team:', id, updates);

    const updatePayload: any = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.competitiveMode !== undefined) updatePayload.competitiveMode = updates.competitiveMode;
    if (updates.tier !== undefined) updatePayload.tier = updates.tier;
    if (updates.pokemonIds !== undefined) updatePayload.pokemonIds = updates.pokemonIds;
    if (updates.pokemonDetails !== undefined) updatePayload.pokemonDetails = updates.pokemonDetails;

    this.trainerStore.updateTeam(id, updatePayload).subscribe({
      next: () => {
        console.log('Team updated successfully');
        this.showEditDialog.set(false);
        this.editingTeam.set(null);
      },
      error: (err: any) => {
        console.error('Update failed:', err);
        this.error.set(err.message || 'Failed to update team');
        setTimeout(() => this.error.set(null), 3000);
      }
    });
  }

  /**
   * Opens delete confirmation modal
   */
  openDeleteConfirmModal(team: Team): void {
    this.teamToDelete.set(team);
    this.showDeleteConfirmModal.set(true);
  }

  /**
   * Closes delete confirmation modal
   */
  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal.set(false);
    this.teamToDelete.set(null);
  }

  /**
   * Confirms and executes team deletion
   */
  confirmDeleteTeam(): void {
    const team = this.teamToDelete();
    if (!team) return;

    this.trainerStore.deleteTeam(team.id).subscribe({
      next: () => {
        this.closeDeleteConfirmModal();
      },
      error: (err: any) => {
        this.closeDeleteConfirmModal();
        this.error.set(err.message || 'Failed to delete team');
        setTimeout(() => this.error.set(null), 3000);
      }
    });
  }
}