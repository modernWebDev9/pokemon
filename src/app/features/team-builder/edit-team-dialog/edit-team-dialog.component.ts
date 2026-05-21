/**
 * Edit Team Dialog Component - Modal dialog for editing team details
 * Allows editing team name, competitive mode, battle tier, and Pokémon nicknames/held items
 * Also allows removing Pokémon from the team (minimum 1 Pokémon required)
 * Supports EV spread editing when competitive mode is on
 */
import { Component, input, output, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Team, PokemonDetail } from '../../../state/trainer/trainer.store';
import { Pokemon } from '../../../state/pokemon/pokemon.store';

export interface EVSpread {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

interface PokemonWithDetails {
  id: number;
  pokemonId: number;
  nickname: string;
  heldItem: string;
  evs: EVSpread;
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
  
  // Pokémon details editing - stores nickname, held item, and EV spread for each Pokémon
  pokemonDetails = signal<Map<number, { nickname: string; heldItem: string; evs: EVSpread }>>(new Map());
  
  // Track current Pokémon IDs in the team (for display and removal)
  currentPokemonIds = signal<number[]>([]);
  
  // Track which Pokémon to remove (for confirmation)
  pokemonToRemove = signal<number | null>(null);
  showRemoveConfirm = signal(false);
  removeErrorMessage = signal<string | null>(null);
  
  // EV Spread limits
  readonly MAX_EV_TOTAL = 510;
  readonly MAX_EV_PER_STAT = 252;
  
  ngOnInit(): void {
    const team = this.team();
    this.editName.set(team.name);
    this.editCompetitiveMode.set(team.competitiveMode);
    this.editTier.set(team.tier);
    
    // Store current Pokémon IDs
    this.currentPokemonIds.set([...team.pokemonIds]);
    
    // Load existing Pokémon details from team
    const detailsMap = new Map<number, { nickname: string; heldItem: string; evs: EVSpread }>();
    
    if (team.pokemonDetails && team.pokemonDetails.length > 0) {
      team.pokemonDetails.forEach(detail => {
        detailsMap.set(detail.pokemonId, {
          nickname: detail.nickname || '',
          heldItem: detail.heldItem || '',
          evs: detail.evs || { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
        });
      });
    } else {
      // Initialize empty details for each Pokémon in the team
      team.pokemonIds.forEach(pokemonId => {
        detailsMap.set(pokemonId, {
          nickname: '',
          heldItem: '',
          evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
        });
      });
    }
    this.pokemonDetails.set(detailsMap);
  }
  
  /**
   * Gets selected Pokémon with full data for display based on current IDs
   */
  selectedPokemonWithDetails = computed(() => {
    const pokemonIds = this.currentPokemonIds();
    const detailsMap = this.pokemonDetails();
    const allPokemonList = this.allPokemon();
    
    return pokemonIds.map(pokemonId => {
      const pokemon = allPokemonList.find(p => p.id === pokemonId);
      const details = detailsMap.get(pokemonId) || { nickname: '', heldItem: '', evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 } };
      return {
        id: pokemonId,
        pokemonId: pokemonId,
        nickname: details.nickname,
        heldItem: details.heldItem,
        evs: details.evs,
        pokemon: pokemon
      };
    }).filter(item => item.pokemon);
  });
  
  /**
   * Checks if team has minimum 1 Pokémon
   */
  hasMinimumPokemon = computed(() => {
    return this.currentPokemonIds().length >= 1;
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
   * Gets EV spread for a Pokémon
   */
  getPokemonEVs(pokemonId: number): EVSpread {
    return this.pokemonDetails().get(pokemonId)?.evs || { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 };
  }
  
  /**
   * Gets total EV sum for a Pokémon
   */
  getEVTotal(pokemonId: number): number {
    const evs = this.getPokemonEVs(pokemonId);
    return evs.hp + evs.attack + evs.defense + evs.specialAttack + evs.specialDefense + evs.speed;
  }
  
  /**
   * Checks if EV spread is valid for a Pokémon
   */
  isEVValid(pokemonId: number): boolean {
    const total = this.getEVTotal(pokemonId);
    return total === this.MAX_EV_TOTAL;
  }
  
  /**
   * Gets EV validation message for a Pokémon
   */
  getEVValidationMessage(pokemonId: number): string {
    const total = this.getEVTotal(pokemonId);
    if (total === this.MAX_EV_TOTAL) return '';
    if (total < this.MAX_EV_TOTAL) return `Total: ${total}/510 (Need ${this.MAX_EV_TOTAL - total} more)`;
    return `Total: ${total}/510 (Exceeds by ${total - this.MAX_EV_TOTAL})`;
  }
  
  /**
   * Updates nickname for a Pokémon
   */
  updateNickname(pokemonId: number, nickname: string): void {
    const newMap = new Map(this.pokemonDetails());
    const existing = newMap.get(pokemonId) || { nickname: '', heldItem: '', evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 } };
    newMap.set(pokemonId, { ...existing, nickname });
    this.pokemonDetails.set(newMap);
  }
  
  /**
   * Updates held item for a Pokémon
   */
  updateHeldItem(pokemonId: number, heldItem: string): void {
    const newMap = new Map(this.pokemonDetails());
    const existing = newMap.get(pokemonId) || { nickname: '', heldItem: '', evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 } };
    newMap.set(pokemonId, { ...existing, heldItem });
    this.pokemonDetails.set(newMap);
  }
  
  /**
   * Updates EV value for a Pokémon
   */
  updateEV(pokemonId: number, stat: keyof EVSpread, value: number): void {
    const newMap = new Map(this.pokemonDetails());
    const existing = newMap.get(pokemonId) || { nickname: '', heldItem: '', evs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 } };
    const newEVs = { ...existing.evs, [stat]: Math.min(Math.max(value, 0), this.MAX_EV_PER_STAT) };
    newMap.set(pokemonId, { ...existing, evs: newEVs });
    this.pokemonDetails.set(newMap);
  }
  
  /**
   * Shows remove confirmation modal with validation
   */
  confirmRemovePokemon(pokemonId: number): void {
    this.removeErrorMessage.set(null);
    
    if (this.currentPokemonIds().length <= 1) {
      this.removeErrorMessage.set('❌ Cannot remove the last Pokémon. A team must have at least 1 Pokémon.');
      setTimeout(() => this.removeErrorMessage.set(null), 3000);
      return;
    }
    
    this.pokemonToRemove.set(pokemonId);
    this.showRemoveConfirm.set(true);
  }
  
  /**
   * Closes remove confirmation modal
   */
  closeRemoveConfirm(): void {
    this.showRemoveConfirm.set(false);
    this.pokemonToRemove.set(null);
  }
  
  /**
   * Removes a Pokémon from the team
   */
  removePokemon(): void {
    const pokemonId = this.pokemonToRemove();
    if (pokemonId === null) return;
    
    if (this.currentPokemonIds().length <= 1) {
      this.removeErrorMessage.set('❌ Cannot remove the last Pokémon. A team must have at least 1 Pokémon.');
      this.closeRemoveConfirm();
      setTimeout(() => this.removeErrorMessage.set(null), 3000);
      return;
    }
    
    const newPokemonIds = this.currentPokemonIds().filter(id => id !== pokemonId);
    this.currentPokemonIds.set(newPokemonIds);
    
    const newDetailsMap = new Map(this.pokemonDetails());
    newDetailsMap.delete(pokemonId);
    this.pokemonDetails.set(newDetailsMap);
    
    this.closeRemoveConfirm();
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
   * Checks if all EVs are valid (for competitive mode)
   */
  allEVsValid = computed(() => {
    if (!this.editCompetitiveMode()) return true;
    const pokemonIds = this.currentPokemonIds();
    return pokemonIds.every(id => this.isEVValid(id));
  });
  
  /**
   * Validates form inputs
   */
  isValid = computed(() => {
    const name = this.editName().trim();
    const nameValid = name.length >= 3 && name.length <= 30;
    const hasPokemon = this.currentPokemonIds().length >= 1;
    const evsValid = this.allEVsValid();
    return nameValid && hasPokemon && evsValid;
  });
  
  /**
   * Saves changes including Pokémon details and EV spreads
   */
  onSave(): void {
    if (!this.isValid()) return;
    
    const currentPokemonIds = this.currentPokemonIds();
    const currentDetailsMap = this.pokemonDetails();
    
    const pokemonDetailsArray: PokemonDetail[] = Array.from(currentDetailsMap.entries()).map(([pokemonId, details]) => ({
      pokemonId,
      nickname: details.nickname,
      heldItem: details.heldItem,
      evs: details.evs
    }));
    
    const updates: Partial<Omit<Team, 'id' | 'createdAt' | 'trainerId'>> = {
      name: this.editName().trim(),
      competitiveMode: this.editCompetitiveMode(),
      tier: this.editCompetitiveMode() ? this.editTier() : null,
      pokemonIds: currentPokemonIds,
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