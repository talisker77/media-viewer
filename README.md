# Node Media Viewer

A lightweight media viewer application designed to run on Raspberry Pi that serves local images and videos through a web interface.

## Features
- Browse local images and videos
- Web-based interface for easy access
- Support for common image formats (JPG, PNG, GIF)
- Support for common video formats (MP4, WebM)
- Responsive design for mobile and desktop viewing
- Automatic media scanning from specified directories

## Requirements
- Node.js (v14 or higher)
- Raspberry Pi (any model)
- Storage device with media files

## Project Structure
```
node-media-viewer/
├── src/                    # Source code
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── models/           # Data models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── utils/            # Utility functions
├── public/                # Static files
│   ├── css/              # Stylesheets
│   ├── js/               # Client-side JavaScript
│   └── images/           # Application images
├── tests/                 # Test files
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

## Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure media directories in `src/config/config.js`
4. Start the application:
   ```bash
   npm start
   ```

## Configuration
Edit `src/config/config.js` to set:
- Media directories to scan
- Server port
- File type filters
- Cache settings

## Development
- Run tests: `npm test`
- Start development server: `npm run dev`
- Build for production: `npm run build`

## License
MIT 