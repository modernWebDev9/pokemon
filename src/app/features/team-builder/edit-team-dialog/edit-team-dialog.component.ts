/**
 * Edit Team Dialog Component - Modal dialog for editing team details
 * Allows editing team name, competitive mode, battle tier, and Pokémon nicknames/held items
 */
import { Component, input, output, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Team, PokemonDetail } from '../../../state/trainer/trainer.store';
import { Pokemon } from '../../../state/pokemon/pokemon.store';

interface PokemonWithDetails {
  id: number;
  pokemonId: number;
  nickname: string;
  heldItem: string;
  pokemon: Pokemon | undefined;
}

@Component({
  selector: 'app-edit-team-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-team-dialog.component.html',
  styleUrls: ['./edit-team-dialog.component.scss']
})
export class EditTeamDialogComponent implements OnInit {
  team = input.required<Team>();
  allPokemon = input<Pokemon[]>([]);
  heldItems = input<{ value: string; label: string }[]>([]);
  save = output<Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId'>>>();
  close = output<void>();
  
  editName = signal('');
  editCompetitiveMode = signal(false);
  editTier = signal<'OU' | 'UU' | 'RU' | 'NU' | null>(null);
  
  // Pokémon details editing
  pokemonDetails = signal<Map<number, { nickname: string; heldItem: string }>>(new Map());
  
  ngOnInit(): void {
    const team = this.team();
    this.editName.set(team.name);
    this.editCompetitiveMode.set(team.competitiveMode);
    this.editTier.set(team.tier);
    
    // Load existing Pokémon details from team
    const detailsMap = new Map<number, { nickname: string; heldItem: string }>();
    if (team.pokemonDetails && team.pokemonDetails.length > 0) {
      team.pokemonDetails.forEach(detail => {
        detailsMap.set(detail.pokemonId, {
          nickname: detail.nickname || '',
          heldItem: detail.heldItem || ''
        });
      });
    } else {
      // Initialize empty details for each Pokémon in the team
      team.pokemonIds.forEach(pokemonId => {
        detailsMap.set(pokemonId, { nickname: '', heldItem: '' });
      });
    }
    this.pokemonDetails.set(detailsMap);
  }
  
  /**
   * Gets selected Pokémon with full data for display
   */
  selectedPokemonWithDetails = computed(() => {
    const team = this.team();
    const detailsMap = this.pokemonDetails();
    const allPokemonList = this.allPokemon();
    
    return team.pokemonIds.map(pokemonId => {
      const pokemon = allPokemonList.find(p => p.id === pokemonId);
      const details = detailsMap.get(pokemonId) || { nickname: '', heldItem: '' };
      return {
        id: pokemonId,
        pokemonId: pokemonId,
        nickname: details.nickname,
        heldItem: details.heldItem,
        pokemon: pokemon
      };
    }).filter(item => item.pokemon);
  });
  
  /**
   * Gets nickname for a Pokémon
   */
  getPokemonNickname(pokemonId: number): string {
    return this.pokemonDetails().get(pokemonId)?.nickname || '';
  }
  
  /**
   * Gets held item for a Pokémon
   */
  getPokemonHeldItem(pokemonId: number): string {
    return this.pokemonDetails().get(pokemonId)?.heldItem || '';
  }
  
  /**
   * Updates nickname for a Pokémon
   */
  updateNickname(pokemonId: number, nickname: string): void {
    const newMap = new Map(this.pokemonDetails());
    const existing = newMap.get(pokemonId) || { nickname: '', heldItem: '' };
    newMap.set(pokemonId, { ...existing, nickname });
    this.pokemonDetails.set(newMap);
  }
  
  /**
   * Updates held item for a Pokémon
   */
  updateHeldItem(pokemonId: number, heldItem: string): void {
    const newMap = new Map(this.pokemonDetails());
    const existing = newMap.get(pokemonId) || { nickname: '', heldItem: '' };
    newMap.set(pokemonId, { ...existing, heldItem });
    this.pokemonDetails.set(newMap);
  }
  
  /**
   * Gets Pokémon sprite URL by ID
   */
  getPokemonSprite(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }
  
  /**
   * Gets held item label by value
   */
  getHeldItemLabel(value: string): string {
    const items = this.heldItems();
    const item = items.find(i => i.value === value);
    return item ? item.label : value;
  }
  
  /**
   * Validates form inputs
   * Only team name validation is required
   */
  isValid = computed(() => {
    const name = this.editName().trim();
    return name.length >= 3 && name.length <= 30;
  });
  
  /**
   * Saves changes including Pokémon details
   */
  onSave(): void {
    if (!this.isValid()) return;
    
    // Convert Pokémon details map to array
    const pokemonDetailsArray: PokemonDetail[] = Array.from(this.pokemonDetails().entries()).map(([pokemonId, details]) => ({
      pokemonId,
      nickname: details.nickname,
      heldItem: details.heldItem
    }));
    
    const updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId'>> = {
      name: this.editName().trim(),
      competitiveMode: this.editCompetitiveMode(),  // true or false - directly from checkbox
      tier: this.editCompetitiveMode() ? this.editTier() : null,  // null when competitive mode is false
      pokemonDetails: pokemonDetailsArray
    };
    
    this.save.emit(updates);
  }
  
  /**
   * Closes the dialog
   */
  onClose(): void {
    this.close.emit();
  }
}