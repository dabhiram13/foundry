# API-Sports (api-sports.io)

Comprehensive sports data provider. 12 sports, 2000+ competitions, 15+ years historical data. Real-time livescores updated every 15 seconds. Very affordable.

## Auth
- Env: `API_SPORTS_KEY`
- Get it: https://dashboard.api-football.com (free plan, no credit card)
- Header: `x-apisports-key: {key}`
- Base URL: `https://v3.football.api-sports.io` (football) — each sport has its own subdomain

## Sports Covered
Football, AFL, Baseball, Basketball, Formula-1, Handball, Hockey, MMA, NBA, NFL/NCAA, Rugby, Volleyball

## Football API (flagship) — Key Endpoints

| Endpoint | What | Example |
|----------|------|---------|
| `/fixtures` | Live scores, results, schedules | `?league=39&season=2025` |
| `/fixtures/statistics` | Match stats (shots, possession, corners) | `?fixture=123456` |
| `/fixtures/events` | Goals, cards, subs | `?fixture=123456` |
| `/fixtures/lineups` | Starting XI, formation | `?fixture=123456` |
| `/fixtures/players` | Per-player match stats | `?fixture=123456` |
| `/standings` | League tables | `?league=39&season=2025` |
| `/teams` | Team info | `?id=33` |
| `/teams/statistics` | Season stats per team | `?league=39&season=2025&team=33` |
| `/players` | Player profiles + season stats | `?id=276&season=2025` |
| `/players/topscorers` | Top scorers per league | `?league=39&season=2025` |
| `/transfers` | Transfer history | `?player=276` |
| `/predictions` | Match predictions | `?fixture=123456` |
| `/odds` | Pre-match + live odds | `?fixture=123456` |
| `/leagues` | All competitions | `?country=England` |
| `/countries` | Available countries | — |

## Usage Pattern
```typescript
const response = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
  headers: {
    'x-apisports-key': process.env.API_SPORTS_KEY!
  }
});
const { response: data } = await response.json();
```

Each API (football, basketball, etc.) has separate limits but shares one account.

## Gotchas
- All responses wrapped in `{ response: [...], results: N, paging: {} }`
- Rate limit: 10 requests/minute on free plan
- `league=39` is English Premier League, `league=61` is Ligue 1, `league=140` is La Liga
- Season is the start year (2025-2026 season = `season=2025`)
- Fixtures endpoint filters: `live=all`, `date=2025-03-11`, `league=X&season=Y`
- Free widgets available (copy/paste HTML) — works with all plans including free
