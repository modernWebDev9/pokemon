// src/app/features/pokedex/pokedex-table.component.ts
import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonStore, Pokemon, PokemonPageResponse } from '../../../state/pokemon/pokemon.store';
import { TrainerStore, Team } from '../../../state/trainer/trainer.store';
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
  
  // Expose Math to template
  Math = Math;
  
  // Signals from store
  loading = this.pokemonStore.loading$;
  allPokemon = signal<Pokemon[]>([]);
  totalCount = this.pokemonStore.totalCount$;
  currentPageNumber = signal<number>(1);
  currentPageSize = signal<number>(25);
  
  // UI state for filters
  searchTerm = signal<string>('');
  selectedType = signal<string>('');
  minStats = signal<number>(0);
  maxStats = signal<number>(1000);
  
  // Sorting state
  sortBy = signal<string>('id');
  sortDir = signal<'asc' | 'desc'>('asc');
  
  // Selection state
  selectedPokemonIds = signal<Set<number>>(new Set());
  selectedPokemon = signal<Pokemon | null>(null);
  showBulkActionBar = signal<boolean>(false);
  
  // Modal state
  showAddToTeamModal = signal<boolean>(false);
  selectedTeamId = signal<string>('');
  bulkAddError = signal<string | null>(null);
  bulkAddSuccess = signal<string | null>(null);
  isAdding = signal<boolean>(false);
  
  // Data
  userTeams = signal<Team[]>([]);
  
  // Loading tips
  private tips = [
    'Did you know? There are 18 different Pokémon types!',
    'Tip: Use type advantages to win battles more easily!',
    'Did you know? Pikachu is the most recognized Pokémon!',
    'Tip: Build a balanced team with different types!',
    'Did you know? Magikarp can jump over mountains!',
    'Tip: Check type matchups before challenging gyms!',
    'Did you know? There are over 1000 Pokémon to discover!',
    'Tip: Save your strongest Pokémon for tough battles!',
    'Did you know? Shiny Pokémon are extremely rare!',
    'Tip: Complete your Pokédex to become a master trainer!'
  ];
  
  currentTip = signal<string>(this.tips[0]);
  private tipInterval: any;
  
  /**
   * Computed: Available types from all loaded Pokémon
   */
  availableTypes = computed(() => {
    const types = new Set<string>();
    this.allPokemon().forEach((p: Pokemon) => {
      p.types.forEach((t: string) => types.add(t));
    });
    return Array.from(types).sort();
  });
  
  /**
   * Computed: Filtered Pokémon based on search, type, and stats (from all loaded data)
   */
  filteredPokemon = computed(() => {
    let results = [...this.allPokemon()];
    const search = this.searchTerm().toLowerCase();
    const type = this.selectedType();
    
    // Apply search filter
    if (search.length >= 2) {
      results = results.filter((p: Pokemon) => p.name.toLowerCase().includes(search));
    }
    
    // Apply type filter
    if (type) {
      results = results.filter((p: Pokemon) => p.types.includes(type));
    }
    
    // Apply stats range filter
    results = results.filter((p: Pokemon) => {
      const total = this.calculateTotalStats(p);
      return total >= this.minStats() && total <= this.maxStats();
    });
    
    // Apply sorting
    results.sort((a: Pokemon, b: Pokemon) => {
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
   * Computed: Total pages based on filtered results
   */
  totalPages = computed(() => {
    const total = this.filteredPokemon().length;
    const size = this.currentPageSize();
    return Math.max(1, Math.ceil(total / size));
  });
  
  /**
   * Computed: Paginated Pokémon from filtered results
   */
  paginatedPokemon = computed(() => {
    const start = (this.currentPageNumber() - 1) * this.currentPageSize();
    const end = start + this.currentPageSize();
    return this.filteredPokemon().slice(start, end);
  });
  
  /**
   * Computed: Selected Pokémon objects from current page
   */
  selectedPokemonObjects = computed(() => {
    const selectedIds = this.selectedPokemonIds();
    return this.paginatedPokemon().filter((p: Pokemon) => selectedIds.has(p.id));
  });
  
  /**
   * Computed: Displayed range info
   */
  displayedRange = computed(() => {
    const total = this.filteredPokemon().length;
    const start = total === 0 ? 0 : (this.currentPageNumber() - 1) * this.currentPageSize() + 1;
    const end = Math.min(this.currentPageNumber() * this.currentPageSize(), total);
    return { start, end, total };
  });
  
  /**
   * Initialize component
   */
  ngOnInit(): void {
    console.log('PokedexTableComponent initialized');
    this.startTipRotation();
    this.loadAllPokemon();
    this.loadUserTeams();
  }
  
  /**
   * Start rotating tips
   */
  private startTipRotation(): void {
    let tipIndex = 0;
    this.tipInterval = setInterval(() => {
      tipIndex = (tipIndex + 1) % this.tips.length;
      this.currentTip.set(this.tips[tipIndex]);
    }, 4000);
  }
  
  /**
   * Stop tip rotation
   */
  private stopTipRotation(): void {
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
    }
  }
  
  /**
   * Load all Pokémon data (batched)
   */
  private loadAllPokemon(): void {
    this.pokemonStore.fetchAllPokemon().subscribe({
      next: (pokemon: Pokemon[]) => {
        this.allPokemon.set(pokemon);
        console.log(`Loaded ${pokemon.length} Pokémon total`);
      },
      error: (err: any) => {
        console.error('Error loading Pokémon:', err);
      }
    });
  }
  
  /**
   * Load user's teams
   */
  private loadUserTeams(): void {
    this.trainerStore.teams$.subscribe({
      next: (teams: Team[]) => {
        this.userTeams.set(teams || []);
        console.log('Teams loaded:', teams.length);
      },
      error: (err: any) => console.error('Error loading teams:', err)
    });
  }
  
  /**
   * Calculate total stats
   */
  calculateTotalStats(pokemon: Pokemon): number {
    return pokemon.stats.hp + pokemon.stats.attack + pokemon.stats.defense +
           pokemon.stats.specialAttack + pokemon.stats.specialDefense + pokemon.stats.speed;
  }
  
  /**
   * Sort table by column
   */
  sort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDir.update((dir: 'asc' | 'desc') => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
    this.currentPageNumber.set(1);
  }
  
  /**
   * Handle search change
   */
  onSearchChange(): void {
    this.currentPageNumber.set(1);
    this.clearSelection();
  }
  
  /**
   * Handle type change
   */
  onTypeChange(): void {
    this.currentPageNumber.set(1);
    this.clearSelection();
  }
  
  /**
   * Handle stats range change
   */
  onStatsChange(): void {
    this.currentPageNumber.set(1);
    this.clearSelection();
  }
  
  /**
   * Handle page size change
   */
  onPageSizeChange(newSize: number): void {
    const size = Number(newSize);
    if (isNaN(size) || size === this.currentPageSize()) return;
    
    const currentFirstItemIndex = (this.currentPageNumber() - 1) * this.currentPageSize();
    this.currentPageSize.set(size);
    
    let newPage = Math.floor(currentFirstItemIndex / size) + 1;
    const totalPages = this.totalPages();
    
    if (newPage > totalPages) newPage = totalPages;
    if (newPage < 1) newPage = 1;
    
    this.currentPageNumber.set(newPage);
    this.clearSelection();
  }
  
  /**
   * Go to previous page
   */
  previousPage(): void {
    if (this.currentPageNumber() > 1) {
      this.currentPageNumber.update((page: number) => page - 1);
    }
  }
  
  /**
   * Go to next page
   */
  nextPage(): void {
    if (this.currentPageNumber() < this.totalPages()) {
      this.currentPageNumber.update((page: number) => page + 1);
    }
  }
  
  /**
   * Go to first page
   */
  goToFirstPage(): void {
    if (this.currentPageNumber() !== 1) {
      this.currentPageNumber.set(1);
    }
  }
  
  /**
   * Go to last page
   */
  goToLastPage(): void {
    const lastPage = this.totalPages();
    if (this.currentPageNumber() !== lastPage && lastPage > 0) {
      this.currentPageNumber.set(lastPage);
    }
  }
  
  /**
   * Go to specific page
   */
  goToPage(page: number): void {
    const total = this.totalPages();
    let targetPage = Number(page);
    
    if (isNaN(targetPage) || targetPage < 1) {
      targetPage = 1;
    } else if (targetPage > total) {
      targetPage = total;
    }
    
    if (this.currentPageNumber() !== targetPage && targetPage >= 1 && targetPage <= total) {
      this.currentPageNumber.set(targetPage);
    }
  }
  
  /**
   * Toggle selection
   */
  toggleSelection(pokemonId: number, event: Event): void {
    event.stopPropagation();
    const newSelection = new Set(this.selectedPokemonIds());
    
    if (newSelection.has(pokemonId)) {
      newSelection.delete(pokemonId);
    } else if (newSelection.size < 6) {
      newSelection.add(pokemonId);
    }
    
    this.selectedPokemonIds.set(newSelection);
    this.showBulkActionBar.set(newSelection.size > 0);
  }
  
  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedPokemonIds.set(new Set());
    this.showBulkActionBar.set(false);
  }
  
  /**
   * Handle Pokémon click
   */
  onPokemonClick(pokemon: Pokemon): void {
    this.selectedPokemon.set(pokemon);
  }
  
  /**
   * Close detail panel
   */
  closeDetailPanel(): void {
    this.selectedPokemon.set(null);
  }
  
  /**
   * Open add to team modal
   */
  openAddToTeamModal(): void {
    if (this.selectedPokemonIds().size === 0) {
      this.bulkAddError.set('Please select at least one Pokémon to add.');
      setTimeout(() => this.bulkAddError.set(null), 3000);
      return;
    }
    
    if (this.userTeams().length === 0) {
      this.bulkAddError.set('No teams available. Please create a team first.');
      setTimeout(() => this.bulkAddError.set(null), 3000);
      return;
    }
    
    this.selectedTeamId.set('');
    this.bulkAddError.set(null);
    this.bulkAddSuccess.set(null);
    this.showAddToTeamModal.set(true);
  }
  
  /**
   * Close add to team modal
   */
  closeAddToTeamModal(): void {
    this.showAddToTeamModal.set(false);
    this.selectedTeamId.set('');
    this.bulkAddError.set(null);
    this.bulkAddSuccess.set(null);
    this.isAdding.set(false);
  }
  
  /**
   * Add selected Pokémon to team
   */
  addSelectedToTeam(): void {
    if (!this.selectedTeamId()) {
      this.bulkAddError.set('Please select a team.');
      return;
    }
    
    const targetTeam = this.userTeams().find((t: Team) => t.id === this.selectedTeamId());
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
    
    const existingDetails = targetTeam.pokemonDetails || [];
    const newDetails = [...existingDetails];
    
    for (const pokemon of selectedPokemon) {
      if (!existingDetails.some((d: any) => d.pokemonId === pokemon.id)) {
        newDetails.push({
          pokemonId: pokemon.id,
          nickname: '',
          heldItem: '',
          evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
        });
      }
    }
    
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
        
        this.clearSelection();
        this.loadUserTeams();
        
        setTimeout(() => {
          this.closeAddToTeamModal();
        }, 1500);
      },
      error: (err: any) => {
        console.error('Failed to add Pokémon to team:', err);
        this.isAdding.set(false);
        this.bulkAddError.set('Failed to add Pokémon to team. Please try again.');
      }
    });
  }
  
  // Custom page-size dropdown state
  pageSizeDropdownOpen = signal<boolean>(false);
  readonly pageSizeOptions = [10, 25, 50, 100];

  togglePageSizeDropdown(): void {
    this.pageSizeDropdownOpen.update(v => !v);
  }

  selectPageSize(size: number): void {
    this.onPageSizeChange(size);
    this.pageSizeDropdownOpen.set(false);
  }

  closePageSizeDropdown(): void {
    this.pageSizeDropdownOpen.set(false);
  }

  // Custom type-filter dropdown state
  typeDropdownOpen = signal<boolean>(false);

  toggleTypeDropdown(): void {
    this.typeDropdownOpen.update(v => !v);
  }

  selectType(type: string): void {
    this.selectedType.set(type);
    this.onTypeChange();
    this.typeDropdownOpen.set(false);
  }

  closeTypeDropdown(): void {
    this.typeDropdownOpen.set(false);
  }

  // Computed label for the type trigger button
  selectedTypeLabel = computed(() =>
    this.selectedType() ? this.selectedType().charAt(0).toUpperCase() + this.selectedType().slice(1) : 'All Types'
  );

  // Range fill percentage (0–100) for the progress bar
  rangeFillPct = computed(() => (this.maxStats() / 1000) * 100);

  /**
   * Handle image error
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';
  }
}