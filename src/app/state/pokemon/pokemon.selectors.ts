/**
 * Pokemon Selectors - Derived observable streams for filtered and sorted Pokémon data
 * Implements client-side filtering, sorting, and search with debouncing
 */
import { Injectable, inject } from '@angular/core';
import { combineLatest, Observable, BehaviorSubject } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { PokemonStore } from './pokemon.store';
import { Pokemon } from './pokemon.types';

/**
 * Filter configuration for Pokémon list
 */
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
  
  /**
   * BehaviorSubject holding current filter state
   */
  private filterSubject = new BehaviorSubject<PokemonFilter>({
    searchTerm: '',
    selectedTypes: [],
    minTotalStats: 0,
    maxTotalStats: 1000,
    sortBy: 'id',
    sortDirection: 'asc',
  });
  
  /**
   * Calculates total base stats for a Pokémon
   *
   * @param pokemon - Pokémon entity
   * @returns Sum of all base stats
   */
  private calculateTotalStats(pokemon: Pokemon): number {
    return pokemon.stats.hp + pokemon.stats.attack + pokemon.stats.defense +
           pokemon.stats.specialAttack + pokemon.stats.specialDefense + pokemon.stats.speed;
  }
  
  /**
   * Observable stream of filtered and sorted Pokémon
   * Combines Pokémon list with filter state, applies debouncing and distinctUntilChanged
   * Uses shareReplay(1) to cache results for multiple subscribers
   */
  public filteredPokemon$: Observable<Pokemon[]> = combineLatest([
    this.pokemonStore.pokemonList$,
    this.filterSubject.asObservable().pipe(
      debounceTime(300), // Debounce filter changes to prevent excessive recalculations
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ),
  ]).pipe(
    map(([pokemons, filters]) => {
      let results = [...pokemons];
      
      // Apply text search filter (minimum 2 characters)
      if (filters.searchTerm.length >= 2) {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(pokemon => 
          pokemon.name.toLowerCase().includes(term)
        );
      }
      
      // Apply type filter
      if (filters.selectedTypes.length > 0) {
        results = results.filter(pokemon =>
          pokemon.types.some(type => filters.selectedTypes.includes(type))
        );
      }
      
      // Apply total stats range filter
      results = results.filter(pokemon => {
        const total = this.calculateTotalStats(pokemon);
        return total >= filters.minTotalStats && total <= filters.maxTotalStats;
      });
      
      // Apply sorting
      results.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (filters.sortBy) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'total':
            aValue = this.calculateTotalStats(a);
            bValue = this.calculateTotalStats(b);
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
      
      return results;
    }),
    shareReplay(1) // Cache results to avoid recalculations for multiple subscribers
  );
  
  /**
   * Updates filter configuration
   *
   * @param filters - Partial filter configuration to update
   */
  updateFilters(filters: Partial<PokemonFilter>): void {
    this.filterSubject.next({
      ...this.filterSubject.value,
      ...filters,
    });
  }
}