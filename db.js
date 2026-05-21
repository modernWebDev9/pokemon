// db.js - 수정된 버전

// Mock 데이터베이스
module.exports = {
  // Trainer 데이터
  trainers: [
    {
      id: '1',
      name: 'Ash Ketchum',
      badge_count: 8,
      region: 'Kanto',
      avatar_url: '',
      rank: 'Champion'
    },
    {
      id: '2',
      name: 'Misty',
      badge_count: 6,
      region: 'Kanto',
      avatar_url: '',
      rank: 'Gym Leader'
    },
    {
      id: '3',
      name: 'Brock',
      badge_count: 6,
      region: 'Kanto',
      avatar_url: '',
      rank: 'Gym Leader'
    }
  ],

  // Teams 데이터
  teams: [
    {
      id: '1',
      name: 'Dream Team',
      trainer_id: '1',
      pokemon_ids: [25, 6, 94, 131, 143, 149],
      pokemon_details: [],
      created_at: '2024-01-01T00:00:00Z',
      competitive_mode: true,
      tier: 'OU'
    },
    {
      id: '2',
      name: 'Water Team',
      trainer_id: '2',
      pokemon_ids: [7, 8, 9, 54, 55, 130],
      pokemon_details: [],
      created_at: '2024-01-02T00:00:00Z',
      competitive_mode: false,
      tier: null
    }
  ],

  // Battles 데이터 (BattleLog 리졸버 제거)
  battles: [
    {
      id: '1',
      trainer_id: '1',
      opponent_name: 'Gary Oak',
      team_id: '1',
      result: 'win',
      date: '2024-01-15T00:00:00Z',
      score_trainer: 3,
      score_opponent: 0
    },
    {
      id: '2',
      trainer_id: '1',
      opponent_name: 'Giovanni',
      team_id: '1',
      result: 'win',
      date: '2024-01-20T00:00:00Z',
      score_trainer: 3,
      score_opponent: 1
    },
    {
      id: '3',
      trainer_id: '2',
      opponent_name: 'Team Rocket',
      team_id: '2',
      result: 'win',
      date: '2024-01-18T00:00:00Z',
      score_trainer: 2,
      score_opponent: 0
    }
  ]
};