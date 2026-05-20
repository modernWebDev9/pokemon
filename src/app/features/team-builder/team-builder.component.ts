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
    pokemons.forEach(p => p.types.forEach((t: string) => types.add(t)));
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
      pokemon.types.forEach((type: string) => {
        const normalizedType = type.toLowerCase();
        typeCount.set(normalizedType, (typeCount.get(normalizedType) || 0) + 1);
      });
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
        this.teamName.set('');
        this.selectedPokemonIds.set([]);
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
    console.log('Updating team:', id, updates);
    this.trainerStore.updateTeam(id, updates).subscribe({
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
        console.log('Team deleted successfully');
        this.closeDeleteConfirmModal();
      },
      error: (err: any) => {
        console.error('Delete failed:', err);
        this.closeDeleteConfirmModal();
        this.error.set(err.message || 'Failed to delete team');
        setTimeout(() => this.error.set(null), 3000);
      }
    });
  }
}