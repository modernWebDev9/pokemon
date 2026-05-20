// src/app/features/pokedex/pokemon-detail/pokemon-detail.component.ts
import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Pokemon } from '../../../state/pokemon/pokemon.store';
import { StatsChartComponent } from '../../../shared/components/stats-chart/stats-chart.component';

type StatKey = 'hp' | 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed';

interface StatItem {
  name: string;
  key: StatKey;
}

@Component({
  selector: 'app-pokemon-detail',
  standalone: true,
  imports: [CommonModule, StatsChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pokemon-detail.component.html',
  styleUrls: ['./pokemon-detail.component.scss']
})
export class PokemonDetailComponent {
  private sanitizer = inject(DomSanitizer);
  
  pokemon = input<Pokemon | null>(null);
  closed = output<void>();
  
  isPlaying = signal<boolean>(false);
  private audioElement: HTMLAudioElement | null = null;
  
  // Expanded video mapping for more Pokémon
  private readonly videoMap: Record<number, string> = {
    // Kanto Starters
    1: 'https://www.youtube.com/embed/6jzZ3CqN9Zs',    // Bulbasaur
    4: 'https://www.youtube.com/embed/gxEPV4kolz0',    // Charmander
    7: 'https://www.youtube.com/embed/9P6i6RZsBSc',    // Squirtle
    
    // Popular Pokémon
    25: 'https://www.youtube.com/embed/1HRa4X07jdE',   // Pikachu
    6: 'https://www.youtube.com/embed/gxEPV4kolz0',    // Charizard
    9: 'https://www.youtube.com/embed/9P6i6RZsBSc',    // Blastoise
    3: 'https://www.youtube.com/embed/6jzZ3CqN9Zs',    // Venusaur
    
    // Legendary Birds
    144: 'https://www.youtube.com/embed/3GJOVPjhXMY',  // Articuno
    145: 'https://www.youtube.com/embed/3GJOVPjhXMY',  // Zapdos
    146: 'https://www.youtube.com/embed/3GJOVPjhXMY',  // Moltres
    
    // Legendary
    150: 'https://www.youtube.com/embed/5Tk5L4rYk9A',  // Mewtwo
    151: 'https://www.youtube.com/embed/6lFjGvQVqA0',  // Mew
    
    // Dragonite line
    147: 'https://www.youtube.com/embed/4w9EksW5wz8',  // Dratini
    148: 'https://www.youtube.com/embed/4w9EksW5wz8',  // Dragonair
    149: 'https://www.youtube.com/embed/4w9EksW5wz8',  // Dragonite
    
    // Eevee line
    133: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',  // Eevee
    134: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',  // Vaporeon
    135: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',  // Jolteon
    136: 'https://www.youtube.com/embed/kJ8ZmSjeGmQ',  // Flareon
  };
  
  videoUrl = computed<SafeResourceUrl | null>(() => {
    const pokemon = this.pokemon();
    if (!pokemon) return null;
    
    // Use specific video if available, otherwise use a generic Pokémon video
    const url = this.videoMap[pokemon.id] || 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    console.log('Video URL for', pokemon.name, ':', url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  
  audioUrl = computed(() => {
    const pokemon = this.pokemon();
    if (!pokemon) return null;
    return `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemon.id}.ogg`;
  });
  
  totalStats = computed(() => {
    const pokemon = this.pokemon();
    if (!pokemon) return 0;
    const s = pokemon.stats;
    return s.hp + s.attack + s.defense + s.specialAttack + s.specialDefense + s.speed;
  });
  
  getStatList(): StatItem[] {
    return [
      { name: 'HP', key: 'hp' },
      { name: 'Attack', key: 'attack' },
      { name: 'Defense', key: 'defense' },
      { name: 'Sp. Atk', key: 'specialAttack' },
      { name: 'Sp. Def', key: 'specialDefense' },
      { name: 'Speed', key: 'speed' }
    ];
  }
  
  getStatValue(stats: Pokemon['stats'], key: StatKey): number {
    return stats[key];
  }
  
  getStatPercentage(stat: number, max: number = 255): number {
    return (stat / max) * 100;
  }
  
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';
  }
  
  onClose(): void {
    this.stopAudio();
    this.closed.emit();
  }
  
  playAudio(): void {
    const url = this.audioUrl();
    if (!url) return;
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    
    this.audioElement = new Audio(url);
    this.audioElement.play().catch(err => console.log('Audio play failed:', err));
    this.isPlaying.set(true);
    
    this.audioElement.onended = () => {
      this.isPlaying.set(false);
      this.audioElement = null;
    };
  }
  
  stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
      this.isPlaying.set(false);
    }
  }
}