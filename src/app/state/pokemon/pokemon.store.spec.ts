// src/app/state/pokemon/pokemon.selectors.spec.ts
import { TestBed } from '@angular/core/testing';
import { PokemonSelectors, PokemonFilter } from './pokemon.selectors';
import { PokemonStore } from './pokemon.store';
import { Pokemon } from './pokemon.types';
import { of } from 'rxjs';

describe('PokemonSelectors', () => {
  let selectors: PokemonSelectors;
  let mockPokemonStore: jasmine.SpyObj<PokemonStore>;
  
  const mockPokemon: Pokemon[] = [
    {
      id: 1,
      name: 'bulbasaur',
      height: 7,
      weight: 69,
      types: ['grass', 'poison'],
      stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 },
      sprites: { front_default: 'bulbasaur.png' }
    },
    {
      id: 4,
      name: 'charmander',
      height: 6,
      weight: 85,
      types: ['fire'],
      stats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 },
      sprites: { front_default: 'charmander.png' }
    },
    {
      id: 7,
      name: 'squirtle',
      height: 5,
      weight: 90,
      types: ['water'],
      stats: { hp: 44, attack: 48, defense: 65, specialAttack: 50, specialDefense: 64, speed: 43 },
      sprites: { front_default: 'squirtle.png' }
    },
    {
      id: 25,
      name: 'pikachu',
      height: 4,
      weight: 60,
      types: ['electric'],
      stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 },
      sprites: { front_default: 'pikachu.png' }
    }
  ];

  beforeEach(() => {
    // Create spy object with a signal-like property
    mockPokemonStore = jasmine.createSpyObj('PokemonStore', [], {
      pokemonList$: jasmine.createSpy().and.returnValue(mockPokemon)
    });
    
    TestBed.configureTestingModule({
      providers: [
        PokemonSelectors,
        { provide: PokemonStore, useValue: mockPokemonStore }
      ]
    });
    
    selectors = TestBed.inject(PokemonSelectors);
  });

  it('should be created', () => {
    expect(selectors).toBeTruthy();
  });

  it('should filter Pokémon by search term', (done) => {
    selectors.updateFilters({ searchTerm: 'char' });
    
    selectors.filteredPokemon$.subscribe(pokemon => {
      expect(pokemon.length).toBe(1);
      expect(pokemon[0].name).toBe('charmander');
      done();
    });
  });

  it('should filter Pokémon by type', (done) => {
    selectors.updateFilters({ selectedTypes: ['water'] });
    
    selectors.filteredPokemon$.subscribe(pokemon => {
      expect(pokemon.length).toBe(1);
      expect(pokemon[0].name).toBe('squirtle');
      done();
    });
  });

  it('should sort Pokémon by name in ascending order', (done) => {
    selectors.updateFilters({ sortBy: 'name', sortDirection: 'asc' });
    
    selectors.filteredPokemon$.subscribe(pokemon => {
      expect(pokemon[0].name).toBe('bulbasaur');
      expect(pokemon[1].name).toBe('charmander');
      expect(pokemon[2].name).toBe('pikachu');
      expect(pokemon[3].name).toBe('squirtle');
      done();
    });
  });

  it('should sort Pokémon by name in descending order', (done) => {
    selectors.updateFilters({ sortBy: 'name', sortDirection: 'desc' });
    
    selectors.filteredPokemon$.subscribe(pokemon => {
      expect(pokemon[0].name).toBe('squirtle');
      expect(pokemon[1].name).toBe('pikachu');
      expect(pokemon[2].name).toBe('charmander');
      expect(pokemon[3].name).toBe('bulbasaur');
      done();
    });
  });

  it('should sort Pokémon by ID', (done) => {
    selectors.updateFilters({ sortBy: 'id', sortDirection: 'asc' });
    
    selectors.filteredPokemon$.subscribe(pokemon => {
      expect(pokemon[0].id).toBe(1);
      expect(pokemon[1].id).toBe(4);
      expect(pokemon[2].id).toBe(7);
      expect(pokemon[3].id).toBe(25);
      done();
    });
  });

  it('should reset filters', () => {
    selectors.updateFilters({ searchTerm: 'pika', selectedTypes: ['electric'] });
    expect(selectors.getCurrentFilters().searchTerm).toBe('pika');
    
    selectors.resetFilters();
    expect(selectors.getCurrentFilters().searchTerm).toBe('');
    expect(selectors.getCurrentFilters().selectedTypes).toEqual([]);
  });

  it('should get available types', () => {
    const types = selectors.getAvailableTypes();
    expect(types).toContain('grass');
    expect(types).toContain('poison');
    expect(types).toContain('fire');
    expect(types).toContain('water');
    expect(types).toContain('electric');
  });
});