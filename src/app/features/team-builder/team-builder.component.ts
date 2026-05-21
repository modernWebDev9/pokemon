/**
 * Team Builder Component - Advanced form for creating and managing Pokémon teams
 * Implements autocomplete search, type coverage analysis, and optimistic updates
 */
import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainerStore, Team } from '../../state/trainer/trainer.store';
import { PokemonStore, Pokemon } from '../../state/pokemon/pokemon.store';
import { EditTeamDialogComponent } from './edit-team-dialog/edit-team-dialog.component';
import { TypeDistributionChartComponent, TypeData } from '../../shared/components/type-distribution-chart/type-distribution-chart.component';
import { TYPE_COLORS } from '../../shared/components/type-colors';
import { Subscription } from 'rxjs';

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
  selectedPokemonIds = signal<number[]>([]);
  selectedPokemonNicknames = signal<Map<number, string>>(new Map());
  selectedPokemonHeldItems = signal<Map<number, string>>(new Map());
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
   * Gets nickname for a Pokémon
   */
  getPokemonNickname(pokemonId: number): string {
    return this.selectedPokemonNicknames().get(pokemonId) || '';
  }

  /**
   * Gets held item for a Pokémon
   */
  getPokemonHeldItem(pokemonId: number): string {
    return this.selectedPokemonHeldItems().get(pokemonId) || '';
  }

  /**
   * Updates nickname for a Pokémon
   */
  updateNickname(pokemonId: number, nickname: string): void {
    const newMap = new Map(this.selectedPokemonNicknames());
    if (nickname) {
      newMap.set(pokemonId, nickname);
    } else {
      newMap.delete(pokemonId);
    }
    this.selectedPokemonNicknames.set(newMap);
  }

  /**
   * Updates held item for a Pokémon
   */
  updateHeldItem(pokemonId: number, heldItem: string): void {
    const newMap = new Map(this.selectedPokemonHeldItems());
    if (heldItem) {
      newMap.set(pokemonId, heldItem);
    } else {
      newMap.delete(pokemonId);
    }
    this.selectedPokemonHeldItems.set(newMap);
  }

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
  getTeamPokemonDetails(team: Team): Pokemon[] {
    return this.allPokemon().filter(p => team.pokemonIds.includes(p.id));
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
   * Computed signal for selected Pokémon details
   */
  selectedPokemonDetails = computed(() => {
    const ids = this.selectedPokemonIds();
    return ids
      .map(id => this.allPokemon().find(p => p.id === id))
      .filter(p => p !== undefined);
  });

  /**
   * Computed signal for selected Pokémon with nicknames and held items
   */
  selectedPokemonWithDetails = computed(() => {
    const ids = this.selectedPokemonIds();
    return ids.map(id => {
      const pokemon = this.allPokemon().find(p => p.id === id);
      return {
        id: id,
        pokemon: pokemon,
        nickname: this.selectedPokemonNicknames().get(id) || '',
        heldItem: this.selectedPokemonHeldItems().get(id) || ''
      };
    }).filter(item => item.pokemon);
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
    return this.isTeamNameValid() &&
      this.selectedPokemonIds().length >= 1 &&
      this.selectedPokemonIds().length <= 6 &&
      !this.submitting();
  });

  /**
   * Computed signal for type coverage analysis
   */
  typeCoverage = computed(() => {
    const pokemons = this.selectedPokemonDetails();
    const types = new Set<string>();
    pokemons.forEach(p => p?.types.forEach((t: string) => types.add(t)));

    return {
      count: types.size,
      types: Array.from(types),
      isBalanced: types.size >= 3,
      message: types.size >= 3 ? 'Good type diversity!' : 'Consider adding more type variety'
    };
  });

  /**
   * Computed signal for type distribution data for chart
   */
  typeDistribution = computed<TypeData[]>(() => {
    const pokemons = this.selectedPokemonDetails();
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
   * Adds Pokémon to team selection
   */
  addPokemon(pokemon: Pokemon): void {
    if (this.selectedPokemonIds().length >= 6) return;
    this.selectedPokemonIds.update(ids => [...ids, pokemon.id]);
    this.searchTerm.set('');
    this.showDropdown.set(false);
  }

  /**
   * Removes Pokémon from team selection
   */
  removePokemon(pokemonId: number): void {
    this.selectedPokemonIds.update(ids => ids.filter(id => id !== pokemonId));
    const newNicknames = new Map(this.selectedPokemonNicknames());
    newNicknames.delete(pokemonId);
    this.selectedPokemonNicknames.set(newNicknames);
    const newHeldItems = new Map(this.selectedPokemonHeldItems());
    newHeldItems.delete(pokemonId);
    this.selectedPokemonHeldItems.set(newHeldItems);
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
   * Creates new team
   */
  createTeam(): void {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);

    this.trainerStore.createTeam({
      name: this.teamName().trim(),
      trainerId: '1',
      pokemonIds: this.selectedPokemonIds(),
      competitiveMode: this.competitiveMode(),
      tier: this.competitiveMode() ? this.selectedTier() : null
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showSuccess.set(true);

        // Reset form
        this.teamName.set('');
        this.selectedPokemonIds.set([]);
        this.selectedPokemonNicknames.set(new Map());
        this.selectedPokemonHeldItems.set(new Map());
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
   * Updates team
   */
  updateTeam(id: string, updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId' | 'pokemonIds'>>): void {
    this.trainerStore.updateTeam(id, updates).subscribe({
      next: () => {
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