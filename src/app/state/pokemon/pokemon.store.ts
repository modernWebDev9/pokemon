// src/app/state/pokemon/pokemon.store.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { map, catchError, switchMap, delay, retry, tap } from 'rxjs/operators';

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

@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private http = inject(HttpClient);
  private graphqlUrl = '/graphql'; // Use relative path with proxy
  
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
   * Fetch a single Pokémon by ID using GraphQL
   */
  fetchPokemonById(id: number): Observable<Pokemon | null> {
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
      retry(3),
      delay(1000),
      map((response: GraphQLResponse) => {
        if (response.errors) {
          throw new Error(response.errors.map(e => e.message).join(', '));
        }
        
        const pokemonData = response.data?.pokemon_v2_pokemon?.[0];
        if (!pokemonData) return null;
        
        return this.transformPokemonData([pokemonData])[0] || null;
      }),
      catchError((err) => {
        console.error(`Error fetching Pokémon ${id}:`, err);
        this.error.set(err.message || 'Failed to fetch Pokémon');
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Fetch Pokémon in batches using GraphQL
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
      retry(3),
      delay(500),
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
   * Get total count of Pokémon from API
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
        return response.data?.pokemon_v2_pokemon_aggregate?.aggregate?.count || 0;
      }),
      catchError((err) => {
        console.error('Error getting total count:', err);
        return throwError(() => err);
      })
    );
  }
  
  /**
   * Fetch Pokémon list with optional limit and offset
   * If limit and offset are provided, fetches a specific batch
   * Otherwise fetches all Pokémon
   *
   * @param limit - Number of Pokémon to fetch (optional)
   * @param offset - Starting index for pagination (optional)
   * @returns Observable<Pokemon[]> - Stream of Pokémon data
   */
  fetchPokemonList(limit?: number, offset?: number): Observable<Pokemon[]> {
    // If specific limit/offset provided, fetch just that batch
    if (limit !== undefined && offset !== undefined) {
      this.loading.set(true);
      return this.fetchPokemonBatch(offset, limit).pipe(
        tap((pokemon: Pokemon[]) => {
          // Merge with existing cache
          const currentList = this.pokemonList();
          const updatedList = [...currentList];
          pokemon.forEach(p => {
            const index = updatedList.findIndex(existing => existing.id === p.id);
            if (index === -1) {
              updatedList.push(p);
            } else {
              updatedList[index] = p;
            }
          });
          updatedList.sort((a, b) => a.id - b.id);
          this.pokemonList.set(updatedList);
          this.loading.set(false);
        }),
        catchError((err) => {
          this.loading.set(false);
          this.error.set(err.message || 'Failed to fetch Pokémon');
          return throwError(() => err);
        })
      );
    }
    
    // Default: fetch ALL Pokémon
    return this.fetchAllPokemon();
  }
  
  /**
   * Fetch ALL Pokémon using sequential batches
   */
  fetchAllPokemon(): Observable<Pokemon[]> {
    this.loading.set(true);
    this.error.set(null);
    this.progress.set(0);
    
    const BATCH_SIZE = 50;
    let allPokemon: Pokemon[] = [];
    let currentOffset = 0;
    
    // First get total count, then fetch sequentially
    return this.getTotalCount().pipe(
      switchMap((total: number): Observable<Pokemon[]> => {
        this.totalCount.set(total);
        console.log(`Total Pokémon to fetch: ${total}`);
        
        // Create a recursive function to fetch batches sequentially
        const fetchNextBatch = (): Observable<Pokemon[]> => {
          return this.fetchPokemonBatch(currentOffset, BATCH_SIZE).pipe(
            switchMap((pokemon: Pokemon[]) => {
              if (pokemon.length === 0) {
                // No more data, return all collected
                console.log(`Finished fetching! Total Pokémon: ${allPokemon.length}`);
                this.pokemonList.set(allPokemon);
                this.loading.set(false);
                this.progress.set(100);
                return of(allPokemon);
              }
              
              allPokemon = [...allPokemon, ...pokemon];
              currentOffset += BATCH_SIZE;
              
              // Calculate progress
              const progressPercent = Math.min(Math.floor((currentOffset / total) * 100), 100);
              this.progress.set(progressPercent);
              
              console.log(`Batch ${Math.ceil(currentOffset / BATCH_SIZE)}: Fetched ${pokemon.length} Pokémon (Total: ${allPokemon.length})`);
              
              // Add delay between batches to avoid rate limiting
              return of(null).pipe(
                delay(100),
                switchMap(() => fetchNextBatch())
              );
            })
          );
        };
        
        return fetchNextBatch();
      }),
      catchError((err) => {
        console.error('Error fetching all Pokémon:', err);
        this.error.set(err.message || 'Failed to fetch Pokémon');
        this.loading.set(false);
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