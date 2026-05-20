/**
 * Pokemon Store - BehaviorSubject-based state management for Pokémon data
 * Handles caching, API calls, and state updates for the Pokédex feature
 */
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, retry, tap, shareReplay } from 'rxjs/operators';
import { Apollo } from 'apollo-angular';
import { GET_POKEMON_LIST, GET_POKEMON_DETAIL } from '../../core/graphql/pokemon.queries';

/**
 * Represents a Pokémon's base stats
 */
export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

/**
 * Represents a Pokémon's sprite images
 */
export interface PokemonSprites {
  front_default: string;
  front_shiny: string;
}

/**
 * Represents a complete Pokémon entity
 */
export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  stats: PokemonStats;
  sprites: PokemonSprites;
}

/**
 * State interface for Pokémon store
 */
export interface PokemonState {
  list: Pokemon[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  cache: Map<number, Pokemon>;
}

/**
 * Initial state for Pokémon store
 */
const INITIAL_STATE: PokemonState = {
  list: [],
  totalCount: 0,
  loading: false,
  error: null,
  cache: new Map(),
};

@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private apollo = inject(Apollo);
  
  private stateSubject = new BehaviorSubject<PokemonState>(INITIAL_STATE);
  public state$ = this.stateSubject.asObservable();
  
  /**
   * Observable stream of Pokémon list
   * Uses shareReplay(1) to cache the latest value for multiple subscribers
   */
  public readonly pokemonList$ = this.state$.pipe(
    map(state => state.list),
    shareReplay(1)
  );
  
  /**
   * Observable stream of loading state
   */
  public readonly loading$ = this.state$.pipe(map(state => state.loading));
  
  /**
   * Observable stream of error state
   */
  public readonly error$ = this.state$.pipe(map(state => state.error));
  
  /**
   * Observable stream of total Pokémon count
   */
  public readonly totalCount$ = this.state$.pipe(map(state => state.totalCount));

  /**
   * Fetches paginated Pokémon list from PokeAPI GraphQL endpoint
   * Results are cached in the store to avoid redundant network calls
   *
   * @param limit - Number of Pokémon to fetch per page (default: 20)
   * @param offset - Starting index for pagination (default: 0)
   * @returns Observable<Pokemon[]> - Stream of Pokémon data
   */
  fetchPokemonList(limit: number = 20, offset: number = 0): Observable<Pokemon[]> {
    console.log('Fetching Pokémon list: limit=' + limit + ', offset=' + offset);
    
    this.stateSubject.next({
      ...this.stateSubject.value,
      loading: true,
      error: null,
    });
    
    return this.apollo.query({
      query: GET_POKEMON_LIST,
      variables: { limit, offset },
      fetchPolicy: 'network-only',
    }).pipe(
      retry(3), // Retry failed API calls up to 3 times
      map((result: any) => {
        console.log('API Response received: ' + result.data?.pokemon_v2_pokemon?.length + ' pokémon');
        
        const rawPokemons = result.data?.pokemon_v2_pokemon || [];
        const totalCount = result.data?.pokemon_v2_pokemon_aggregate?.aggregate?.count || 0;
        
        const pokemons = this.transformPokemonList(rawPokemons);
        
        const currentState = this.stateSubject.value;
        pokemons.forEach(pokemon => {
          currentState.cache.set(pokemon.id, pokemon);
        });
        
        this.stateSubject.next({
          ...currentState,
          list: pokemons,
          totalCount,
          loading: false,
        });
        
        return pokemons;
      }),
      catchError((error) => {
        console.error('Failed to fetch Pokémon list:', error);
        this.stateSubject.next({
          ...this.stateSubject.value,
          loading: false,
          error: error.message || 'Failed to fetch Pokémon list',
        });
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetches single Pokémon details by ID
   * Uses cache if available to minimize API calls
   *
   * @param id - Pokémon ID number
   * @returns Observable<Pokemon> - Stream of Pokémon detail data
   */
  getPokemonById(id: number): Observable<Pokemon> {
    const cached = this.stateSubject.value.cache.get(id);
    if (cached) {
      console.log('Returning cached Pokémon: ' + cached.name);
      return of(cached);
    }
    
    return this.apollo.query({
      query: GET_POKEMON_DETAIL,
      variables: { id },
    }).pipe(
      retry(3), // Retry failed API calls up to 3 times
      map((result: any) => {
        const rawPokemon = result.data?.pokemon_v2_pokemon?.[0];
        if (!rawPokemon) {
          throw new Error('Pokémon with ID ' + id + ' not found');
        }
        const pokemon = this.transformPokemonDetail(rawPokemon);
        
        const currentState = this.stateSubject.value;
        currentState.cache.set(pokemon.id, pokemon);
        this.stateSubject.next(currentState);
        
        return pokemon;
      }),
      catchError((error) => {
        this.stateSubject.next({
          ...this.stateSubject.value,
          error: 'Failed to fetch Pokémon ' + id + ': ' + error.message,
        });
        return throwError(() => error);
      })
    );
  }

  /**
   * Transforms raw API response to Pokemon model array
   *
   * @param rawData - Raw GraphQL response data
   * @returns Transformed Pokemon array
   */
  private transformPokemonList(rawData: any[]): Pokemon[] {
    return rawData.map(item => ({
      id: item.id,
      name: this.capitalizeName(item.name),
      height: item.height / 10,
      weight: item.weight / 10,
      types: item.pokemon_v2_pokemontypes?.map((t: any) => t.pokemon_v2_type.name) || [],
      stats: this.extractStats(item.pokemon_v2_pokemonstats || []),
      sprites: this.extractSprites(item.pokemon_v2_pokemonsprites?.[0]?.sprites),
    }));
  }

  /**
   * Transforms raw API response to detailed Pokemon model
   *
   * @param rawData - Raw GraphQL detail response
   * @returns Transformed Pokemon with full details
   */
  private transformPokemonDetail(rawData: any): Pokemon {
    return {
      id: rawData.id,
      name: this.capitalizeName(rawData.name),
      height: rawData.height / 10,
      weight: rawData.weight / 10,
      types: rawData.pokemon_v2_pokemontypes?.map((t: any) => t.pokemon_v2_type.name) || [],
      stats: this.extractStats(rawData.pokemon_v2_pokemonstats || []),
      sprites: this.extractSprites(rawData.pokemon_v2_pokemonsprites?.[0]?.sprites),
    };
  }

  /**
   * Extracts and parses stats from API response
   * Maps API stat names to our internal stat model
   *
   * @param stats - Raw stats array from API
   * @returns Parsed PokemonStats object
   */
  private extractStats(stats: any[]): PokemonStats {
    const result: PokemonStats = {
      hp: 0,
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
    };
    
    stats.forEach(stat => {
      const statName = stat.pokemon_v2_stat?.name;
      switch (statName) {
        case 'hp': result.hp = stat.base_stat; break;
        case 'attack': result.attack = stat.base_stat; break;
        case 'defense': result.defense = stat.base_stat; break;
        case 'special-attack': result.specialAttack = stat.base_stat; break;
        case 'special-defense': result.specialDefense = stat.base_stat; break;
        case 'speed': result.speed = stat.base_stat; break;
      }
    });
    
    return result;
  }

  /**
   * Extracts and parses sprites from API response
   * Handles both JSON string and object formats
   *
   * @param spritesJson - Raw sprites JSON string or object
   * @returns Parsed PokemonSprites object
   */
  private extractSprites(spritesJson: any): PokemonSprites {
    try {
      const sprites = typeof spritesJson === 'string' ? JSON.parse(spritesJson) : spritesJson;
      return {
        front_default: sprites?.front_default || '',
        front_shiny: sprites?.front_shiny || '',
      };
    } catch {
      return {
        front_default: '',
        front_shiny: '',
      };
    }
  }

  /**
   * Capitalizes Pokémon name (e.g., "pikachu" -> "Pikachu")
   *
   * @param name - Raw Pokémon name
   * @returns Capitalized name
   */
  private capitalizeName(name: string): string {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Clears all cached Pokémon data
   * Useful for testing or when cache needs to be refreshed
   */
  clearCache(): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      cache: new Map(),
    });
  }
}