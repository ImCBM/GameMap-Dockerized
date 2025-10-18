

# Dockerized Procedural Level Generator


---

**Group:** Private Static
**Members:**
- Bautista, Wimari
- Bragais, Nhiko
- Magtajas, Chester
- Rivera, Mark Angelo
- Ton-Ogan, John Paulo

---

This is a "Dockerized" version of a procedural level generator tool for the game Bathala. You can run it as a single server or as a cluster that can auto-scale.

Forked from: [Corridor](https://github.com/ImCBM/Corridor-MapTileGenerator)

## Features

- Load balancer for routing and auto-scaling
- Persistent game server (always running)
- Auto-scaled servers (created and destroyed as needed)
- Multi-stage Docker builds for production and development
- Health checks and resource cleanup

## Quick Start

### Prerequisites
- Install Docker Desktop
- 8GB RAM or more is recommended

### Single Server

```
docker build -t procgen-game .
docker run -d -p 8080:80 --name procgen-simple procgen-game
```
Go to: http://localhost:8080

### Auto-Scaling Cluster

```
docker-compose -f docker-compose.cluster.yml up --build -d
```

You can access:
- Main game (load balanced): http://localhost:80
- Persistent server: http://localhost:8080

### Monitoring Dashboard and Admin API (Work In Progress)

There is supposed to be a monitoring dashboard that is supposed to show the status of your cluster, but right now it does not work. You can ignore or remove it.

The admin API is at:
  http://localhost:8090/api/servers

This is supposed to be for program use, but right now it doesn't work and I don't know why.

## Development

Install Node.js (version 16 or higher) and dependencies:

```
npm install
```

Run in development mode:

```
npm run dev
```
Go to: http://localhost:3000

Build for production:

```
npm run build
```
Output is in the `dist/` folder.

Clean build:

```
npm run clean
```
Removes the `dist/` folder.

## Controls

UI:
- Width/Height: Set grid size (10-100)
- Regions: Number of region centers (3-30)
- Min Distance: Minimum distance between regions (1-10)
- Viewport Culling: Toggle performance optimization
- Generate Level: Create new layout

Mouse:
- Mouse Wheel: Zoom
- Left Click + Drag: Pan
- Refresh: Reset camera

## File Structure

```
src/
  main.ts            # Entry point
  game-scene.ts      # Rendering logic
  level-generator.ts # Level generation
  data-structures.ts # Data classes
  index.html         # UI template
  phaser.d.ts        # Phaser types
  delaunator.d.ts    # Delaunator types
```

## Performance

Viewport culling only renders visible tiles for better performance. Without culling, all tiles are rendered every frame. With culling, only visible tiles are rendered.

## Customization

Tile types:
- PATH_TILE (1): Green paths
- REGION_TILE (2): Brown regions
- REGION_OUTER_TILE (3): Dark Green paths

Change colors in `game-scene.ts`.

Default generation parameters are in `level-generator.ts`.

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Troubleshooting

- "Cannot find module" errors: Run `npm install`
- Blank screen: Check browser console, make sure `npm run dev` is running
- Generation fails: Try different parameters, check region count vs grid size
- Performance issues: Reduce grid size or region count
- Monitoring dashboard not accessible: It's optional, and you can ignore it if not needed.
- Admin API shows "Upgrade Required": This is expected if you open it in a browser. The endpoint is for programmatic use.

## License

MIT License
