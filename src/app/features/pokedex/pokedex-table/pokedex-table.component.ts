/**
 * Pokedex Table Component - Displays Pokémon in a sortable, filterable table
 * Implements client-side pagination, filtering, sorting, and multi-row selection
 */
import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonStore, Pokemon } from '../../../state/pokemon/pokemon.store';
import { TrainerStore, Team, PokemonDetail } from '../../../state/trainer/trainer.store';
import { PokemonDetailComponent } from '../pokemon-detail/pokemon-detail.component';

@Component({
  selector: 'app-pokedex-table',
  standalone: true,
  imports: [CommonModule, FormsModule, PokemonDetailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pokedex-table.component.html',
  styleUrls: ['./pokedex-table.component.scss']
})
export class PokedexTableComponent implements OnInit {
  private pokemonStore = inject(PokemonStore);
  private trainerStore = inject(TrainerStore);

  @ViewChild('teamSelect') teamSelect!: ElementRef<HTMLSelectElement>;
  
  // Math reference for template
  Math = Math;

  // UI state signals
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');
  selectedType = signal<string>('');
  minStats = signal<number>(0);
  maxStats = signal<number>(1000);
  sortBy = signal<string>('id');
  sortDir = signal<'asc' | 'desc'>('asc');
  currentPage = signal<number>(1);
  pageSize = signal<number>(25);

  // Multi-row selection signals
  selectedPokemonIds = signal<Set<number>>(new Set());
  showBulkActionBar = signal<boolean>(false);

  // Add to team modal signals
  showAddToTeamModal = signal<boolean>(false);
  selectedTeamId = signal<string>('');
  bulkAddError = signal<string | null>(null);
  bulkAddSuccess = signal<string | null>(null);
  isAdding = signal<boolean>(false);

  // Data signals
  allPokemon = signal<Pokemon[]>([]);
  userTeams = signal<Team[]>([]);
  selectedPokemon = signal<Pokemon | null>(null);

  /**
   * Computed signal for available Pokémon types
   */
  availableTypes = computed(() => {
    const types = new Set<string>();
    this.allPokemon().forEach(p => p.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  });

  /**
   * Computed signal for filtered and sorted Pokémon
   */
  filteredPokemon = computed(() => {
    let results = [...this.allPokemon()];
    const search = this.searchTerm().toLowerCase();
    const type = this.selectedType();

    if (search.length >= 2) {
      results = results.filter(p => p.name.toLowerCase().includes(search));
    }

    if (type) {
      results = results.filter(p => p.types.includes(type));
    }

    results = results.filter(p => {
      const total = this.calculateTotalStats(p);
      return total >= this.minStats() && total <= this.maxStats();
    });

    results.sort((a, b) => {
      const sortBy = this.sortBy();
      const sortDir = this.sortDir();

      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'total':
          aVal = this.calculateTotalStats(a);
          bVal = this.calculateTotalStats(b);
          break;
        default:
          aVal = a.stats[sortBy as keyof typeof a.stats];
          bVal = b.stats[sortBy as keyof typeof b.stats];
      }

      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return results;
  });

  /**
   * Computed signal for selected Pokémon objects
   */
  selectedPokemonObjects = computed(() => {
    const selectedIds = this.selectedPokemonIds();
    return this.allPokemon().filter(p => selectedIds.has(p.id));
  });

  /**
   * Computed signal for total number of pages
   */
  totalPages = computed(() => {
    const total = this.filteredPokemon().length;
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  /**
   * Computed signal for paginated Pokémon
   */
  paginatedPokemon = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return this.filteredPokemon().slice(start, end);
  });

  /**
   * Computed signal for the range of items being displayed
   */
  displayedRange = computed(() => {
    const total = this.filteredPokemon().length;
    const current = this.currentPage();
    const size = this.pageSize();
    const start = total === 0 ? 0 : (current - 1) * size + 1;
    const end = Math.min(current * size, total);
    return { start, end, total };
  });

  /**
   * Initializes component
   */
  ngOnInit(): void {
    console.log('PokedexTableComponent initialized');
    this.loadPokemon();
    this.loadUserTeams();
  }

  /**
   * Loads ALL Pokémon data
   */
  private loadPokemon(): void {
    this.pokemonStore.fetchAllPokemon().subscribe({
      next: (pokemon) => {
        this.allPokemon.set(pokemon);
        this.loading.set(false);
        console.log('Pokémon loaded:', pokemon.length);

        if (pokemon.length > 0) {
          console.log('First Pokémon:', pokemon[0].name, 'ID:', pokemon[0].id);
          console.log('Last Pokémon:', pokemon[pokemon.length - 1].name, 'ID:', pokemon[pokemon.length - 1].id);
        }
      },
      error: (error) => {
        console.error('Error loading Pokémon:', error);
        this.loading.set(false);
      }
    });
  }

  /**
   * Loads user's teams for the Add to Team dropdown
   */
  private loadUserTeams(): void {
    this.trainerStore.teams$.subscribe({
      next: (teams) => {
        this.userTeams.set(teams || []);
        console.log('Teams loaded:', teams.length);
      },
      error: (err) => {
        console.error('Error loading teams:', err);
      }
    });
  }

  /**
   * Calculates total base stats for a Pokémon
   */
  calculateTotalStats(pokemon: Pokemon): number {
    return pokemon.stats.hp + pokemon.stats.attack + pokemon.stats.defense +
           pokemon.stats.specialAttack + pokemon.stats.specialDefense + pokemon.stats.speed;
  }

  /**
   * Handles search term change
   */
  onSearchChange(): void {
    this.currentPage.set(1);
    this.clearSelection();
  }

  /**
   * Handles type filter change
   */
  onTypeChange(): void {
    this.currentPage.set(1);
    this.clearSelection();
  }

  /**
   * Handles stats range change
   */
  onStatsChange(): void {
    this.currentPage.set(1);
  }

  /**
   * Handles page size change
   */
  onPageSizeChange(newSize: number): void {
    const size = Number(newSize);
    if (isNaN(size) || size === this.pageSize()) return;
    
    // Store current first item index before changing page size
    const currentFirstItemIndex = (this.currentPage() - 1) * this.pageSize();
    
    // Update page size
    this.pageSize.set(size);
    
    // Calculate new page number to keep the same first item visible
    let newPage = Math.floor(currentFirstItemIndex / size) + 1;
    
    // Get total pages with new page size
    const total = this.filteredPokemon().length;
    const maxPage = Math.max(1, Math.ceil(total / size));
    
    // Ensure new page is within bounds
    if (newPage > maxPage) {
      newPage = maxPage;
    }
    if (newPage < 1) {
      newPage = 1;
    }
    
    // Update current page
    this.currentPage.set(newPage);
    
    console.log(`Page size changed to ${size}, new page: ${newPage}, max page: ${maxPage}`);
  }

  /**
   * Sorts table by column
   */
  sort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDir.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
    this.currentPage.set(1);
  }

  /**
   * Navigates to previous page
   */
  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
    }
  }

  /**
   * Navigates to next page
   */
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(page => page + 1);
    }
  }

  /**
   * Goes to first page
   */
  goToFirstPage(): void {
    if (this.currentPage() !== 1) {
      this.currentPage.set(1);
    }
  }

  /**
   * Goes to last page
   */
  goToLastPage(): void {
    const lastPage = this.totalPages();
    if (this.currentPage() !== lastPage && lastPage > 0) {
      this.currentPage.set(lastPage);
    }
  }

  /**
   * Goes to a specific page number
   */
  goToPage(page: number): void {
    const total = this.totalPages();
    let targetPage = Number(page);
    
    if (isNaN(targetPage) || targetPage < 1) {
      targetPage = 1;
    } else if (targetPage > total) {
      targetPage = total;
    }
    
    if (this.currentPage() !== targetPage && targetPage >= 1 && targetPage <= total) {
      this.currentPage.set(targetPage);
    }
  }

  /**
   * Toggles selection for a single Pokémon
   */
  toggleSelection(pokemonId: number, event: Event): void {
    event.stopPropagation();
    const newSelection = new Set(this.selectedPokemonIds());

    if (newSelection.has(pokemonId)) {
      newSelection.delete(pokemonId);
    } else {
      newSelection.add(pokemonId);
    }

    this.selectedPokemonIds.set(newSelection);
    this.showBulkActionBar.set(newSelection.size > 0);
  }

  /**
   * Clears all selections
   */
  clearSelection(): void {
    this.selectedPokemonIds.set(new Set());
    this.showBulkActionBar.set(false);
  }

  /**
   * Opens Add to Team modal
   */
  openAddToTeamModal(): void {
    if (this.selectedPokemonIds().size === 0) {
      this.bulkAddError.set('Please select at least one Pokémon to add.');
      setTimeout(() => this.bulkAddError.set(null), 3000);
      return;
    }

    if (this.userTeams().length === 0) {
      this.bulkAddError.set('No teams available. Please create a team first in Team Builder.');
      setTimeout(() => this.bulkAddError.set(null), 3000);
      return;
    }

    this.selectedTeamId.set('');
    this.bulkAddError.set(null);
    this.bulkAddSuccess.set(null);
    this.showAddToTeamModal.set(true);
  }

  /**
   * Closes Add to Team modal
   */
  closeAddToTeamModal(): void {
    this.showAddToTeamModal.set(false);
    this.selectedTeamId.set('');
    this.bulkAddError.set(null);
    this.bulkAddSuccess.set(null);
    this.isAdding.set(false);
  }

  /**
   * Adds selected Pokémon to selected team
   */
  addSelectedToTeam(): void {
    if (!this.selectedTeamId()) {
      this.bulkAddError.set('Please select a team.');
      return;
    }

    const targetTeam = this.userTeams().find(t => t.id === this.selectedTeamId());
    if (!targetTeam) {
      this.bulkAddError.set('Selected team not found.');
      return;
    }

    this.isAdding.set(true);
    this.bulkAddError.set(null);

    const selectedPokemon = this.selectedPokemonObjects();
    const currentPokemonIds = targetTeam.pokemonIds || [];
    const newPokemonIds = [...currentPokemonIds];
    const addedPokemon: string[] = [];
    const alreadyInTeam: string[] = [];

    // Add new Pokémon (max 6 total)
    for (const pokemon of selectedPokemon) {
      if (!newPokemonIds.includes(pokemon.id)) {
        if (newPokemonIds.length < 6) {
          newPokemonIds.push(pokemon.id);
          addedPokemon.push(pokemon.name);
        } else {
          this.bulkAddError.set(`Cannot add more than 6 Pokémon to a team. Team "${targetTeam.name}" already has ${currentPokemonIds.length} Pokémon.`);
          this.isAdding.set(false);
          return;
        }
      } else {
        alreadyInTeam.push(pokemon.name);
      }
    }

    // Create updated Pokémon details with proper structure
    const existingDetails = targetTeam.pokemonDetails || [];
    const newDetails = [...existingDetails];

    for (const pokemon of selectedPokemon) {
      if (!existingDetails.some(d => d.pokemonId === pokemon.id)) {
        newDetails.push({
          pokemonId: pokemon.id,
          nickname: '',
          heldItem: '',
          evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
        });
      }
    }

    // Update team using the store's update method
    this.trainerStore.updateTeam(targetTeam.id, {
      pokemonIds: newPokemonIds,
      pokemonDetails: newDetails
    }).subscribe({
      next: () => {
        this.isAdding.set(false);
        const message = `Added ${addedPokemon.length} Pokémon to "${targetTeam.name}".`;
        if (alreadyInTeam.length > 0) {
          this.bulkAddSuccess.set(`${message} (${alreadyInTeam.join(', ')} already in team)`);
        } else {
          this.bulkAddSuccess.set(message);
        }

        // Clear selection after successful add
        this.clearSelection();

        // Reload teams to refresh the list
        this.loadUserTeams();

        setTimeout(() => {
          this.closeAddToTeamModal();
        }, 1500);
      },
      error: (err) => {
        console.error('Failed to add Pokémon to team:', err);
        this.isAdding.set(false);
        this.bulkAddError.set('Failed to add Pokémon to team. Please try again.');
      }
    });
  }

  /**
   * Handles Pokémon row click to show detail panel
   */
  onPokemonClick(pokemon: Pokemon): void {
    this.selectedPokemon.set(pokemon);
  }

  /**
   * Closes Pokémon detail panel
   */
  closeDetailPanel(): void {
    this.selectedPokemon.set(null);
  }

  /**
   * Handles image loading errors
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';
  }
}