// src/app/state/pokemon/pokemon.store.spec.ts
import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { of, throwError } from 'rxjs';
import { PokemonStore } from './pokemon.store';
import { GET_POKEMON_LIST } from '../../core/graphql/pokemon.queries';

describe('PokemonStore', () => {
  let store: PokemonStore;
  let apolloMock: any;

  const mockPokemonResponse = {
    data: {
      pokemon_v2_pokemon: [
        {
          id: 1,
          name: 'bulbasaur',
          height: 7,
          weight: 69,
          pokemon_v2_pokemontypes: [{ pokemon_v2_type: { name: 'grass' } }],
          pokemon_v2_pokemonstats: [
            { base_stat: 45, pokemon_v2_stat: { name: 'hp' } },
            { base_stat: 49, pokemon_v2_stat: { name: 'attack' } }
          ],
          pokemon_v2_pokemonsprites: [{ sprites: '{"front_default":"test.png"}' }]
        }
      ],
      pokemon_v2_pokemon_aggregate: { aggregate: { count: 1 } }
    }
  };

  beforeEach(async () => {
    apolloMock = {
      query: jasmine.createSpy().and.returnValue(of(mockPokemonResponse))
    };

    await TestBed.configureTestingModule({
      providers: [
        PokemonStore,
        { provide: Apollo, useValue: apolloMock }
      ]
    }).compileComponents();

    store = TestBed.inject(PokemonStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should fetch Pokémon list successfully', (done) => {
    store.fetchPokemonList(20, 0).subscribe({
      next: (pokemons) => {
        expect(pokemons).toBeDefined();
        expect(pokemons.length).toBeGreaterThan(0);
        expect(apolloMock.query).toHaveBeenCalledWith({
          query: GET_POKEMON_LIST,
          variables: { limit: 20, offset: 0 },
          fetchPolicy: 'network-only'
        });
        done();
      },
      error: (err) => {
        done.fail(err);
      }
    });
  });

  it('should set loading state to true while fetching', (done) => {
    let loadingStates: boolean[] = [];
    
    // Collect loading states
    store.loading$.subscribe(loading => {
      loadingStates.push(loading);
    });
    
    // Start fetch
    store.fetchPokemonList(20, 0).subscribe({
      next: () => {
        // After completion, check that loading was true during fetch
        // loadingStates should contain: false (initial), true (during), false (after)
        expect(loadingStates).toContain(true);
        expect(loadingStates[loadingStates.length - 1]).toBe(false);
        done();
      },
      error: (err) => {
        done.fail(err);
      }
    });
  });

  it('should handle API errors', (done) => {
    const errorMock = { message: 'Network error' };
    apolloMock.query.and.returnValue(throwError(() => errorMock));
    
    store.fetchPokemonList(20, 0).subscribe({
      next: () => {
        done.fail('Expected error but got success');
      },
      error: (error) => {
        expect(error).toBeDefined();
        expect(error.message).toBe('Network error');
        done();
      }
    });
  });
});