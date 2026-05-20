// src/app/state/pokemon/pokemon.selectors.spec.ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PokemonSelectors } from './pokemon.selectors';
import { PokemonStore } from './pokemon.store';

describe('PokemonSelectors', () => {
  let selectors: PokemonSelectors;
  let pokemonStoreMock: any;

  const mockPokemons = [
    { 
      id: 1, name: 'Bulbasaur', types: ['grass', 'poison'], 
      stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 } 
    },
    { 
      id: 4, name: 'Charmander', types: ['fire'], 
      stats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 } 
    },
    { 
      id: 7, name: 'Squirtle', types: ['water'], 
      stats: { hp: 44, attack: 48, defense: 65, specialAttack: 50, specialDefense: 64, speed: 43 } 
    }
  ];

  beforeEach(async () => {
    pokemonStoreMock = {
      pokemonList$: of(mockPokemons)
    };

    await TestBed.configureTestingModule({
      providers: [
        PokemonSelectors,
        { provide: PokemonStore, useValue: pokemonStoreMock }
      ]
    }).compileComponents();

    selectors = TestBed.inject(PokemonSelectors);
  });

  it('should be created', () => {
    expect(selectors).toBeTruthy();
  });

  it('should filter Pokémon by search term', (done) => {
    selectors.updateFilters({ searchTerm: 'char' });
    
    selectors.filteredPokemon$.subscribe((pokemons: any[]) => {
      expect(pokemons.length).toBe(1);
      expect(pokemons[0].name).toBe('Charmander');
      done();
    });
  });

  it('should filter Pokémon by type', (done) => {
    selectors.updateFilters({ selectedTypes: ['water'] });
    
    selectors.filteredPokemon$.subscribe((pokemons: any[]) => {
      expect(pokemons.length).toBe(1);
      expect(pokemons[0].name).toBe('Squirtle');
      done();
    });
  });

  it('should sort Pokémon by name in ascending order', (done) => {
    selectors.updateFilters({ sortBy: 'name', sortDirection: 'asc' });
    
    selectors.filteredPokemon$.subscribe((pokemons: any[]) => {
      expect(pokemons[0].name).toBe('Bulbasaur');
      expect(pokemons[2].name).toBe('Squirtle');
      done();
    });
  });
});