# Satellite Communication Simulator - Version 3

A 3D interactive web application that simulates 24-hour satellite communication between a user-configured Beacon and the Iridium satellite constellation. This version includes significant improvements to visualization accuracy, data representation, and overall stability.

## Key Features (Version 3)

- **Accurate Orbital Plane Visualization**: Satellites are now correctly displayed in their 6 distinct orbital planes with proper RAAN separation (31.6°), inclination, and realistic intra-plane staggering.
- **Corrected Hourly Data Summary**: The results panel now accurately displays handshake counts, active link minutes, and coverage percentage for each of the 24 hours in the simulation.
- **Improved Chart Data**: The "Communication Statistics Over Time" chart now shows cumulative active link minutes and cumulative handshakes, providing a clearer view of communication trends over the 24-hour period.
- **Enhanced 3D Scene**: Improved camera positioning, lighting, and Earth rendering for a better user experience.
- **Code Stability and Cleanup**: Addressed various bugs, removed debug logs, and improved code structure for maintainability.
- Configure a Beacon satellite with custom orbital parameters:
  - Sun-synchronous orbit
  - Non-polar orbit
  - Custom orbit with user-defined inclination and altitude
- Fetch live Two-Line Element (TLE) data for Iridium satellites from CelesTrak (with fallback to realistic simulated TLEs).
- Simulate orbital mechanics and satellite communication over a 24-hour period.
- Visualize handshakes between satellites with a yellow connection line.
- View detailed simulation statistics including total contact time, handshake count, and outage statistics.

## Technology Stack

- React + TypeScript
- Three.js with React Three Fiber for 3D visualization
- Web Workers for off-thread computation
- Satellite.js for orbital mechanics calculations
- ESLint for code linting

## Installation

1. Clone the repository:
   ```bash
   git clone [repository-url] # Replace [repository-url] with your actual repository URL
   cd satellite-communication-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## How It Works

The simulator implements realistic orbital mechanics to calculate satellite positions and communication opportunities:

1. **Orbital Motion**: Satellites are placed in orbit based on TLE data (live or fallback) or user configuration.
2. **Handshake Detection**: Uses a 3D cone-angle test to determine when satellites can communicate, considering antenna pointing and potential Earth obstruction.
3. **Visualization**: Renders Earth, satellites with their orbital paths, and communication links in an interactive 3D space.

## Credits

- Orbital data provided by [CelesTrak](https://celestrak.org/)
- Orbital mechanics calculations powered by [Satellite.js](https://github.com/shashwatak/satellite-js)
