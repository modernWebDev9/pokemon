// src/app/state/pokemon/pokemon.store.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, retry, switchMap } from 'rxjs/operators';

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  sprites: {
    front_default: string;
  };
}

export interface PokemonPageResponse {
  pokemon: Pokemon[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private http = inject(HttpClient);
  private restUrl = 'https://pokeapi.co/api/v2';
  
  // Maximum valid Pokémon ID in the API
  private readonly MAX_POKEMON_ID = 1025;
  
  // State signals
  private currentPageData = signal<Pokemon[]>([]);
  private loading = signal<boolean>(false);
  private error = signal<string | null>(null);
  private totalCount = signal<number>(0);
  private currentPageNumber = signal<number>(1);
  private currentPageSize = signal<number>(25);
  
  // Public readonly signals
  public readonly currentPageData$ = this.currentPageData.asReadonly();
  public readonly loading$ = this.loading.asReadonly();
  public readonly error$ = this.error.asReadonly();
  public readonly totalCount$ = this.totalCount.asReadonly();
  public readonly currentPageNumber$ = this.currentPageNumber.asReadonly();
  public readonly currentPageSize$ = this.currentPageSize.asReadonly();
  public readonly totalPages$ = computed(() => Math.ceil(this.totalCount() / this.currentPageSize()));
  
  /**
   * Fetch a single Pokémon by ID
   */
  private fetchPokemonById(id: number): Observable<Pokemon | null> {
    if (id < 1 || id > this.MAX_POKEMON_ID) {
      return of(null);
    }
    
    return this.http.get<any>(`${this.restUrl}/pokemon/${id}`).pipe(
      retry(2),
      map((data: any) => this.transformRESTPokemon(data)),
      catchError((err: any) => {
        if (err.status === 404) {
          return of(null);
        }
        console.error(`Error fetching Pokémon ${id}:`, err);
        return of(null);
      })
    );
  }
  
  /**
   * Get total count of Pokémon from API
   */
  fetchTotalCount(): Observable<number> {
    if (this.totalCount() > 0) {
      return of(this.totalCount());
    }
    
    return this.http.get<any>(`${this.restUrl}/pokemon?limit=0`).pipe(
      map((response: any) => {
        const actualCount = Math.min(response.count || 0, this.MAX_POKEMON_ID);
        this.totalCount.set(actualCount);
        console.log(`Total Pokémon count: ${actualCount}`);
        return actualCount;
      }),
      catchError((err: any) => {
        console.error('Error getting total count:', err);
        const fallbackCount = this.MAX_POKEMON_ID;
        this.totalCount.set(fallbackCount);
        return of(fallbackCount);
      })
    );
  }
  
  /**
   * Fetch a specific page of Pokémon from the API
   */
  fetchPokemonPage(page: number, pageSize: number): Observable<PokemonPageResponse> {
    this.loading.set(true);
    this.error.set(null);
    this.currentPageNumber.set(page);
    this.currentPageSize.set(pageSize);
    
    const offset = (page - 1) * pageSize;
    const limit = pageSize;
    
    console.log(`Fetching page ${page} with ${pageSize} items (offset: ${offset})`);
    
    return this.http.get<any>(`${this.restUrl}/pokemon?offset=${offset}&limit=${limit}`).pipe(
      retry(2),
      switchMap((response: any) => {
        const pokemonIds: number[] = response.results.map((p: any, index: number) => offset + index + 1);
        const requests: Observable<Pokemon | null>[] = pokemonIds.map((id: number) => this.fetchPokemonById(id));
        return forkJoin(requests);
      }),
      map((results: (Pokemon | null)[]) => {
        const validPokemon: Pokemon[] = results.filter((p): p is Pokemon => p !== null);
        this.currentPageData.set(validPokemon);
        this.loading.set(false);
        
        console.log(`Page ${page} loaded: ${validPokemon.length} Pokémon`);
        
        return {
          pokemon: validPokemon,
          totalCount: this.totalCount(),
          currentPage: page,
          pageSize: pageSize,
          totalPages: Math.ceil(this.totalCount() / pageSize)
        };
      }),
      catchError((err: any) => {
        console.error('Error fetching Pokémon page:', err);
        this.error.set(err.message || 'Failed to fetch Pokémon');
        this.loading.set(false);
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Fetch ALL Pokémon (batched loading for complete dataset)
   */
  fetchAllPokemon(): Observable<Pokemon[]> {
    this.loading.set(true);
    this.error.set(null);
    
    return this.fetchTotalCount().pipe(
      switchMap((total: number) => {
        const BATCH_SIZE = 40;
        const batchCount = Math.ceil(total / BATCH_SIZE);
        const batches: Observable<Pokemon[]>[] = [];
        
        for (let i = 0; i < batchCount; i++) {
          const offset = i * BATCH_SIZE;
          const page = i + 1;
          batches.push(
            this.fetchPokemonPage(page, BATCH_SIZE).pipe(
              map((response: PokemonPageResponse) => response.pokemon)
            )
          );
        }
        
        return forkJoin(batches);
      }),
      map((results: Pokemon[][]) => {
        const allPokemon = results.flat().sort((a, b) => a.id - b.id);
        this.currentPageData.set(allPokemon.slice(0, this.currentPageSize()));
        this.loading.set(false);
        console.log(`Fetched all ${allPokemon.length} Pokémon`);
        return allPokemon;
      }),
      catchError((err: any) => {
        console.error('Error fetching all Pokémon:', err);
        this.error.set(err.message || 'Failed to fetch Pokémon');
        this.loading.set(false);
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Legacy method for compatibility with team-builder
   */
  fetchPokemonList(limit: number, offset: number): Observable<Pokemon[]> {
    const page = Math.floor(offset / limit) + 1;
    return this.fetchPokemonPage(page, limit).pipe(
      map((response: PokemonPageResponse) => response.pokemon)
    );
  }
  
  /**
   * Change page
   */
  changePage(page: number): Observable<PokemonPageResponse> {
    if (page < 1 || page > Math.ceil(this.totalCount() / this.currentPageSize())) {
      return throwError(() => new Error('Invalid page number'));
    }
    return this.fetchPokemonPage(page, this.currentPageSize());
  }
  
  /**
   * Change page size
   */
  changePageSize(pageSize: number): Observable<PokemonPageResponse> {
    this.currentPageSize.set(pageSize);
    return this.fetchPokemonPage(1, pageSize);
  }
  
  /**
   * Search Pokémon by name
   */
  searchPokemon(searchTerm: string): Observable<Pokemon[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return of([]);
    }
    
    return this.http.get<any>(`${this.restUrl}/pokemon?limit=100`).pipe(
      map((response: any) => {
        const matchingPokemon = response.results.filter((p: any) => 
          p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchingPokemon.slice(0, 20);
      }),
      switchMap((matches: any[]) => {
        const requests: Observable<Pokemon | null>[] = matches.map((p: any) => {
          const id: number = this.extractIdFromUrl(p.url);
          return this.fetchPokemonById(id);
        });
        return forkJoin(requests);
      }),
      map((results: (Pokemon | null)[]) => results.filter((p): p is Pokemon => p !== null)),
      catchError(() => of([]))
    );
  }
  
  /**
   * Extract Pokémon ID from URL
   */
  private extractIdFromUrl(url: string): number {
    const parts = url.split('/');
    return parseInt(parts[parts.length - 2], 10);
  }
  
  /**
   * Transform REST API response to Pokemon interface
   */
  private transformRESTPokemon(data: any): Pokemon {
    const types: string[] = data.types.map((t: any) => t.type.name);
    const stats: any = {
      hp: 0,
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0
    };
    
    data.stats.forEach((stat: any) => {
      const name: string = stat.stat.name;
      if (name === 'special-attack') stats.specialAttack = stat.base_stat;
      else if (name === 'special-defense') stats.specialDefense = stat.base_stat;
      else stats[name] = stat.base_stat;
    });
    
    return {
      id: data.id,
      name: data.name,
      height: data.height,
      weight: data.weight,
      types: types,
      stats: stats,
      sprites: {
        front_default: data.sprites.front_default || 
                      data.sprites.other?.['official-artwork']?.front_default ||
                      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${data.id}.png`
      }
    };
  }
  
  /**
   * Clear error state
   */
  clearError(): void {
    this.error.set(null);
  }
  
  /**
   * Reset store state
   */
  reset(): void {
    this.currentPageData.set([]);
    this.loading.set(false);
    this.error.set(null);
    this.totalCount.set(0);
    this.currentPageNumber.set(1);
    this.currentPageSize.set(25);
  }
}