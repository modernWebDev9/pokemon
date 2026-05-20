// src/app/features/pokedex/pokedex-table/pokedex-table.component.ts
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
  
  // Computed - available types
  availableTypes = computed(() => {
    const types = new Set<string>();
    this.allPokemon().forEach(p => p.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  });
  
  // Computed - filtered and sorted pokemon
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
    
    // Sort with proper type handling
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
  
  // Computed - total pages
  totalPages = computed(() => Math.ceil(this.filteredPokemon().length / this.pageSize()));
  
  // Computed - paginated pokemon
  paginatedPokemon = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPokemon().slice(start, start + this.pageSize());
  });
  
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
  
  calculateTotalStats(pokemon: Pokemon): number {
    return pokemon.stats.hp + pokemon.stats.attack + pokemon.stats.defense +
           pokemon.stats.specialAttack + pokemon.stats.specialDefense + pokemon.stats.speed;
  }
  
  onSearchChange(): void {
    this.currentPage.set(1);
  }
  
  onTypeChange(): void {
    this.currentPage.set(1);
  }
  
  onStatsChange(): void {
    this.currentPage.set(1);
  }
  
  onPageSizeChange(): void {
    this.currentPage.set(1);
  }
  
  sort(column: string): void {
    if (this.sortBy() === column) {
      this.sortDir.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
  }
  
  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
    }
  }
  
  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(page => page + 1);
    }
  }
  
  onPokemonClick(pokemon: Pokemon): void {
    this.selectedPokemon.set(pokemon);
  }
  
  closeDetailPanel(): void {
    this.selectedPokemon.set(null);
  }
  
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';
  }
}