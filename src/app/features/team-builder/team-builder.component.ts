// src/app/features/team-builder/team-builder.component.ts
import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
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
  
  private subscriptions: Subscription[] = [];
  
  // Form state
  teamName = signal('');
  selectedPokemonIds = signal<number[]>([]);
  competitiveMode = signal(false);
  selectedTier = signal<'OU' | 'UU' | 'RU' | 'NU' | null>(null);
  
  // UI state
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);
  showSuccess = signal(false);
  
  // Search autocomplete
  searchTerm = signal('');
  showDropdown = signal(false);
  
  // Edit dialog
  editingTeam = signal<Team | null>(null);
  showEditDialog = signal(false);
  
  // Data from stores
  teams = signal<Team[]>([]);
  allPokemon = signal<Pokemon[]>([]);
  
  // Computed - available Pokémon for selection
  availablePokemon = computed(() => {
    const selectedIds = this.selectedPokemonIds();
    if (selectedIds.length >= 6) return [];
    
    return this.allPokemon().filter(p => !selectedIds.includes(p.id));
  });
  
  // Computed - filtered search results
  searchResults = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (term.length < 2) return [];
    
    return this.availablePokemon()
      .filter(p => p.name.toLowerCase().includes(term))
      .slice(0, 10);
  });
  
  // Computed - selected Pokémon details
  selectedPokemonDetails = computed(() => {
    const ids = this.selectedPokemonIds();
    return ids
      .map(id => this.allPokemon().find(p => p.id === id))
      .filter(p => p !== undefined);
  });
  
  // Computed - team name validation
  isTeamNameValid = computed(() => {
    const name = this.teamName().trim();
    return name.length >= 3 && name.length <= 30;
  });
  
  // Computed - can submit form
  canSubmit = computed(() => {
    return this.isTeamNameValid() && 
           this.selectedPokemonIds().length >= 1 && 
           this.selectedPokemonIds().length <= 6 &&
           !this.submitting();
  });
  
  // Computed - type coverage analysis
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
  
  // Computed - type distribution for chart
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
    
    // Load error from store
    this.subscriptions.push(
      this.trainerStore.error$.subscribe((error: string | null) => {
        if (error) {
          this.error.set(error);
          setTimeout(() => this.error.set(null), 3000);
        }
      })
    );
    
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
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  /**
   * Add Pokémon to team selection
   */
  addPokemon(pokemon: Pokemon): void {
    if (this.selectedPokemonIds().length >= 6) return;
    
    this.selectedPokemonIds.update(ids => [...ids, pokemon.id]);
    this.searchTerm.set('');
    this.showDropdown.set(false);
  }
  
  /**
   * Remove Pokémon from team
   */
  removePokemon(pokemonId: number): void {
    this.selectedPokemonIds.update(ids => ids.filter(id => id !== pokemonId));
  }
  
  /**
   * Handle search input change
   */
  onSearchChange(): void {
    this.showDropdown.set(this.searchTerm().length >= 2);
  }
  
  /**
   * Create new team with optimistic update
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
   * Open edit dialog for a team
   */
  editTeam(team: Team): void {
    this.editingTeam.set(team);
    this.showEditDialog.set(true);
  }
  
  /**
   * Update team with optimistic update
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
   * Delete a team
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