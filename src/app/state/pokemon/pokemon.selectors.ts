// src/app/state/pokemon/pokemon.selectors.ts
import { Injectable, inject } from '@angular/core';
import { combineLatest, Observable, BehaviorSubject } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, shareReplay } from 'rxjs/operators';
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
  
  public filteredPokemon$: Observable<Pokemon[]> = combineLatest([
    this.pokemonStore.pokemonList$,
    this.filterSubject.asObservable().pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ),
  ]).pipe(
    map(([pokemons, filters]) => {
      let results = [...pokemons];
      
      if (filters.searchTerm.length >= 2) {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(pokemon => 
          pokemon.name.toLowerCase().includes(term)
        );
      }
      
      if (filters.selectedTypes.length > 0) {
        results = results.filter(pokemon =>
          pokemon.types.some(type => filters.selectedTypes.includes(type))
        );
      }
      
      results = results.filter(pokemon => {
        const total = this.calculateTotalStats(pokemon);
        return total >= filters.minTotalStats && total <= filters.maxTotalStats;
      });
      
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
    shareReplay(1)
  );
  
  updateFilters(filters: Partial<PokemonFilter>): void {
    this.filterSubject.next({
      ...this.filterSubject.value,
      ...filters,
    });
  }
}