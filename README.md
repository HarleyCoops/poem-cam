# 📷✨ Polaroid Cam with AI Poetry

A modern web-based Polaroid camera app that captures photos and generates cute, cursive poems for each shot using AI.

## Features

- 📱 **Camera capture** with front/back camera switching
- 🖼️ **Polaroid-style** photo gallery with developing effect
- 🎭 **Fullscreen stacked viewer** with swipe navigation
- 🤖 **AI-generated poetry** for every photo
- 💾 **Persistent storage** with automatic data migration
- 📱 **Mobile-responsive** design
- ✨ **Beautiful animations** and effects

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Environment Variables

Copy the example environment file and add your OpenAI API key:


Then edit `.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=your_actual_openai_api_key_here
```

**Important:** Never commit your `.env` file to version control. It's already included in `.gitignore`.

### 3. Start the Development Server

```bash
# Development mode
npm start

# Or for development with auto-restart (if you have nodemon installed)
npm run dev
```

The app will be available at `http://localhost:3000`

### 4. Access the App

**For camera access, use HTTPS in production:**
- Use `https://localhost:3000` for local testing
- Or deploy to a service that provides HTTPS automatically

**Note:** Most browsers require HTTPS for camera access. If you're testing locally, you might need to use a tool like `mkcert` or access via `https://localhost:3000`.

## How it Works

1. **Take a photo** using the camera interface
2. **Watch it "develop"** with a realistic Polaroid effect
3. **AI writes a poem** - you'll see "writing a poem…" during generation
4. **View in gallery** - poems appear under each Polaroid in cursive font
5. **Fullscreen viewing** - tap any photo to see it in the stacked viewer with poems
6. **Delete photos** - long-press to reveal delete option

## Technical Details

### Data Storage
- **New format**: `{img: base64, poem: string, ts: timestamp}`
- **Automatic migration** from old string-only format
- **Versioned schema** for future compatibility

### API Integration
- POST `/api/poem` with base64 image
- Returns `{poem: string}` 
- Error handling with fallback text
- Non-blocking UI updates

### UI Features
- **Cursive styling** for poems using web-safe fonts
- **Responsive layout** for mobile and desktop
- **Accessibility** with proper ARIA labels
- **Touch gestures** for navigation and interaction

## Browser Support

- Modern browsers with camera API support
- Requires HTTPS for camera access in production
- Progressive enhancement for offline functionality

## Development Notes

- Uses ES6 modules and modern JavaScript
- Express server serves static files and API
- No build step required - vanilla JS and CSS
- Optimized for mobile performance
- Local storage for photo persistence
- Camera API integration with proper cleanup

## Troubleshooting

### Camera Access Issues
- **HTTPS Required**: Browsers require HTTPS for camera access. Use `https://localhost:3000` for local testing
- **Permissions**: Grant camera permissions when prompted by your browser
- **Multiple Cameras**: The app automatically detects front/back cameras

### Common Issues
- **Poems not generating**: Check your OpenAI API key in `.env` file
- **Photos not saving**: Ensure local storage is enabled in your browser
- **Camera not working**: Try refreshing the page and granting camera permissions

### Development Tips
- **Console Logs**: Check browser console for debugging information
- **Network Tab**: Monitor API calls to `/api/poem` endpoint
- **Local Storage**: View saved photos in browser dev tools under Application > Local Storage

---

*Capture moments, create poetry* 📸✨ 