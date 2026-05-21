// src/app/state/pokemon/pokemon.selectors.ts
import { Injectable, inject } from '@angular/core';
import { combineLatest, Observable, BehaviorSubject, of } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, shareReplay, switchMap } from 'rxjs/operators';
import { PokemonStore } from './pokemon.store';
import { Pokemon } from './pokemon.types';

export interface PokemonFilter {
  searchTerm: string;
  selectedTypes: string[];
  minTotalStats: number;
  maxTotalStats: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class PokemonSelectors {
  private pokemonStore = inject(PokemonStore);
  
  // Convert Signal to Observable using a wrapper
  private get pokemonList$(): Observable<Pokemon[]> {
    return new Observable<Pokemon[]>((observer) => {
      // Initial value
      observer.next(this.pokemonStore.pokemonList$());
      
      // Set up a subscription to detect changes
      // Using a simple interval to check for changes (for testing purposes)
      const interval = setInterval(() => {
        observer.next(this.pokemonStore.pokemonList$());
      }, 100);
      
      return () => clearInterval(interval);
    }).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
  }
  
  private filterSubject = new BehaviorSubject<PokemonFilter>({
    searchTerm: '',
    selectedTypes: [],
    minTotalStats: 0,
    maxTotalStats: 1000,
    sortBy: 'id',
    sortDirection: 'asc',
  });
  
  private calculateTotalStats(pokemon: Pokemon): number {
    return pokemon.stats.hp + pokemon.stats.attack + pokemon.stats.defense +
           pokemon.stats.specialAttack + pokemon.stats.specialDefense + pokemon.stats.speed;
  }
  
  // Public observable of filtered and sorted Pokémon
  public filteredPokemon$: Observable<Pokemon[]> = combineLatest([
    this.pokemonList$,
    this.filterSubject.asObservable().pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ),
  ]).pipe(
    map(([pokemons, filters]) => {
      if (!pokemons || pokemons.length === 0) return [];
      
      let results = [...pokemons];
      
      // Apply search filter
      if (filters.searchTerm && filters.searchTerm.length >= 2) {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(pokemon => 
          pokemon.name.toLowerCase().includes(term)
        );
      }
      
      // Apply type filter
      if (filters.selectedTypes && filters.selectedTypes.length > 0) {
        results = results.filter(pokemon =>
          pokemon.types.some(type => filters.selectedTypes.includes(type))
        );
      }
      
      // Apply stats range filter
      results = results.filter(pokemon => {
        const total = this.calculateTotalStats(pokemon);
        return total >= filters.minTotalStats && total <= filters.maxTotalStats;
      });
      
      // Apply sorting
      if (filters.sortBy) {
        results.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (filters.sortBy) {
            case 'name':
              aValue = a.name.toLowerCase();
              bValue = b.name.toLowerCase();
              break;
            case 'total':
              aValue = this.calculateTotalStats(a);
              bValue = this.calculateTotalStats(b);
              break;
            case 'id':
              aValue = a.id;
              bValue = b.id;
              break;
            default:
              aValue = a.stats[filters.sortBy as keyof typeof a.stats] || a.id;
              bValue = b.stats[filters.sortBy as keyof typeof b.stats] || b.id;
          }
          
          if (filters.sortDirection === 'asc') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });
      }
      
      return results;
    }),
    shareReplay(1)
  );
  
  updateFilters(filters: Partial<PokemonFilter>): void {
    this.filterSubject.next({
      ...this.filterSubject.value,
      ...filters,
    });
  }
  
  // Get current filter values
  getCurrentFilters(): PokemonFilter {
    return this.filterSubject.value;
  }
  
  // Helper method to get available types from loaded Pokémon
  getAvailableTypes(): string[] {
    const pokemons = this.pokemonStore.pokemonList$();
    const types = new Set<string>();
    pokemons.forEach(p => p.types.forEach(t => types.add(t)));
    return Array.from(types).sort();
  }
  
  // Reset all filters
  resetFilters(): void {
    this.filterSubject.next({
      searchTerm: '',
      selectedTypes: [],
      minTotalStats: 0,
      maxTotalStats: 1000,
      sortBy: 'id',
      sortDirection: 'asc',
    });
  }
}