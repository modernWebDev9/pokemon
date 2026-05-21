// src/app/state/pokemon/pokemon.store.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, forkJoin, of, from } from 'rxjs';
import { map, catchError, tap, switchMap, concatMap, reduce, delay } from 'rxjs/operators';
import { Pokemon, PokemonStats, PokemonSprites } from './pokemon.types';

// Re-export types for use in other files
export type { Pokemon, PokemonStats, PokemonSprites } from './pokemon.types';

@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private http = inject(HttpClient);
  private graphqlUrl = 'https://beta.pokeapi.co/graphql/v1beta';
  
  // State signals
  private pokemonList = signal<Pokemon[]>([]);
  private loading = signal<boolean>(false);
  private error = signal<string | null>(null);
  private totalCount = signal<number>(0);
  private progress = signal<number>(0);
  
  // Public readonly signals
  public readonly pokemonList$ = this.pokemonList.asReadonly();
  public readonly loading$ = this.loading.asReadonly();
  public readonly error$ = this.error.asReadonly();
  public readonly totalCount$ = this.totalCount.asReadonly();
  public readonly progress$ = this.progress.asReadonly();
  
  /**
   * First, get the total count of all Pokémon
   */
  private getTotalCount(): Observable<number> {
    const countQuery = `
      query GetTotalCount {
        pokemon_v2_pokemon_aggregate {
          aggregate {
            count
          }
        }
      }
    `;
    
    return this.http.post<GraphQLResponse>(this.graphqlUrl, {
      query: countQuery
    }).pipe(
      map((response: GraphQLResponse) => {
        if (response.errors) {
          throw new Error(response.errors.map(e => e.message).join(', '));
        }
        const total = response.data?.pokemon_v2_pokemon_aggregate?.aggregate?.count || 0;
        console.log(`Total Pokémon available in API: ${total}`);
        return total;
      }),
      catchError((err) => {
        console.error('Error getting total count:', err);
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Fetch a batch of Pokémon using offset and limit
   */
  private fetchPokemonBatch(offset: number, limit: number): Observable<Pokemon[]> {
    const query = `
      query GetPokemonBatch($limit: Int, $offset: Int) {
        pokemon_v2_pokemon(
          limit: $limit, 
          offset: $offset, 
          order_by: {id: asc}
        ) {
          id
          name
          height
          weight
          pokemon_v2_pokemontypes {
            pokemon_v2_type {
              name
            }
          }
          pokemon_v2_pokemonstats {
            base_stat
            pokemon_v2_stat {
              name
            }
          }
          pokemon_v2_pokemonsprites {
            sprites
          }
        }
      }
    `;
    
    const variables = { limit, offset };
    
    return this.http.post<GraphQLResponse>(this.graphqlUrl, {
      query: query,
      variables: variables
    }).pipe(
      map((response: GraphQLResponse) => {
        if (response.errors) {
          throw new Error(response.errors.map(e => e.message).join(', '));
        }
        const pokemonData = response.data?.pokemon_v2_pokemon || [];
        return this.transformPokemonData(pokemonData);
      }),
      catchError((err) => {
        console.error(`Error fetching batch at offset ${offset}:`, err);
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Fetch ALL Pokémon using sequential batches
   * This ensures we get every single Pokémon
   */
  fetchAllPokemon(): Observable<Pokemon[]> {
    this.loading.set(true);
    this.error.set(null);
    this.progress.set(0);
    
    const BATCH_SIZE = 100;
    let allPokemon: Pokemon[] = [];
    let currentOffset = 0;
    let maxRetries = 3;
    
    const fetchNextBatch = (retryCount: number = 0): Observable<Pokemon[]> => {
      return this.fetchPokemonBatch(currentOffset, BATCH_SIZE).pipe(
        switchMap((pokemon: Pokemon[]) => {
          if (pokemon.length === 0) {
            // No more data, return all collected
            console.log(`Finished fetching! Total Pokémon: ${allPokemon.length}`);
            this.pokemonList.set(allPokemon);
            this.totalCount.set(allPokemon.length);
            this.loading.set(false);
            this.progress.set(100);
            return of(allPokemon);
          }
          
          allPokemon = [...allPokemon, ...pokemon];
          currentOffset += BATCH_SIZE;
          
          // Calculate progress (estimate based on known total ~1300)
          const estimatedTotal = 1300;
          const progressPercent = Math.min(Math.floor((currentOffset / estimatedTotal) * 100), 99);
          this.progress.set(progressPercent);
          
          console.log(`Batch ${Math.ceil(currentOffset / BATCH_SIZE)}: Fetched ${pokemon.length} Pokémon (Total: ${allPokemon.length})`);
          
          // Small delay to avoid rate limiting
          return of(null).pipe(
            delay(100),
            switchMap(() => fetchNextBatch())
          );
        }),
        catchError((err) => {
          if (retryCount < maxRetries) {
            console.warn(`Retry ${retryCount + 1}/${maxRetries} for offset ${currentOffset}`);
            this.progress.set(Math.max(this.progress() - 5, 0));
            return of(null).pipe(
              delay(1000),
              switchMap(() => fetchNextBatch(retryCount + 1))
            );
          }
          return throwError(() => err);
        })
      );
    };
    
    return fetchNextBatch().pipe(
      catchError((err) => {
        console.error('Error fetching all Pokémon:', err);
        this.error.set(err.message || 'Failed to fetch Pokémon');
        this.loading.set(false);
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Fetch ALL Pokémon using parallel batches (faster but more memory intensive)
   */
  fetchAllPokemonParallel(): Observable<Pokemon[]> {
    this.loading.set(true);
    this.error.set(null);
    this.progress.set(0);
    
    return this.getTotalCount().pipe(
      switchMap((total: number) => {
        this.totalCount.set(total);
        console.log(`Total Pokémon to fetch: ${total}`);
        
        const BATCH_SIZE = 100;
        const batchCount = Math.ceil(total / BATCH_SIZE);
        const batches: Observable<Pokemon[]>[] = [];
        
        // Create all batch requests
        for (let i = 0; i < batchCount; i++) {
          const offset = i * BATCH_SIZE;
          batches.push(this.fetchPokemonBatch(offset, BATCH_SIZE));
        }
        
        // Execute all batches in parallel
        return forkJoin(batches).pipe(
          map((results: Pokemon[][]) => {
            const allPokemon = results.flat().sort((a, b) => a.id - b.id);
            this.pokemonList.set(allPokemon);
            this.loading.set(false);
            this.progress.set(100);
            console.log(`Successfully fetched ${allPokemon.length} Pokémon in parallel`);
            return allPokemon;
          })
        );
      }),
      catchError((err) => {
        console.error('Error fetching all Pokémon in parallel:', err);
        this.error.set(err.message || 'Failed to fetch Pokémon');
        this.loading.set(false);
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Main method to fetch Pokémon list - gets ALL Pokémon
   */
  fetchPokemonList(limit?: number, offset?: number): Observable<Pokemon[]> {
    // If specific limit/offset provided, use batch fetch
    if (limit !== undefined && offset !== undefined) {
      return this.fetchPokemonBatch(offset, limit);
    }
    // Default: fetch ALL Pokémon
    return this.fetchAllPokemon();
  }
  
  /**
   * Fetch a specific Pokémon by ID
   */
  fetchPokemonById(id: number): Observable<Pokemon | null> {
    // Try cache first
    const cached = this.getPokemonById(id);
    if (cached) {
      return of(cached);
    }
    
    const query = `
      query GetPokemonById($id: Int) {
        pokemon_v2_pokemon(where: {id: {_eq: $id}}) {
          id
          name
          height
          weight
          pokemon_v2_pokemontypes {
            pokemon_v2_type {
              name
            }
          }
          pokemon_v2_pokemonstats {
            base_stat
            pokemon_v2_stat {
              name
            }
          }
          pokemon_v2_pokemonsprites {
            sprites
          }
        }
      }
    `;
    
    return this.http.post<GraphQLResponse>(this.graphqlUrl, {
      query: query,
      variables: { id }
    }).pipe(
      map((response: GraphQLResponse) => {
        if (response.errors) {
          throw new Error(response.errors.map(e => e.message).join(', '));
        }
        
        const pokemonData = response.data?.pokemon_v2_pokemon?.[0];
        if (!pokemonData) return null;
        
        const transformedPokemon = this.transformPokemonData([pokemonData]);
        return transformedPokemon[0] || null;
      }),
      catchError((err) => {
        console.error('GraphQL Error:', err);
        this.error.set(err.message || 'Failed to fetch Pokémon');
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Transform GraphQL response to Pokemon interface
   */
  private transformPokemonData(data: any[]): Pokemon[] {
    return data.map((pokemon: any) => {
      // Extract types
      const types = pokemon.pokemon_v2_pokemontypes?.map(
        (t: any) => t.pokemon_v2_type.name
      ) || [];
      
      // Extract stats
      const statsMap: Record<string, number> = {};
      pokemon.pokemon_v2_pokemonstats?.forEach((stat: any) => {
        const statName = stat.pokemon_v2_stat.name;
        let mappedName = statName;
        
        switch (statName) {
          case 'hp': mappedName = 'hp'; break;
          case 'attack': mappedName = 'attack'; break;
          case 'defense': mappedName = 'defense'; break;
          case 'special-attack': mappedName = 'specialAttack'; break;
          case 'special-defense': mappedName = 'specialDefense'; break;
          case 'speed': mappedName = 'speed'; break;
          default: mappedName = statName;
        }
        statsMap[mappedName] = stat.base_stat;
      });
      
      // Extract sprites
      let front_default = '';
      if (pokemon.pokemon_v2_pokemonsprites && pokemon.pokemon_v2_pokemonsprites.length > 0) {
        const spritesData = pokemon.pokemon_v2_pokemonsprites[0].sprites;
        if (typeof spritesData === 'string') {
          try {
            const parsed = JSON.parse(spritesData);
            front_default = parsed.front_default || '';
          } catch {
            front_default = '';
          }
        } else if (typeof spritesData === 'object' && spritesData !== null) {
          front_default = spritesData.front_default || '';
        }
      }
      
      // Fallback sprite URL
      if (!front_default) {
        front_default = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
      }
      
      return {
        id: pokemon.id,
        name: pokemon.name,
        height: pokemon.height || 0,
        weight: pokemon.weight || 0,
        types: types,
        stats: {
          hp: statsMap['hp'] || 0,
          attack: statsMap['attack'] || 0,
          defense: statsMap['defense'] || 0,
          specialAttack: statsMap['specialAttack'] || 0,
          specialDefense: statsMap['specialDefense'] || 0,
          speed: statsMap['speed'] || 0
        },
        sprites: {
          front_default: front_default
        }
      };
    });
  }
  
  /**
   * Get Pokémon by ID from cache
   */
  getPokemonById(id: number): Pokemon | undefined {
    return this.pokemonList().find(p => p.id === id);
  }
  
  /**
   * Get Pokémon by name from cache
   */
  getPokemonByName(name: string): Pokemon | undefined {
    return this.pokemonList().find(p => p.name.toLowerCase() === name.toLowerCase());
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
    this.pokemonList.set([]);
    this.loading.set(false);
    this.error.set(null);
    this.totalCount.set(0);
    this.progress.set(0);
  }
}

// GraphQL response interfaces
interface GraphQLResponse {
  data?: {
    pokemon_v2_pokemon?: any[];
    pokemon_v2_pokemon_aggregate?: {
      aggregate: {
        count: number;
      };
    };
  };
  errors?: Array<{ message: string }>;
}