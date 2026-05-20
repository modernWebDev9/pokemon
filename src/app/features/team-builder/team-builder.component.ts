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
  selectedTier = signal<'OU' | 'UU' | 'RU' | 'NU' | null>(null);
  
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
   * Computed signal for available Pokémon for selection
   * Filters out already selected Pokémon and enforces 6 Pokémon limit
   */
  availablePokemon = computed(() => {
    const selectedIds = this.selectedPokemonIds();
    if (selectedIds.length >= 6) return [];
    
    return this.allPokemon().filter(p => !selectedIds.includes(p.id));
  });
  
  /**
   * Computed signal for filtered search results
   * Shows all available Pokémon when search term is empty (on focus)
   * Shows top matches when search term is 2+ characters
   */
  searchResults = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    
    // When search term is empty (user just clicked on input), show all available Pokémon
    if (term.length === 0) {
      return this.availablePokemon().slice(0, 15);
    }
    
    // When search term is 1 character, wait for at least 2 characters
    if (term.length === 1) {
      return [];
    }
    
    // Filter by search term
    return this.availablePokemon()
      .filter(p => p.name.toLowerCase().includes(term))
      .slice(0, 10);
  });
  
  /**
   * Computed signal for selected Pokémon details
   * Maps selected IDs to full Pokémon objects
   */
  selectedPokemonDetails = computed(() => {
    const ids = this.selectedPokemonIds();
    return ids
      .map(id => this.allPokemon().find(p => p.id === id))
      .filter(p => p !== undefined);
  });
  
  /**
   * Computed signal for team name validation
   * Validates length between 3 and 30 characters
   */
  isTeamNameValid = computed(() => {
    const name = this.teamName().trim();
    return name.length >= 3 && name.length <= 30;
  });
  
  /**
   * Computed signal for form submission eligibility
   * Checks all validation rules and submission state
   */
  canSubmit = computed(() => {
    return this.isTeamNameValid() && 
           this.selectedPokemonIds().length >= 1 && 
           this.selectedPokemonIds().length <= 6 &&
           !this.submitting();
  });
  
  /**
   * Computed signal for type coverage analysis
   * Analyzes team type diversity and provides feedback
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
   * Transforms team composition into chart-friendly format
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
   * Initializes component by loading data and setting up subscriptions
   */
  ngOnInit(): void {
    // Load teams from store
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
    
    // Note: Store error subscription removed to prevent cross-component error display
    // Each component now handles its own errors locally
    
    // Load Pokémon data
    this.pokemonStore.fetchPokemonList(151, 0).subscribe({
      next: (pokemon: Pokemon[]) => {
        this.allPokemon.set(pokemon || []);
      },
      error: (err: any) => {
        console.error('Failed to load Pokémon:', err);
        this.error.set('Failed to load Pokémon data');
      }
    });
    
    // Set current trainer
    this.trainerStore.setCurrentTrainer('1');
  }
  
  /**
   * Cleans up subscriptions to prevent memory leaks
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * Adds Pokémon to team selection
   * Enforces 6 Pokémon maximum limit
   *
   * @param pokemon - Pokémon to add
   */
  addPokemon(pokemon: Pokemon): void {
    if (this.selectedPokemonIds().length >= 6) return;
    
    this.selectedPokemonIds.update(ids => [...ids, pokemon.id]);
    this.searchTerm.set('');
    this.showDropdown.set(false);
  }
  
  /**
   * Removes Pokémon from team selection
   *
   * @param pokemonId - Pokémon ID to remove
   */
  removePokemon(pokemonId: number): void {
    this.selectedPokemonIds.update(ids => ids.filter(id => id !== pokemonId));
  }
  
  /**
   * Handles search input change
   * Shows dropdown when search term has at least 2 characters
   */
  onSearchChange(): void {
    this.showDropdown.set(this.searchTerm().length >= 2);
  }
  
  /**
   * Handles search input focus
   * Shows dropdown with all available Pokémon when input is empty
   * This helps users discover available Pokémon without knowing names
   */
  onSearchFocus(): void {
    // Show dropdown with all available Pokémon if search term is empty
    if (this.searchTerm().length === 0 && this.availablePokemon().length > 0) {
      this.showDropdown.set(true);
    }
  }
  
  /**
   * Prevents dropdown from closing when clicking inside the search container
   */
  onSearchContainerClick(event: MouseEvent): void {
    event.stopPropagation();
  }
  
  /**
   * Creates new team with optimistic UI updates
   * Shows success message and resets form on success
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
        this.competitiveMode.set(false);
        this.selectedTier.set(null);
        
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
   *
   * @param team - Team to edit
   */
  editTeam(team: Team): void {
    this.editingTeam.set(team);
    this.showEditDialog.set(true);
  }
  
  /**
   * Updates team with optimistic UI updates
   *
   * @param id - Team ID to update
   * @param updates - Partial team data to update
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
   * Deletes a team with confirmation dialog
   *
   * @param id - Team ID to delete
   */
  deleteTeam(id: string): void {
    if (confirm('Are you sure you want to delete this team?')) {
      this.trainerStore.deleteTeam(id).subscribe({
        error: (err: any) => {
          console.error('Delete failed:', err);
          this.error.set(err.message || 'Failed to delete team');
          setTimeout(() => this.error.set(null), 3000);
        }
      });
    }
  }
}