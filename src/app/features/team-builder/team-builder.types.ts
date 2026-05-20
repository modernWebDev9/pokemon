// src/app/features/team-builder/team-builder.types.ts
export interface TeamFormData {
  name: string;
  pokemonIds: number[];
  competitiveMode: boolean;
  tier: 'OU' | 'UU' | 'RU' | 'NU' | null;
  nicknames?: Record<number, string>;
  heldItems?: Record<number, string>;
  evSpreads?: Record<number, EVSpread>;
}

export interface EVSpread {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface PokemonSearchResult {
  id: number;
  name: string;
  sprite: string;
  types: string[];
}