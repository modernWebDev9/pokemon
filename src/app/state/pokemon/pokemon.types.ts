// src/app/state/pokemon/pokemon.types.ts
export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonSprites {
  front_default: string;
  back_default?: string;
  front_shiny?: string;
  back_shiny?: string;
}

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  stats: PokemonStats;
  sprites: PokemonSprites;
}

export interface PokemonState {
  list: Pokemon[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  progress: number;
}