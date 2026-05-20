/**
 * Pokedex Table Component - Displays Pokémon in a sortable, filterable table
 * Implements client-side pagination, filtering, and sorting with Angular Signals
 */
import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PokemonStore, Pokemon } from '../../../state/pokemon/pokemon.store';
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
  
  // UI state signals
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');
  selectedType = signal<string>('');
  minStats = signal<number>(0);
  maxStats = signal<number>(1000);
  sortBy = signal<string>('id');
  sortDir = signal<'asc' | 'desc'>('asc');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  
  // Data signals
  allPokemon = signal<Pokemon[]>([]);
  selectedPokemon = signal<Pokemon | null>(null);
  
  /**
   * Computed signal for available Pokémon types
   * Extracts unique types from all Pokémon
   */
  availableTypes = computed(() => {
    const types = new Set<string>();
    this.allPokemon().forEach(p => p.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  });
  
  /**
   * Computed signal for filtered and sorted Pokémon
   * Applies search, type filter, stats range, and sorting
   */
  filteredPokemon = computed(() => {
    let results = [...this.allPokemon()];
    const search = this.searchTerm().toLowerCase();
    const type = this.selectedType();
    
    // Apply text search filter (minimum 2 characters)
    if (search.length >= 2) {
      results = results.filter(p => p.name.toLowerCase().includes(search));
    }
    
    // Apply type filter
    if (type) {
      results = results.filter(p => p.types.includes(type));
    }
    
    // Apply total stats range filter
    results = results.filter(p => {
      const total = this.calculateTotalStats(p);
      return total >= this.minStats() && total <= this.maxStats();
    });
    
    // Apply sorting
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
        case 'hp':
        case 'attack':
        case 'defense':
        case 'specialAttack':
        case 'specialDefense':
        case 'speed':
          aVal = a.stats[sortBy as keyof typeof a.stats];
          bVal = b.stats[sortBy as keyof typeof b.stats];
          break;
        default:
          aVal = a.id;
          bVal = b.id;
      }
      
      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return results;
  });
  
  /**
   * Computed signal for total number of pages
   */
  totalPages = computed(() => Math.ceil(this.filteredPokemon().length / this.pageSize()));
  
  /**
   * Computed signal for paginated Pokémon
   * Slices filtered results based on current page and page size
   */
  paginatedPokemon = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPokemon().slice(start, start + this.pageSize());
  });
  
  /**
   * Initializes component by loading Pokémon data
   */
  ngOnInit(): void {
    this.pokemonStore.fetchPokemonList(151, 0).subscribe({
      next: (pokemon) => {
        this.allPokemon.set(pokemon);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading Pokémon:', error);
        this.loading.set(false);
      }
    });
  }
  
  /**
   * Calculates total base stats for a Pokémon
   *
   * @param pokemon - Pokémon entity
   * @returns Sum of all base stats
   */
  calculateTotalStats(pokemon: Pokemon): number {
    return pokemon.stats.hp + pokemon.stats.attack + pokemon.stats.defense +
           pokemon.stats.specialAttack + pokemon.stats.specialDefense + pokemon.stats.speed;
  }
  
  /**
   * Handles search term change and resets to first page
   */
  onSearchChange(): void {
    this.currentPage.set(1);
  }
  
  /**
   * Handles type filter change and resets to first page
   */
  onTypeChange(): void {
    this.currentPage.set(1);
  }
  
  /**
   * Handles stats range change and resets to first page
   */
  onStatsChange(): void {
    this.currentPage.set(1);
  }
  
  /**
   * Handles page size change and resets to first page
   */
  onPageSizeChange(): void {
    this.currentPage.set(1);
  }
  
  /**
   * Sorts table by column
   * Toggles direction if same column, sets to ascending if new column
   *
   * @param column - Column name to sort by
   */
  sort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDir.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
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
   * Handles Pokémon row click to show detail panel
   *
   * @param pokemon - Selected Pokémon
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
   * Handles image loading errors by setting fallback sprite
   *
   * @param event - Image error event
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';
  }
}